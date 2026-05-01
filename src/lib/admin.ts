import { auth, db, doc, getDoc } from "@/lib/firebase";
import { onSnapshot, collection, query, orderBy, limit, addDoc, serverTimestamp } from "firebase/firestore";

// ── Admin Role Types ────────────────────────────────────────────────
export type AdminRole = "super_admin" | "admin";

export type AdminCapability =
  | "platform.read"
  | "platform.configure"
  | "tenant.read"
  | "tenant.update"
  | "tenant.suspend"
  | "tenant.restore"
  | "tenant.billing.read"
  | "tenant.billing.write"
  | "tenant.feature_flags.read"
  | "tenant.feature_flags.write"
  | "tenant.security.read"
  | "tenant.security.write"
  | "tenant.users.read"
  | "user.read"
  | "user.update"
  | "user.suspend"
  | "support.read"
  | "support.respond"
  | "audit.read"
  | "analytics.read"
  | "admin.manage"
  | "impersonate";

export interface AdminScope {
  tenantIds?: string[];
  regions?: string[];
  environments?: Array<"production" | "staging">;
}

export interface AdminClaims {
  role: AdminRole;
  granted_at: string;
  granted_by: string;
}

export interface AdminPrincipal {
  id: string;
  email: string;
  role: AdminRole;
  granted_at: string;
  granted_by: string;
  capabilities: AdminCapability[];
  scope: AdminScope;
}

export interface AdminApiResponse<T> {
  success: boolean;
  data: T;
  auditId?: string;
}

export const ROLE_CAPABILITIES: Record<AdminRole, AdminCapability[]> = {
  super_admin: [
    "platform.read",
    "platform.configure",
    "tenant.read",
    "tenant.update",
    "tenant.suspend",
    "tenant.restore",
    "tenant.billing.read",
    "tenant.billing.write",
    "tenant.feature_flags.read",
    "tenant.feature_flags.write",
    "tenant.security.read",
    "tenant.security.write",
    "tenant.users.read",
    "user.read",
    "user.update",
    "user.suspend",
    "support.read",
    "support.respond",
    "audit.read",
    "analytics.read",
    "admin.manage",
    "impersonate",
  ],
  admin: [
    "platform.read",
    "tenant.read",
    "tenant.update",
    "tenant.billing.read",
    "tenant.feature_flags.read",
    "tenant.security.read",
    "tenant.users.read",
    "user.read",
    "user.update",
    "support.read",
    "support.respond",
    "audit.read",
    "analytics.read",
  ],
};

export function buildAdminPrincipal(input: {
  id: string;
  email: string;
  role: AdminRole;
  granted_at: string;
  granted_by?: string;
  capabilities?: AdminCapability[];
  scope?: AdminScope;
}): AdminPrincipal {
  return {
    id: input.id,
    email: input.email,
    role: input.role,
    granted_at: input.granted_at,
    granted_by: input.granted_by || "system",
    capabilities: input.capabilities?.length ? input.capabilities : ROLE_CAPABILITIES[input.role],
    scope: input.scope || {},
  };
}

export function hasAdminCapability(
  principal: Pick<AdminPrincipal, "capabilities"> | null | undefined,
  capability: AdminCapability
) {
  return Boolean(principal?.capabilities.includes(capability));
}

export function canAccessTenant(
  principal: Pick<AdminPrincipal, "scope"> | null | undefined,
  tenantId: string
) {
  if (!principal) return false;
  if (!principal.scope.tenantIds?.length) return true;
  return principal.scope.tenantIds.includes(tenantId);
}

// ── Verify Admin Access (client-side gate, Firestore rules enforce server-side) ──
export async function getAdminClaims(): Promise<AdminClaims | null> {
  const user = auth.currentUser;
  if (!user) return null;

  try {
    // Force token refresh to get latest custom claims
    const tokenResult = await user.getIdTokenResult(true);
    const role = tokenResult.claims.role as string | undefined;

    if (role === "super_admin" || role === "admin") {
      return {
        role: role as AdminRole,
        granted_at: tokenResult.claims.granted_at as string || "",
        granted_by: tokenResult.claims.granted_by as string || "",
      };
    }

    // Fallback: check Firestore admin_users collection
    // (used during development before Cloud Functions are deployed)
    const adminDoc = await getDoc(doc(db, "admin_users", user.uid));
    if (adminDoc.exists()) {
      const data = adminDoc.data() as any;
      if (data.role === "super_admin" || data.role === "admin") {
        return {
          role: data.role as AdminRole,
          granted_at: data.granted_at || new Date().toISOString(),
          granted_by: data.granted_by || "system",
        };
      }
    }

    return null;
  } catch (error) {
    console.error("[AdminLib] getAdminClaims failed:", error);
    return null;
  }
}

