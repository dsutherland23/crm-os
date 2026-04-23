import { auth, db, doc, getDoc } from "@/lib/firebase";
import { onSnapshot, collection, query, where, orderBy, limit, addDoc, serverTimestamp } from "firebase/firestore";

// ── Admin Role Types ────────────────────────────────────────────────
export type AdminRole = "super_admin" | "admin";

export interface AdminClaims {
  role: AdminRole;
  granted_at: string;
  granted_by: string;
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
  setupCompleted: boolean;
  createdAt: string;
  status?: "active" | "suspended" | "trial";
  plan?: string;
  userCount?: number;
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
}