export async function getAdminPrincipal(): Promise<AdminPrincipal | null> {
  const user = auth.currentUser;
  if (!user) return null;

  const claims = await getAdminClaims();
  if (!claims) return null;

  try {
    const adminDoc = await getDoc(doc(db, "admin_users", user.uid));
    const data = adminDoc.exists() ? (adminDoc.data() as any) : {};
    return buildAdminPrincipal({
      id: user.uid,
      email: user.email || data.email || "",
      role: claims.role,
      granted_at: claims.granted_at,
      granted_by: claims.granted_by,
      capabilities: data.capabilities,
      scope: data.scope,
    });
  } catch {
    return buildAdminPrincipal({
      id: user.uid,
      email: user.email || "",
      role: claims.role,
      granted_at: claims.granted_at,
      granted_by: claims.granted_by,
    });
  }
}

export async function adminApi<T>(path: string, init?: RequestInit): Promise<T> {
  const user = auth.currentUser;
  if (!user) throw new Error("Not authenticated");

  const token = await user.getIdToken();
  const response = await fetch(path, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(init?.headers || {}),
    },
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload?.error || "Admin request failed");
  }
  return payload as T;
}

// ── Write an immutable audit log entry ──────────────────────────────
export async function writeAuditLog(entry: {
  action: string;
  resource_type: string;
  resource_id?: string;
  target_uid?: string;
  target_tenant?: string;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}) {
  const user = auth.currentUser;
  if (!user) throw new Error("Not authenticated");

  await addDoc(collection(db, "admin_audit_logs"), {
    ...entry,
    admin_uid: user.uid,
    admin_email: user.email,
    timestamp: serverTimestamp(),
    ip: "client", // In production, Cloud Functions would capture the real IP
    user_agent: navigator.userAgent.substring(0, 200),
  });
}

// ── Real-time subscription helpers ──────────────────────────────────
export function subscribeToAdminStats(callback: (stats: AdminStats) => void) {
  // Watch the admin_stats document for real-time KPI updates
  return onSnapshot(
    doc(db, "admin_meta", "platform_stats"),
    (snap) => {
      if (snap.exists()) {
        callback(snap.data() as AdminStats);
      } else {
        callback(DEFAULT_STATS);
      }
    },
    (err) => {
      console.error("[AdminLib] Stats subscription error:", err);
      callback(DEFAULT_STATS);
    }
  );
}

export function subscribeToRecentAuditLogs(
  callback: (logs: AuditLogEntry[]) => void,
  limitCount = 50
) {
  const q = query(
    collection(db, "admin_audit_logs"),
    orderBy("timestamp", "desc"),
    limit(limitCount)
  );
  return onSnapshot(q, (snap) => {
    callback(
      snap.docs.map((d) => ({ id: d.id, ...d.data() } as AuditLogEntry))
    );
  });
}

export function subscribeToAllTenants(callback: (tenants: TenantRecord[]) => void) {
  const q = query(collection(db, "enterprise_settings"), orderBy("createdAt", "desc"));
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() } as TenantRecord)));
  });
}

export function subscribeToAllUsers(callback: (users: UserRecord[]) => void) {
  const q = query(collection(db, "users"), orderBy("createdAt", "desc"));
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() } as UserRecord)));
  });
}

// ── Types ────────────────────────────────────────────────────────────
export interface AdminStats {
  total_tenants: number;
  total_users: number;
  active_users_24h: number;
  new_signups_7d: number;
  flagged_accounts: number;
  total_revenue_usd: number;
  api_error_rate: number;
  avg_response_ms: number;
}

const DEFAULT_STATS: AdminStats = {
  total_tenants: 0,
  total_users: 0,
  active_users_24h: 0,
  new_signups_7d: 0,
  flagged_accounts: 0,
  total_revenue_usd: 0,
  api_error_rate: 0,
  avg_response_ms: 0,
};

export interface AuditLogEntry {
  id: string;
  action: string;
  resource_type: string;
  resource_id?: string;
  admin_uid: string;
  admin_email: string;
  target_uid?: string;
  target_tenant?: string;
  timestamp: any;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
  ip?: string;
}

export interface TenantRecord {
  id: string;
  enterprise_id: string;
  enterpriseName: string;
  industry?: string;
  teamSize?: string;
  setupCompleted?: boolean;
  createdAt: string;
  status?: string;
  plan?: string;
  userCount?: number;
  contactEmail?: string;
  billing?: {
    planId: string;
    userCount: number;
    branchCount: number;
    billingCycle: "monthly" | "yearly";
    renewalDate: string;
    status: "active" | "past_due" | "canceled" | "trialing";
    trialEndsAt?: string;
    paymentMethod?: { type: string; last4: string; expiry: string };
    lastVerifiedAt?: any;
  };
}

export interface UserRecord {
  id: string;
  uid?: string;
  fullName: string;
  email: string;
  enterprise_id: string;
  role: string;
  status: "ACTIVE" | "SUSPENDED" | "PENDING";
  createdAt: string;
  lastLogin?: string;
  emailVerified?: boolean;
  phone?: string;
}

// ── Portal Types ────────────────────────────────────────────────────
export type AdminTab =
  | "dashboard" | "tenants" | "users" | "security" | "audit"
  | "support" | "analytics" | "flags" | "billing" | "incidents"
  | "config" | "admins";

export type AuditEntry = AuditLogEntry;

export interface AdminUserRecord {
  id: string;
  email: string;
  role: "super_admin" | "admin";
  granted_at: string;
  granted_by?: string;
}

export interface FeedbackItem {
  id: string;
  type: "idea" | "bug" | "praise" | "other";
  subject: string;
  message: string;
  rating: number;
  user_email: string;
  enterprise_id: string;
  createdAt: any;
}

export interface SupportTicket {
  id: string;
  category: string;
  subject: string;
  message: string;
  status: "OPEN" | "IN_PROGRESS" | "RESOLVED" | "CLOSED";
  priority?: "low" | "medium" | "high" | "critical";
  user_email: string;
  enterprise_id: string;
  createdAt: any;
  metadata?: any;
}

export interface TicketReply {
  id: string;
  message: string;
  sender_email: string;
  sender_type: "ADMIN" | "USER";
  createdAt: any;
}

// ── Convenience audit writer (thin wrapper) ─────────────────────────
export async function audit(
  adminUser: { uid: string; email: string | null },
  action: string,
  payload: Record<string, unknown> = {}
) {
  await addDoc(collection(db, "admin_audit_logs"), {
    action,
    admin_uid: adminUser.uid,
    admin_email: adminUser.email,
    timestamp: serverTimestamp(),
    ...payload,
  });
}

// ── React hooks for real-time admin data ────────────────────────────
import { useState, useEffect } from "react";

export function useUsers() {
  const [users, setUsers] = useState<UserRecord[]>([]);
  useEffect(() => subscribeToAllUsers(setUsers), []);
  return users;
}

export function useTenants() {
  const [tenants, setTenants] = useState<TenantRecord[]>([]);
  useEffect(() => subscribeToAllTenants(setTenants), []);
  return tenants;
}

export function useAuditLogs(count = 50) {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  useEffect(() => subscribeToRecentAuditLogs(setLogs, count), [count]);
  return logs;
}

export function useAdminUsers() {
  const [admins, setAdmins] = useState<AdminUserRecord[]>([]);
  useEffect(() => {
    const q = query(collection(db, "admin_users"), orderBy("granted_at", "desc"));
    return onSnapshot(q, (snap) => {
      setAdmins(snap.docs.map((d) => ({ id: d.id, ...d.data() } as AdminUserRecord)));
    });
  }, []);
  return admins;
}
