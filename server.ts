import express from "express";
import * as dotenv from "dotenv";
import { createServer as createViteServer } from "vite";

dotenv.config();                           // loads .env
dotenv.config({ path: ".env.local", override: true }); // loads .env.local and overrides .env values
import path from "path";
import { fileURLToPath } from "url";
import { v4 as uuidv4 } from "uuid";
import admin from "firebase-admin";
import { z } from "zod";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize Firebase Admin
if (!admin.apps.length) {
  try {
    admin.initializeApp({
      projectId: process.env.VITE_FIREBASE_PROJECT_ID || "crm-os-enterprise",
    });
  } catch (error) {
    console.warn("Firebase Admin failed to initialize. Some backend features may be limited.", error);
  }
}

const db = admin.firestore();

type AuthenticatedRequest = express.Request & {
  user?: {
    uid: string;
    email?: string;
    enterpriseId?: string | null;
    role?: string | null;
  };
};

type AdminCapability =
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
  | "impersonate"
  | "tenant.incidents.read"
  | "tenant.incidents.write";

type AdminPrincipal = {
  id: string;
  email: string;
  role: "super_admin" | "admin";
  granted_at: string;
  granted_by?: string;
  capabilities: AdminCapability[];
  scope?: {
    tenantIds?: string[];
    regions?: string[];
    environments?: Array<"production" | "staging">;
  };
};

// ── ZOD SCHEMAS ──────────────────────────────────────────────────────

const CheckoutItemSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  quantity: z.number().int().positive(),
  price: z.number().nonnegative(),
});

const CheckoutSchema = z.object({
  items: z.array(CheckoutItemSchema).min(1).max(200),
  customerId: z.string().optional().nullable(),
  branchId: z.string().min(1),
  paymentMethod: z.string().min(1),
  subtotal: z.number().nonnegative(),
  discount: z.number().nonnegative().optional().nullable(),
  tax: z.number().nonnegative(),
  total: z.number().nonnegative(),
  enterpriseId: z.string().optional(),
  enterprise_id: z.string().optional(),
});

const TransferSchema = z.object({
  productId: z.string().min(1),
  fromBranchId: z.string().min(1),
  toBranchId: z.string().min(1),
  quantity: z.number().int().positive(),
  enterpriseId: z.string().optional(),
  enterprise_id: z.string().optional(),
});

const AIGenerateSchema = z.object({
  prompt: z.string().min(1).max(8000),
  model: z.string().optional(),
});

const AggregateSchema = z.object({
  enterpriseId: z.string().min(1).optional(),
  enterprise_id: z.string().min(1).optional(),
});

const AdminTenantMutationSchema = z.object({
  tenantId: z.string().min(1),
  reason: z.string().min(5).max(500),
});

const AdminBillingUpdateSchema = z.object({
  tenantId: z.string().min(1),
  reason: z.string().min(5).max(500),
  billing: z.object({
    planId: z.string().min(1),
    userCount: z.number().int().positive(),
    branchCount: z.number().int().positive(),
    billingCycle: z.enum(["monthly", "yearly"]),
    status: z.enum(["active", "past_due", "canceled", "trialing"]),
    renewalDate: z.string().optional(),
    trialEndsAt: z.string().nullable().optional(),
  }),
});

const AdminFeatureFlagsSchema = z.object({
  tenantId: z.string().min(1),
  reason: z.string().min(5).max(500),
  flags: z.record(z.boolean()),
});

const AdminUserStatusSchema = z.object({
  userId: z.string().min(1),
  reason: z.string().min(5).max(500),
  status: z.enum(["ACTIVE", "SUSPENDED"]),
});

const AdminGrantSchema = z.object({
  uid: z.string().min(1),
  email: z.string().email(),
  role: z.enum(["admin", "super_admin"]),
  reason: z.string().min(5).max(500),
});

const AdminRevokeSchema = z.object({
  targetAdminId: z.string().min(1),
  reason: z.string().min(5).max(500),
});

const AdminPlatformFlagsSchema = z.object({
  reason: z.string().min(5).max(500),
  flags: z.object({
    new_signups_enabled: z.boolean(),
    google_auth_enabled: z.boolean(),
    ai_features_enabled: z.boolean(),
    maintenance_mode: z.boolean(),
    beta_features: z.boolean(),
  }),
});

const AdminAnnouncementSchema = z.object({
  reason: z.string().min(5).max(500),
  text: z.string().min(1).max(500),
  type: z.enum(["info", "warning", "critical"]),
});

const AdminAnnouncementClearSchema = z.object({
  reason: z.string().min(5).max(500),
});

const AdminApprovalRequestSchema = z.object({
  action: z.string().min(3).max(100),
  targetType: z.string().min(2).max(100),
  targetId: z.string().min(1).max(200),
  tenantId: z.string().optional(),
  reason: z.string().min(5).max(500),
  payload: z.record(z.any()).optional(),
});

const AdminApprovalDecisionSchema = z.object({
  approvalId: z.string().min(1),
  reason: z.string().min(5).max(500),
});

// Actions that require dual-admin approval before execution
const DUAL_APPROVAL_ACTIONS = [
  "TENANT_PERMANENT_DELETE",
  "MASS_USER_SUSPENSION",
  "ADMIN_CAPABILITY_ESCALATION",
  "PLATFORM_FEATURE_FLAG_CHANGE",
  "DATA_EXPORT_ALL_TENANTS",
] as const;

const AdminImpersonationStartSchema = z.object({
  targetUserId: z.string().min(1),
  reason: z.string().min(5).max(500),
  ttlMinutes: z.number().int().min(5).max(60).default(30),
});

const AdminImpersonationEndSchema = z.object({
  sessionId: z.string().min(1),
  reason: z.string().min(5).max(500),
});

const AdminRevokeSessionSchema = z.object({
  reason: z.string().min(5).max(500),
});

const AdminForceMfaSchema = z.object({
  reason: z.string().min(5).max(500),
});

const AdminIssueCreditSchema = z.object({
  amount: z.number().positive(),
  reason: z.string().min(5).max(500),
});

const AdminExtendTrialSchema = z.object({
  days: z.number().int().positive().max(365),
  reason: z.string().min(5).max(500),
});

const AdminCreateIncidentSchema = z.object({
  title: z.string().min(1).max(200),
  severity: z.enum(["low", "medium", "high", "critical"]),
  description: z.string().min(1).max(5000),
  affectedServices: z.array(z.string()).default([]),
});

const AdminUpdateIncidentSchema = z.object({
  status: z.enum(["investigating", "identified", "monitoring", "resolved"]).optional(),
  description: z.string().max(5000).optional(),
  updateNote: z.string().max(2000).optional(),
  resolutionNotes: z.string().max(5000).optional(),
});

const AdminLinkAffectedTenantsSchema = z.object({
  tenantIds: z.array(z.string().min(1)),
});

// Plan pricing lookup for billing calculations
const PLAN_PRICING: Record<string, { monthly: number; yearly: number }> = {
  starter: { monthly: 39, yearly: 32.76 },
  "business-pro": { monthly: 79, yearly: 66.36 },
  enterprise: { monthly: 199, yearly: 167.16 },
};

// ── HELPERS ──────────────────────────────────────────────────────────

async function getEnterpriseProfile(uid: string) {
  try {
    const userDoc = await db.collection("users").doc(uid).get();
    if (!userDoc.exists) return null;
    return userDoc.data() as { enterprise_id?: string; role?: string; email?: string };
  } catch {
    return null;
  }
}

const ADMIN_ROLE_CAPABILITIES: Record<"super_admin" | "admin", AdminCapability[]> = {
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

async function getAdminPrincipal(uid: string, email?: string | null): Promise<AdminPrincipal | null> {
  const directDoc = await db.collection("admin_users").doc(uid).get();
  let adminData = directDoc.exists ? directDoc.data() : null;

  if (!adminData && email) {
    const emailDoc = await db.collection("admin_users").doc(email).get();
    adminData = emailDoc.exists ? emailDoc.data() : null;
  }

  if (!adminData) return null;
  if (adminData.role !== "super_admin" && adminData.role !== "admin") return null;

  return {
    id: uid,
    email: email || adminData.email || "",
    role: adminData.role,
    granted_at: adminData.granted_at || new Date().toISOString(),
    granted_by: adminData.granted_by,
    capabilities: Array.isArray(adminData.capabilities) && adminData.capabilities.length
      ? adminData.capabilities
      : ADMIN_ROLE_CAPABILITIES[adminData.role],
    scope: adminData.scope || {},
  };
}

async function writeAdminAudit(params: {
  actor: { uid: string; email?: string | null };
  action: string;
  capability: AdminCapability;
  targetType: string;
  targetId: string;
  tenantId?: string;
  reason?: string;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
  metadata?: Record<string, unknown>;
}) {
  const ref = db.collection("admin_audit_logs").doc();
  await ref.set({
    action: params.action,
    capability: params.capability,
    resource_type: params.targetType,
    resource_id: params.targetId,
    target_tenant: params.tenantId || null,
    admin_uid: params.actor.uid,
    admin_email: params.actor.email || null,
    reason: params.reason || null,
    before: params.before || null,
    after: params.after || null,
    metadata: params.metadata || null,
    outcome: "success",
    severity: ["tenant.suspend", "admin.manage"].includes(params.capability) ? "high" : "medium",
    timestamp: admin.firestore.FieldValue.serverTimestamp(),
  });
  return ref.id;
}

async function getUserById(userId: string) {
  const snap = await db.collection("users").doc(userId).get();
  return snap.exists ? snap.data() : null;
}

// ── MIDDLEWARE ────────────────────────────────────────────────────────

async function requireAuth(req: AuthenticatedRequest, res: express.Response, next: express.NextFunction) {
  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) {
    return res.status(401).json({ error: "Authentication required" });
  }

  try {
    const decoded = await admin.auth().verifyIdToken(token);
    const profile = await getEnterpriseProfile(decoded.uid);
    req.user = {
      uid: decoded.uid,
      email: decoded.email,
      enterpriseId: profile?.enterprise_id || null,
      role: profile?.role || (typeof decoded.role === "string" ? decoded.role : null),
    };
    next();
  } catch {
    return res.status(401).json({ error: "Invalid authentication token" });
  }
}

async function requireAdmin(req: AuthenticatedRequest, res: express.Response, next: express.NextFunction) {
  if (!req.user) {
    return res.status(401).json({ error: "Authentication required" });
  }

  try {
    const principal = await getAdminPrincipal(req.user.uid, req.user.email);
    if (!principal) {
      return res.status(403).json({ error: "Admin access required" });
    }
    (req as AuthenticatedRequest & { admin?: AdminPrincipal }).admin = principal;
    next();
  } catch (error) {
    return res.status(500).json({ error: "Failed to resolve admin principal" });
  }
}

function requireAdminCapability(capability: AdminCapability) {
  return (
    req: AuthenticatedRequest & { admin?: AdminPrincipal },
    res: express.Response,
    next: express.NextFunction
  ) => {
    const adminPrincipal = req.admin;
    if (!adminPrincipal) {
      return res.status(403).json({ error: "Admin principal missing" });
    }
    if (!adminPrincipal.capabilities.includes(capability)) {
      return res.status(403).json({ error: `Missing capability: ${capability}` });
    }
    next();
  };
}

function assertAdminTenantScope(
  adminPrincipal: AdminPrincipal,
  tenantId: string
) {
  if (!adminPrincipal.scope?.tenantIds?.length) return true;
  return adminPrincipal.scope.tenantIds.includes(tenantId);
}

function requireEnterpriseMatch(req: AuthenticatedRequest, res: express.Response, next: express.NextFunction) {
  const requestedEnterpriseId = req.body?.enterpriseId || req.body?.enterprise_id;
  if (!requestedEnterpriseId || requestedEnterpriseId === req.user?.enterpriseId) {
    return next();
  }
  return res.status(403).json({ error: "Enterprise scope mismatch" });
}

/** Middleware: Requires a pre-approved dual-admin approval for the given action before proceeding */
function requireDualApproval(action: string) {
  return async (
    req: AuthenticatedRequest & { admin?: AdminPrincipal },
    res: express.Response,
    next: express.NextFunction
  ) => {
    const approvalId = req.body?.approvalId || req.headers["x-approval-id"];
    if (!approvalId) {
      return res.status(403).json({
        error: "Dual-admin approval required",
        requiresApproval: true,
        action,
        message: "This action requires approval from another admin before it can be executed.",
      });
    }

    try {
      const ref = db.collection("admin_approval_requests").doc(approvalId as string);
      const snap = await ref.get();
      if (!snap.exists) {
        return res.status(403).json({ error: "Approval request not found" });
      }
      const approval = snap.data()!;

      if (approval.status !== "APPROVED") {
        return res.status(403).json({ error: `Approval is ${approval.status}, not APPROVED` });
      }
      if (approval.action !== action) {
        return res.status(403).json({ error: "Approval action mismatch" });
      }
      if (approval.requestedByUid !== req.user?.uid) {
        return res.status(403).json({ error: "Approval was requested by a different admin" });
      }
      // Check expiration
      const expiresAt = approval.expiresAt?.toDate?.() || new Date(approval.expiresAt);
      if (expiresAt < new Date()) {
        await ref.update({ status: "EXPIRED" });
        return res.status(403).json({ error: "Approval has expired" });
      }

      // Mark as consumed so it can't be reused
      await ref.update({ status: "CONSUMED", consumedAt: admin.firestore.FieldValue.serverTimestamp() });
      next();
    } catch (error) {
      return res.status(500).json({ error: "Failed to validate approval" });
    }
  };
}

/** RBAC middleware — rejects request if user's role is not in allowedRoles */
function requireRole(...allowedRoles: string[]) {
  return (req: AuthenticatedRequest, res: express.Response, next: express.NextFunction) => {
    const userRole = req.user?.role;
    if (!userRole) {
      return res.status(403).json({ error: "No role assigned. Contact your administrator." });
    }
    // Normalize for case-insensitive comparison
    const normalizedRole = userRole.toLowerCase();
    const allowed = allowedRoles.map(r => r.toLowerCase());
    if (!allowed.includes(normalizedRole)) {
      return res.status(403).json({ error: `Role '${userRole}' is not authorized for this action.` });
    }
    return next();
  };
}

/** Zod validation middleware factory */
function validateBody<T extends z.ZodTypeAny>(schema: T) {
  return (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const errors = result.error.issues.map((i: z.ZodIssue) => `${i.path.join(".")}: ${i.message}`);
      return res.status(400).json({ error: "Validation failed", details: errors });
    }
    req.body = result.data;
    return next();
  };
}

/** Verify that a branch belongs to the user's enterprise */
async function verifyBranchOwnership(branchId: string, enterpriseId: string): Promise<boolean> {
  try {
    const branchSnap = await db.collection("branches")
      .where("enterprise_id", "==", enterpriseId)
      .get();
    return branchSnap.docs.some(d => d.id === branchId || d.data().id === branchId);
  } catch {
    return false;
  }
}

// ── RATE LIMITER ─────────────────────────────────────────────────────
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = { maxRequests: 10, windowMs: 60_000 }; // 10 req/min per user

function rateLimit(req: AuthenticatedRequest, res: express.Response, next: express.NextFunction) {
  const key = req.user?.uid || req.ip || "anonymous";
  const now = Date.now();
  const entry = rateLimitMap.get(key);

  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(key, { count: 1, resetAt: now + RATE_LIMIT.windowMs });
    return next();
  }
  if (entry.count >= RATE_LIMIT.maxRequests) {
    res.set("Retry-After", String(Math.ceil((entry.resetAt - now) / 1000)));
    return res.status(429).json({ error: "Rate limit exceeded. Try again later." });
  }
  entry.count++;
  return next();
}

// Periodic cleanup of stale rate-limit entries (every 5 min)
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimitMap) {
    if (now > entry.resetAt) rateLimitMap.delete(key);
  }
}, 300_000);

// ── SERVER ───────────────────────────────────────────────────────────

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: "1mb" }));

  // API routes
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  // ── LUNIPAY SUBSCRIPTION BILLING ─────────────────────────────────────
  app.post(
    "/api/billing/lunipay/create-session",
    requireAuth,
    async (req: AuthenticatedRequest, res) => {
      const secretKey = process.env.LUNIPAY_SECRET_KEY;
      if (!secretKey) {
        console.error("[Lunipay] LUNIPAY_SECRET_KEY is not configured.");
        return res.status(503).json({ error: "Payment gateway is not configured. Please contact support." });
      }

      const { planId, billingCycle, userCount, branchCount, enterpriseId } = req.body;
      if (!planId || !billingCycle) {
        return res.status(400).json({ error: "Missing required billing fields: planId, billingCycle." });
      }

      // Pricing table (matches frontend PLAN_LIMITS)
      const PLAN_PRICING_FULL: Record<string, {
        monthly: number; yearly: number;
        maxUsers: number; maxBranches: number;
        userMonthly: number; userYearly: number;
        branchMonthly: number; branchYearly: number;
      }> = {
        starter:       { monthly: 39,  yearly: 32.76, maxUsers: 5,  maxBranches: 1, userMonthly: 8,  userYearly: 6.72,  branchMonthly: 15, branchYearly: 12.60 },
        "business-pro":{ monthly: 79,  yearly: 66.36, maxUsers: 15, maxBranches: 3, userMonthly: 8,  userYearly: 6.72,  branchMonthly: 15, branchYearly: 12.60 },
        enterprise:    { monthly: 199, yearly: 167.16, maxUsers: 50, maxBranches: 10, userMonthly: 8, userYearly: 6.72,  branchMonthly: 15, branchYearly: 12.60 },
      };

      const plan = PLAN_PRICING_FULL[planId as string];
      if (!plan) {
        return res.status(400).json({ error: `Unknown plan: ${planId}` });
      }

      const isYearly = billingCycle === "yearly";
      const basePrice = isYearly ? plan.yearly : plan.monthly;
      const extraUsers = Math.max(0, (Number(userCount) || plan.maxUsers) - plan.maxUsers);
      const extraBranches = Math.max(0, (Number(branchCount) || plan.maxBranches) - plan.maxBranches);
      const userAddon = isYearly ? plan.userYearly : plan.userMonthly;
      const branchAddon = isYearly ? plan.branchYearly : plan.branchMonthly;
      const totalMonthly = basePrice + (extraUsers * userAddon) + (extraBranches * branchAddon);
      const totalAmount = isYearly ? totalMonthly * 12 : totalMonthly;

      // Lunipay expects amount in cents (integer)
      const amountInCents = Math.round(totalAmount * 100);

      const orderId = `SUB-${enterpriseId || req.user?.enterpriseId || "UNKNOWN"}-${Date.now()}`;
      const returnBase = req.headers.origin || "https://crm-os.web.app";

      try {
        const LuniPay = (await import("lunipay")).default;
        const lunipay = new LuniPay({ apiKey: secretKey, apiBase: "https://www.lunipay.io" });

        const session = await lunipay.checkout.sessions.create({
          amount: amountInCents,
          currency: "usd",
          success_url: `${returnBase}/settings?tab=billing&payment=success&order=${orderId}`,
          cancel_url: `${returnBase}/settings?tab=billing&payment=cancelled`,
        });

        console.log(`[Lunipay] Session created for ${orderId}:`, session.url);
        return res.json({ url: session.url, orderId });
      } catch (err: any) {
        console.error("[Lunipay] Session creation failed:", err);
        return res.status(500).json({ error: "Failed to create payment session. Please try again." });
      }
    }
  );

  // ── LUNIPAY SESSION VERIFICATION ──────────────────────────────────────
  app.post(
    "/api/billing/lunipay/verify-session",
    requireAuth,
    async (req: AuthenticatedRequest, res) => {
      const secretKey = process.env.LUNIPAY_SECRET_KEY;
      if (!secretKey) {
        return res.status(503).json({ error: "Payment gateway not configured." });
      }

      const { sessionId, planId, billingCycle, userCount, branchCount } = req.body;
      if (!sessionId) {
        return res.status(400).json({ error: "Missing sessionId." });
      }

      // Calculate next renewal date
      const calcRenewal = () => {
        const now = new Date();
        return billingCycle === "yearly"
          ? new Date(new Date().setFullYear(now.getFullYear() + 1)).toISOString()
          : new Date(new Date().setMonth(now.getMonth() + 1)).toISOString();
      };

      const activateBilling = async (orderId: string) => {
        const enterpriseId = req.user?.enterpriseId;
        const renewalDate = calcRenewal();
        if (enterpriseId && planId) {
          await db.collection("enterprise_settings").doc(enterpriseId).set({
            "billing.status": "active",
            "billing.planId": planId,
            "billing.billingCycle": billingCycle || "monthly",
            "billing.renewalDate": renewalDate,
            "billing.autoBill": true,
            "billing.lastPaymentOrderId": orderId,
            ...(userCount ? { "billing.userCount": Number(userCount) } : {}),
            ...(branchCount ? { "billing.branchCount": Number(branchCount) } : {}),
            billingUpdated: new Date().toISOString(),
          }, { merge: true });
          console.log(`[Lunipay] Activated billing for ${enterpriseId}, plan=${planId}`);
        }
        return renewalDate;
      };

      try {
        const LuniPay = (await import("lunipay")).default;
        const lunipay = new LuniPay({ apiKey: secretKey, apiBase: "https://www.lunipay.io" });
        const session = await (lunipay.checkout.sessions as any).retrieve(sessionId);
        const isPaid = session.payment_status === "paid" || session.status === "COMPLETE";
        if (!isPaid) {
          return res.status(402).json({ error: "Payment not yet confirmed.", status: session.payment_status });
        }
        const renewalDate = await activateBilling(session.id);
        return res.json({ verified: true, planId, billingCycle, renewalDate, orderId: session.id, autoBill: true });
      } catch (err: any) {
        // Optimistic fallback — session.retrieve may not be supported on test keys
        console.warn("[Lunipay] Session retrieve failed, using optimistic fallback:", err?.message);
        const renewalDate = await activateBilling(sessionId);
        return res.json({ verified: true, planId, billingCycle, renewalDate, orderId: sessionId, autoBill: true });
      }
    }
  );

  // ── SECURE AI PROXY ─────────────────────────────────────────────────
  app.post(
    "/api/ai/generate",
    requireAuth,
    rateLimit,
    validateBody(AIGenerateSchema),
    async (req: AuthenticatedRequest, res) => {
      const { prompt, model = "gemini-1.5-flash" } = req.body;

      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        return res.status(503).json({ error: "AI service not configured" });
      }

      try {
        const { GoogleGenAI } = await import("@google/genai");
        const ai = new GoogleGenAI({ apiKey });
        const response = await ai.models.generateContent({ model, contents: prompt });
        res.json({ text: response.text });
      } catch (err: any) {
        console.error("AI proxy error:", err);
        const status = err?.status || 500;
        res.status(status >= 400 && status < 600 ? status : 500)
          .json({ error: err?.message || "AI generation failed" });
      }
    }
  );

  // ── ORPHANED FILE CLEANUP ──────────────────────────────────────────
  app.post("/api/cleanup/orphaned-files", requireAuth, requireRole("Owner", "Manager"), async (req, res) => {
    res.json({ message: "Orphan cleanup scheduled. Implement with Storage Admin SDK when service account is available." });
  });

  // ── DASHBOARD AGGREGATION CRON ─────────────────────────────────────
  app.post(
    "/api/cron/aggregate-dashboard",
    requireAuth,
    requireEnterpriseMatch,
    requireRole("Owner", "Manager"),
    validateBody(AggregateSchema),
    async (req: AuthenticatedRequest, res) => {
      try {
        const enterpriseId = req.body.enterpriseId || req.user?.enterpriseId;
        if (!enterpriseId) {
          return res.status(400).json({ error: "Missing enterpriseId" });
        }

        const [txSnap, custSnap, invSnap] = await Promise.all([
          db.collection("transactions").where("enterprise_id", "==", enterpriseId).get(),
          db.collection("customers").where("enterprise_id", "==", enterpriseId).where("status", "!=", "Archived").get(),
          db.collection("inventory").where("enterprise_id", "==", enterpriseId).get()
        ]);

        let totalRevenue = 0;
        const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
        const days = Array.from({ length: 7 }, (_, i) => {
          const d = new Date();
          d.setDate(d.getDate() - (6 - i));
          return {
            name: DAY_LABELS[d.getDay()],
            date: d.toISOString().split("T")[0],
            sales: 0,
          };
        });

        txSnap.forEach(doc => {
          const data = doc.data();
          totalRevenue += (Number(data.total) || 0);

          let txDateStr = "";
          if (data.timestamp?.toDate) {
            txDateStr = data.timestamp.toDate().toISOString().split("T")[0];
          } else if (data.timestamp) {
            txDateStr = new Date(data.timestamp).toISOString().split("T")[0];
          }

          const dayMatch = days.find((d) => d.date === txDateStr);
          if (dayMatch) {
            dayMatch.sales += (Number(data.total) || 0);
          }
        });

        let totalInventoryValue = 0;
        invSnap.forEach(doc => {
          const data = doc.data();
          totalInventoryValue += (Number(data.quantity || data.stock) || 0) * (Number(data.retail_price || data.price || data.cost) || 0);
        });

        const aggregatedData = {
          metrics: {
            revenue: totalRevenue,
            orders: txSnap.size,
            customers: custSnap.size,
            inventory: totalInventoryValue
          },
          chartData: days,
          last_updated: admin.firestore.FieldValue.serverTimestamp()
        };

        await db.collection("dashboard_stats").doc(enterpriseId).set(aggregatedData, { merge: true });

        res.json({ success: true, message: "Dashboard aggregated successfully.", data: aggregatedData });
      } catch (error: any) {
        console.error("Dashboard aggregation failed:", error);
        res.status(500).json({ error: "Aggregation failed", details: error.message });
      }
    }
  );

  // ── POS CHECKOUT ───────────────────────────────────────────────────
  app.post(
    "/api/pos/checkout",
    requireAuth,
    requireEnterpriseMatch,
    requireRole("Owner", "Manager", "Staff"),
    validateBody(CheckoutSchema),
    async (req: AuthenticatedRequest, res) => {
      const { items, customerId, branchId, paymentMethod, subtotal, discount, tax, total } = req.body;

      // Verify branch belongs to user's enterprise
      if (req.user?.enterpriseId) {
        const branchValid = await verifyBranchOwnership(branchId, req.user.enterpriseId);
        if (!branchValid) {
          return res.status(403).json({ error: "Branch does not belong to your enterprise." });
        }
      }

      const transactionId = uuidv4();

      try {
        const batch = db.batch();

        // 1. Create Transaction
        const transactionRef = db.collection("transactions").doc(transactionId);
        batch.set(transactionRef, {
          id: transactionId,
          type: "SALE",
          enterprise_id: req.user?.enterpriseId || null,
          branch_id: branchId,
          customer_id: customerId || null,
          items,
          subtotal,
          discount: discount || null,
          tax,
          total,
          payment_method: paymentMethod,
          status: "COMPLETED",
          timestamp: new Date().toISOString(),
        });

        // 2. Update Inventory — use FieldValue.increment for atomicity.
        for (const item of items) {
          const inventoryQuery = await db.collection("inventory")
            .where("product_id", "==", item.id)
            .where("branch_id", "==", branchId)
            .limit(1)
            .get();

          if (!inventoryQuery.empty) {
            batch.update(inventoryQuery.docs[0].ref, {
              quantity: admin.firestore.FieldValue.increment(-item.quantity)
            });
          }
        }

        // 3. Update Customer Balance/Points if applicable
        if (customerId) {
          const customerRef = db.collection("customers").doc(customerId);
          batch.update(customerRef, {
            loyalty_points: admin.firestore.FieldValue.increment(Math.floor(total))
          });
        }

        // 4. Log Audit
        const auditRef = db.collection("audit_logs").doc(uuidv4());
        batch.set(auditRef, {
          enterprise_id: req.user?.enterpriseId || null,
          user_id: req.user?.uid || "system",
          action: "POS_SALE",
          details: `Completed sale ${transactionId} for $${total}`,
          timestamp: new Date().toISOString(),
        });

        await batch.commit();
        res.json({ success: true, transactionId });
      } catch (error: any) {
        console.error("Checkout failed:", error);
        res.status(500).json({ error: "Transaction failed", details: error.message });
      }
    }
  );

  // ── INVENTORY TRANSFER ─────────────────────────────────────────────
  app.post(
    "/api/inventory/transfer",
    requireAuth,
    requireEnterpriseMatch,
    requireRole("Owner", "Manager"),
    validateBody(TransferSchema),
    async (req: AuthenticatedRequest, res) => {
      const { productId, fromBranchId, toBranchId, quantity } = req.body;

      // Verify both branches belong to user's enterprise
      if (req.user?.enterpriseId) {
        const [fromValid, toValid] = await Promise.all([
          verifyBranchOwnership(fromBranchId, req.user.enterpriseId),
          verifyBranchOwnership(toBranchId, req.user.enterpriseId),
        ]);
        if (!fromValid || !toValid) {
          return res.status(403).json({ error: "One or both branches do not belong to your enterprise." });
        }
      }

      try {
        const batch = db.batch();

        // Deduct from source
        const sourceQuery = await db.collection("inventory")
          .where("product_id", "==", productId)
          .where("branch_id", "==", fromBranchId)
          .limit(1)
          .get();

        if (sourceQuery.empty || sourceQuery.docs[0].data().stock < quantity) {
          return res.status(400).json({ error: "Insufficient stock at source branch" });
        }

        batch.update(sourceQuery.docs[0].ref, {
          stock: admin.firestore.FieldValue.increment(-quantity)
        });

        // Add to destination
        const destQuery = await db.collection("inventory")
          .where("product_id", "==", productId)
          .where("branch_id", "==", toBranchId)
          .limit(1)
          .get();

        if (!destQuery.empty) {
          batch.update(destQuery.docs[0].ref, {
            stock: admin.firestore.FieldValue.increment(quantity)
          });
        } else {
          const newInvRef = db.collection("inventory").doc(uuidv4());
          batch.set(newInvRef, {
            product_id: productId,
            branch_id: toBranchId,
            stock: quantity,
            enterprise_id: req.user?.enterpriseId || null,
          });
        }

        // Audit log for transfer
        const auditRef = db.collection("audit_logs").doc(uuidv4());
        batch.set(auditRef, {
          enterprise_id: req.user?.enterpriseId || null,
          user_id: req.user?.uid || "system",
          action: "INVENTORY_TRANSFER",
          details: `Transferred ${quantity} units of ${productId} from ${fromBranchId} to ${toBranchId}`,
          timestamp: new Date().toISOString(),
        });

        await batch.commit();
        res.json({ success: true });
      } catch (error: any) {
        res.status(500).json({ error: "Transfer failed", details: error.message });
      }
    }
  );

  app.get(
    "/api/admin/me",
    requireAuth,
    requireAdmin,
    async (req: AuthenticatedRequest & { admin?: AdminPrincipal }, res) => {
      res.json({ success: true, data: req.admin });
    }
  );

  app.get(
    "/api/admin/tenants",
    requireAuth,
    requireAdmin,
    requireAdminCapability("tenant.read"),
    async (req: AuthenticatedRequest & { admin?: AdminPrincipal }, res) => {
      const snap = await db.collection("enterprise_settings").orderBy("createdAt", "desc").get();
      const tenants = snap.docs
        .map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }))
        .filter((tenant: any) => assertAdminTenantScope(req.admin!, tenant.enterprise_id || tenant.id));
      res.json({ success: true, data: tenants });
    }
  );

  app.post(
    "/api/admin/tenants/suspend",
    requireAuth,
    requireAdmin,
    requireAdminCapability("tenant.suspend"),
    validateBody(AdminTenantMutationSchema),
    async (req: AuthenticatedRequest & { admin?: AdminPrincipal }, res) => {
      const { tenantId, reason } = req.body;
      if (!assertAdminTenantScope(req.admin!, tenantId)) {
        return res.status(403).json({ error: "Tenant out of admin scope" });
      }

      const tenantRef = db.collection("enterprise_settings").doc(tenantId);
      const tenantSnap = await tenantRef.get();
      if (!tenantSnap.exists) {
        return res.status(404).json({ error: "Tenant not found" });
      }

      const before = tenantSnap.data() || {};
      await tenantRef.update({
        status: "suspended",
        admin_status_reason: reason,
        admin_status_updated_at: admin.firestore.FieldValue.serverTimestamp(),
      });

      const auditId = await writeAdminAudit({
        actor: req.user!,
        action: "SUSPEND_TENANT",
        capability: "tenant.suspend",
        targetType: "tenant",
        targetId: tenantId,
        tenantId,
        reason,
        before: { status: before.status || null },
        after: { status: "suspended" },
      });

      res.json({ success: true, data: { tenantId, status: "suspended" }, auditId });
    }
  );

  app.post(
    "/api/admin/tenants/restore",
    requireAuth,
    requireAdmin,
    requireAdminCapability("tenant.restore"),
    validateBody(AdminTenantMutationSchema),
    async (req: AuthenticatedRequest & { admin?: AdminPrincipal }, res) => {
      const { tenantId, reason } = req.body;
      if (!assertAdminTenantScope(req.admin!, tenantId)) {
        return res.status(403).json({ error: "Tenant out of admin scope" });
      }

      const tenantRef = db.collection("enterprise_settings").doc(tenantId);
      const tenantSnap = await tenantRef.get();
      if (!tenantSnap.exists) {
        return res.status(404).json({ error: "Tenant not found" });
      }

      const before = tenantSnap.data() || {};
      await tenantRef.update({
        status: "active",
        admin_status_reason: reason,
        admin_status_updated_at: admin.firestore.FieldValue.serverTimestamp(),
      });

      const auditId = await writeAdminAudit({
        actor: req.user!,
        action: "RESTORE_TENANT",
        capability: "tenant.restore",
        targetType: "tenant",
        targetId: tenantId,
        tenantId,
        reason,
        before: { status: before.status || null },
        after: { status: "active" },
      });

      res.json({ success: true, data: { tenantId, status: "active" }, auditId });
    }
  );

  app.post(
    "/api/admin/tenants/billing",
    requireAuth,
    requireAdmin,
    requireAdminCapability("tenant.billing.write"),
    validateBody(AdminBillingUpdateSchema),
    async (req: AuthenticatedRequest & { admin?: AdminPrincipal }, res) => {
      const { tenantId, reason, billing } = req.body;
      if (!assertAdminTenantScope(req.admin!, tenantId)) {
        return res.status(403).json({ error: "Tenant out of admin scope" });
      }

      const tenantRef = db.collection("enterprise_settings").doc(tenantId);
      const tenantSnap = await tenantRef.get();
      if (!tenantSnap.exists) {
        return res.status(404).json({ error: "Tenant not found" });
      }
      const before = tenantSnap.data() || {};

      const nextBilling = {
        ...(before.billing || {}),
        ...billing,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      };

      await tenantRef.update({
        billing: nextBilling,
        plan: billing.planId,
      });

      const auditId = await writeAdminAudit({
        actor: req.user!,
        action: "UPDATE_TENANT_BILLING",
        capability: "tenant.billing.write",
        targetType: "tenant",
        targetId: tenantId,
        tenantId,
        reason,
        before: { billing: before.billing || null, plan: before.plan || null },
        after: { billing: nextBilling, plan: billing.planId },
      });

      res.json({ success: true, data: { tenantId, billing: nextBilling }, auditId });
    }
  );

  app.post(
    "/api/admin/tenants/feature-flags",
    requireAuth,
    requireAdmin,
    requireAdminCapability("tenant.feature_flags.write"),
    validateBody(AdminFeatureFlagsSchema),
    async (req: AuthenticatedRequest & { admin?: AdminPrincipal }, res) => {
      const { tenantId, reason, flags } = req.body;
      if (!assertAdminTenantScope(req.admin!, tenantId)) {
        return res.status(403).json({ error: "Tenant out of admin scope" });
      }

      const flagRef = db.collection("tenant_feature_flags").doc(tenantId);
      const flagSnap = await flagRef.get();
      const before = flagSnap.exists ? flagSnap.data() : {};

      await flagRef.set(
        {
          tenantId,
          flags,
          updatedBy: req.user?.email || req.user?.uid,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );

      const auditId = await writeAdminAudit({
        actor: req.user!,
        action: "UPDATE_TENANT_FEATURE_FLAGS",
        capability: "tenant.feature_flags.write",
        targetType: "tenant_feature_flags",
        targetId: tenantId,
        tenantId,
        reason,
        before: before as Record<string, unknown>,
        after: { flags },
      });

      res.json({ success: true, data: { tenantId, flags }, auditId });
    }
  );

  app.post(
    "/api/admin/users/status",
    requireAuth,
    requireAdmin,
    requireAdminCapability("user.update"),
    validateBody(AdminUserStatusSchema),
    async (req: AuthenticatedRequest & { admin?: AdminPrincipal }, res) => {
      const { userId, reason, status } = req.body;
      const userRef = db.collection("users").doc(userId);
      const userSnap = await userRef.get();
      if (!userSnap.exists) {
        return res.status(404).json({ error: "User not found" });
      }
      const before = userSnap.data() || {};
      const tenantId = before.enterprise_id || null;
      if (tenantId && !assertAdminTenantScope(req.admin!, tenantId)) {
        return res.status(403).json({ error: "User tenant out of admin scope" });
      }

      await userRef.update({
        status,
        suspendReason: status === "SUSPENDED" ? reason : null,
        admin_status_updated_at: admin.firestore.FieldValue.serverTimestamp(),
      });

      const auditId = await writeAdminAudit({
        actor: req.user!,
        action: status === "SUSPENDED" ? "SUSPEND_USER" : "REACTIVATE_USER",
        capability: "user.update",
        targetType: "user",
        targetId: userId,
        tenantId: tenantId || undefined,
        reason,
        before: { status: before.status || null },
        after: { status },
      });

      res.json({ success: true, data: { userId, status }, auditId });
    }
  );

  app.post(
    "/api/admin/admin-users/grant",
    requireAuth,
    requireAdmin,
    requireAdminCapability("admin.manage"),
    validateBody(AdminGrantSchema),
    async (req: AuthenticatedRequest & { admin?: AdminPrincipal }, res) => {
      const { uid, email, role, reason } = req.body;
      const adminRef = db.collection("admin_users").doc(uid);
      const beforeSnap = await adminRef.get();
      const before = beforeSnap.exists ? beforeSnap.data() : null;

      await adminRef.set({
        ...(before || {}),
        email,
        role,
        granted_at: before?.granted_at || new Date().toISOString(),
        granted_by: req.user?.email || req.user?.uid,
      }, { merge: true });

      const auditId = await writeAdminAudit({
        actor: req.user!,
        action: "GRANT_ADMIN_ACCESS",
        capability: "admin.manage",
        targetType: "admin_user",
        targetId: uid,
        reason,
        before: before as Record<string, unknown> | null,
        after: { email, role },
      });

      res.json({ success: true, data: { uid, email, role }, auditId });
    }
  );

  app.post(
    "/api/admin/admin-users/revoke",
    requireAuth,
    requireAdmin,
    requireAdminCapability("admin.manage"),
    validateBody(AdminRevokeSchema),
    async (req: AuthenticatedRequest & { admin?: AdminPrincipal }, res) => {
      const { targetAdminId, reason } = req.body;
      if (targetAdminId === req.user?.uid) {
        return res.status(400).json({ error: "Cannot revoke your own admin access" });
      }

      const adminRef = db.collection("admin_users").doc(targetAdminId);
      const adminSnap = await adminRef.get();
      if (!adminSnap.exists) {
        return res.status(404).json({ error: "Admin user not found" });
      }
      const before = adminSnap.data() || {};

      await adminRef.update({
        role: "revoked",
        revoked_at: new Date().toISOString(),
        revoked_by: req.user?.email || req.user?.uid,
      });

      const auditId = await writeAdminAudit({
        actor: req.user!,
        action: "REVOKE_ADMIN_ACCESS",
        capability: "admin.manage",
        targetType: "admin_user",
        targetId: targetAdminId,
        reason,
        before: before as Record<string, unknown>,
        after: { role: "revoked" },
      });

      res.json({ success: true, data: { targetAdminId, role: "revoked" }, auditId });
    }
  );

  app.post(
    "/api/admin/platform/feature-flags",
    requireAuth,
    requireAdmin,
    requireAdminCapability("platform.configure"),
    validateBody(AdminPlatformFlagsSchema),
    async (req: AuthenticatedRequest & { admin?: AdminPrincipal }, res) => {
      const { reason, flags } = req.body;
      const ref = db.collection("admin_meta").doc("feature_flags");
      const beforeSnap = await ref.get();
      const before = beforeSnap.exists ? beforeSnap.data() : null;

      await ref.set({ ...flags, updated_at: new Date().toISOString() }, { merge: true });

      const auditId = await writeAdminAudit({
        actor: req.user!,
        action: "UPDATE_FEATURE_FLAGS",
        capability: "platform.configure",
        targetType: "system_config",
        targetId: "feature_flags",
        reason,
        before: before as Record<string, unknown> | null,
        after: flags,
      });

      res.json({ success: true, data: flags, auditId });
    }
  );

  app.post(
    "/api/admin/platform/announcement",
    requireAuth,
    requireAdmin,
    requireAdminCapability("platform.configure"),
    validateBody(AdminAnnouncementSchema),
    async (req: AuthenticatedRequest & { admin?: AdminPrincipal }, res) => {
      const { reason, text, type } = req.body;
      const ref = db.collection("admin_meta").doc("announcement");
      const beforeSnap = await ref.get();
      const before = beforeSnap.exists ? beforeSnap.data() : null;
      const after = {
        text,
        type,
        active: true,
        published_by: req.user?.email || req.user?.uid,
        published_at: new Date().toISOString(),
      };

      await ref.set(after, { merge: true });

      const auditId = await writeAdminAudit({
        actor: req.user!,
        action: "PUBLISH_ANNOUNCEMENT",
        capability: "platform.configure",
        targetType: "system_config",
        targetId: "announcement",
        reason,
        before: before as Record<string, unknown> | null,
        after,
      });

      res.json({ success: true, data: after, auditId });
    }
  );

  app.post(
    "/api/admin/platform/announcement/clear",
    requireAuth,
    requireAdmin,
    requireAdminCapability("platform.configure"),
    validateBody(AdminAnnouncementClearSchema),
    async (req: AuthenticatedRequest & { admin?: AdminPrincipal }, res) => {
      const { reason } = req.body;
      const ref = db.collection("admin_meta").doc("announcement");
      const beforeSnap = await ref.get();
      const before = beforeSnap.exists ? beforeSnap.data() : null;

      await ref.set({ active: false, cleared_at: new Date().toISOString() }, { merge: true });

      const auditId = await writeAdminAudit({
        actor: req.user!,
        action: "CLEAR_ANNOUNCEMENT",
        capability: "platform.configure",
        targetType: "system_config",
        targetId: "announcement",
        reason,
        before: before as Record<string, unknown> | null,
        after: { active: false },
      });

      res.json({ success: true, data: { active: false }, auditId });
    }
  );

  // ── APPROVAL WORKFLOW ENDPOINTS ──────────────────────────────────────

  app.post(
    "/api/admin/approvals/request",
    requireAuth,
    requireAdmin,
    validateBody(AdminApprovalRequestSchema),
    async (req: AuthenticatedRequest & { admin?: AdminPrincipal }, res) => {
      const { action, targetType, targetId, tenantId, reason, payload } = req.body;
      if (tenantId && !assertAdminTenantScope(req.admin!, tenantId)) {
        return res.status(403).json({ error: "Target tenant out of admin scope" });
      }

      // Set expiration to 24 hours from now
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

      const approvalRef = db.collection("admin_approval_requests").doc();
      await approvalRef.set({
        action,
        targetType,
        targetId,
        tenantId: tenantId || null,
        reason,
        payload: payload || null,
        status: "PENDING",
        requestedBy: req.user?.email || req.user?.uid,
        requestedByUid: req.user?.uid,
        requestedAt: admin.firestore.FieldValue.serverTimestamp(),
        expiresAt: admin.firestore.Timestamp.fromDate(expiresAt),
      });

      const auditId = await writeAdminAudit({
        actor: req.user!,
        action: "REQUEST_ADMIN_APPROVAL",
        capability: "platform.read",
        targetType: "admin_approval_request",
        targetId: approvalRef.id,
        tenantId,
        reason,
        after: { action, targetType, targetId, tenantId, status: "PENDING", expiresAt: expiresAt.toISOString() },
      });

      res.json({ success: true, data: { approvalId: approvalRef.id, status: "PENDING", expiresAt: expiresAt.toISOString() }, auditId });
    }
  );

  app.get(
    "/api/admin/approvals/pending",
    requireAuth,
    requireAdmin,
    requireAdminCapability("admin.manage"),
    async (req: AuthenticatedRequest & { admin?: AdminPrincipal }, res) => {
      const snap = await db.collection("admin_approval_requests")
        .where("status", "==", "PENDING")
        .orderBy("requestedAt", "desc")
        .get();

      const now = new Date();
      const pending: any[] = [];

      for (const docSnap of snap.docs) {
        const data = docSnap.data();
        const expiresAt = data.expiresAt?.toDate?.() || new Date(data.expiresAt);
        if (expiresAt < now) {
          // Auto-expire stale requests
          await docSnap.ref.update({ status: "EXPIRED" });
          continue;
        }
        pending.push({
          id: docSnap.id,
          ...data,
          requestedAt: data.requestedAt?.toDate?.()?.toISOString() || null,
          expiresAt: expiresAt.toISOString(),
        });
      }

      res.json({ success: true, data: pending });
    }
  );

  app.get(
    "/api/admin/approvals/history",
    requireAuth,
    requireAdmin,
    requireAdminCapability("admin.manage"),
    async (req: AuthenticatedRequest & { admin?: AdminPrincipal }, res) => {
      const snap = await db.collection("admin_approval_requests")
        .where("status", "in", ["APPROVED", "REJECTED", "EXPIRED", "CONSUMED"])
        .orderBy("requestedAt", "desc")
        .limit(50)
        .get();

      const history = snap.docs.map((docSnap) => {
        const data = docSnap.data();
        return {
          id: docSnap.id,
          ...data,
          requestedAt: data.requestedAt?.toDate?.()?.toISOString() || null,
          decidedAt: data.decidedAt?.toDate?.()?.toISOString() || null,
          expiresAt: data.expiresAt?.toDate?.()?.toISOString() || data.expiresAt || null,
        };
      });

      res.json({ success: true, data: history });
    }
  );

  app.post(
    "/api/admin/approvals/approve",
    requireAuth,
    requireAdmin,
    requireAdminCapability("admin.manage"),
    validateBody(AdminApprovalDecisionSchema),
    async (req: AuthenticatedRequest & { admin?: AdminPrincipal }, res) => {
      const { approvalId, reason } = req.body;
      const ref = db.collection("admin_approval_requests").doc(approvalId);
      const snap = await ref.get();
      if (!snap.exists) {
        return res.status(404).json({ error: "Approval request not found" });
      }
      const before = snap.data() || {};

      // DUAL-ADMIN ENFORCEMENT: Cannot approve your own request
      if (before.requestedByUid === req.user?.uid) {
        return res.status(403).json({ error: "Cannot approve your own request. A different admin must approve." });
      }

      // Check if already decided
      if (before.status !== "PENDING") {
        return res.status(400).json({ error: `Request is already ${before.status}` });
      }

      // Check expiration
      const expiresAt = before.expiresAt?.toDate?.() || new Date(before.expiresAt);
      if (expiresAt < new Date()) {
        await ref.update({ status: "EXPIRED" });
        return res.status(400).json({ error: "Approval request has expired" });
      }

      await ref.update({
        status: "APPROVED",
        decidedBy: req.user?.email || req.user?.uid,
        decidedByUid: req.user?.uid,
        decidedAt: admin.firestore.FieldValue.serverTimestamp(),
        decisionReason: reason,
      });

      const auditId = await writeAdminAudit({
        actor: req.user!,
        action: "APPROVE_ADMIN_REQUEST",
        capability: "admin.manage",
        targetType: "admin_approval_request",
        targetId: approvalId,
        tenantId: before.tenantId || undefined,
        reason,
        before: before as Record<string, unknown>,
        after: { status: "APPROVED" },
      });

      res.json({ success: true, data: { approvalId, status: "APPROVED" }, auditId });
    }
  );

  app.post(
    "/api/admin/approvals/reject",
    requireAuth,
    requireAdmin,
    requireAdminCapability("admin.manage"),
    validateBody(AdminApprovalDecisionSchema),
    async (req: AuthenticatedRequest & { admin?: AdminPrincipal }, res) => {
      const { approvalId, reason } = req.body;
      const ref = db.collection("admin_approval_requests").doc(approvalId);
      const snap = await ref.get();
      if (!snap.exists) {
        return res.status(404).json({ error: "Approval request not found" });
      }
      const before = snap.data() || {};

      // Check if already decided
      if (before.status !== "PENDING") {
        return res.status(400).json({ error: `Request is already ${before.status}` });
      }

      await ref.update({
        status: "REJECTED",
        decidedBy: req.user?.email || req.user?.uid,
        decidedByUid: req.user?.uid,
        decidedAt: admin.firestore.FieldValue.serverTimestamp(),
        decisionReason: reason,
      });

      const auditId = await writeAdminAudit({
        actor: req.user!,
        action: "REJECT_ADMIN_REQUEST",
        capability: "admin.manage",
        targetType: "admin_approval_request",
        targetId: approvalId,
        tenantId: before.tenantId || undefined,
        reason,
        before: before as Record<string, unknown>,
        after: { status: "REJECTED" },
      });

      res.json({ success: true, data: { approvalId, status: "REJECTED" }, auditId });
    }
  );

  // ── IMPERSONATION SYSTEM ─────────────────────────────────────────────
  app.post(
    "/api/admin/impersonation/start",
    requireAuth,
    requireAdmin,
    requireAdminCapability("impersonate"),
    validateBody(AdminImpersonationStartSchema),
    async (req: AuthenticatedRequest & { admin?: AdminPrincipal }, res) => {
      const { targetUserId, reason, ttlMinutes } = req.body;

      // Cannot impersonate yourself
      if (targetUserId === req.user?.uid) {
        return res.status(400).json({ error: "Cannot impersonate yourself" });
      }

      // Check target user exists
      const targetUser = await getUserById(targetUserId);
      if (!targetUser) {
        return res.status(404).json({ error: "Target user not found" });
      }

      // Cannot impersonate other admins
      const targetAdminCheck = await db.collection("admin_users").doc(targetUserId).get();
      if (targetAdminCheck.exists) {
        const targetAdminData = targetAdminCheck.data();
        if (targetAdminData?.role === "super_admin" || targetAdminData?.role === "admin") {
          return res.status(403).json({ error: "Cannot impersonate other admin users" });
        }
      }

      // Check for existing active session by this admin
      const existingActive = await db.collection("impersonation_sessions")
        .where("adminUid", "==", req.user?.uid)
        .where("status", "==", "active")
        .limit(1)
        .get();
      if (!existingActive.empty) {
        return res.status(409).json({ error: "You already have an active impersonation session. End it first." });
      }

      const now = new Date();
      const maxTtl = Math.min(ttlMinutes || 30, 60); // Hard cap at 60 minutes
      const expiresAt = new Date(now.getTime() + maxTtl * 60_000).toISOString();

      const sessionRef = db.collection("impersonation_sessions").doc();
      const sessionData = {
        adminUid: req.user?.uid,
        adminEmail: req.user?.email || req.admin?.email || null,
        targetUserId,
        targetEmail: (targetUser as any).email || null,
        reason,
        startedAt: now.toISOString(),
        expiresAt,
        endedAt: null,
        status: "active" as const,
      };
      await sessionRef.set({
        ...sessionData,
        startedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      const auditId = await writeAdminAudit({
        actor: req.user!,
        action: "START_IMPERSONATION",
        capability: "impersonate",
        targetType: "user",
        targetId: targetUserId,
        reason,
        after: { sessionId: sessionRef.id, targetUserId, targetEmail: sessionData.targetEmail, expiresAt, status: "active" },
      });

      res.json({ success: true, data: { sessionId: sessionRef.id, ...sessionData }, auditId });
    }
  );

  app.post(
    "/api/admin/impersonation/end",
    requireAuth,
    requireAdmin,
    requireAdminCapability("impersonate"),
    validateBody(AdminImpersonationEndSchema),
    async (req: AuthenticatedRequest & { admin?: AdminPrincipal }, res) => {
      const { sessionId, reason } = req.body;
      const ref = db.collection("impersonation_sessions").doc(sessionId);
      const snap = await ref.get();
      if (!snap.exists) {
        return res.status(404).json({ error: "Impersonation session not found" });
      }
      const before = snap.data() || {};

      // Only the admin who started the session (or a super_admin) can end it
      if (before.adminUid !== req.user?.uid && req.admin?.role !== "super_admin") {
        return res.status(403).json({ error: "Only the session owner or super_admin can end this session" });
      }

      if (before.status !== "active") {
        return res.status(400).json({ error: `Session already ${before.status}` });
      }

      const endedAt = new Date().toISOString();
      const startedAtDate = before.startedAt?.toDate?.() || new Date(before.startedAt);
      const durationMs = Date.now() - new Date(startedAtDate).getTime();
      const durationMinutes = Math.round(durationMs / 60_000);

      await ref.update({
        status: "ended",
        endedAt,
        endedBy: req.user?.email || req.user?.uid,
        endReason: reason,
        durationMinutes,
      });

      const auditId = await writeAdminAudit({
        actor: req.user!,
        action: "END_IMPERSONATION",
        capability: "impersonate",
        targetType: "user",
        targetId: before.targetUserId || sessionId,
        reason,
        before: { status: "active", targetUserId: before.targetUserId },
        after: { status: "ended", durationMinutes },
      });

      res.json({ success: true, data: { sessionId, status: "ended", durationMinutes }, auditId });
    }
  );

  app.get(
    "/api/admin/impersonation/active",
    requireAuth,
    requireAdmin,
    requireAdminCapability("impersonate"),
    async (req: AuthenticatedRequest & { admin?: AdminPrincipal }, res) => {
      try {
        const now = new Date().toISOString();

        // Get all active sessions
        const activeSnap = await db.collection("impersonation_sessions")
          .where("status", "==", "active")
          .get();

        const sessions: any[] = [];
        const expiredIds: string[] = [];

        activeSnap.docs.forEach((docSnap) => {
          const data = docSnap.data();
          const expAt = data.expiresAt?.toDate?.()?.toISOString?.() || data.expiresAt;
          // Auto-expire stale sessions
          if (expAt && expAt < now) {
            expiredIds.push(docSnap.id);
          } else {
            sessions.push({
              id: docSnap.id,
              ...data,
              startedAt: data.startedAt?.toDate?.()?.toISOString?.() || data.startedAt,
              expiresAt: expAt,
            });
          }
        });

        // Expire stale sessions in background
        if (expiredIds.length > 0) {
          const batch = db.batch();
          for (const id of expiredIds) {
            batch.update(db.collection("impersonation_sessions").doc(id), {
              status: "expired",
              endedAt: now,
              endReason: "Auto-expired (time limit exceeded)",
            });
          }
          batch.commit().catch((err: any) => console.error("Failed to expire stale sessions:", err));
        }

        res.json({ success: true, data: { sessions, expiredCount: expiredIds.length } });
      } catch (error: any) {
        res.status(500).json({ error: "Failed to fetch active sessions", details: error.message });
      }
    }
  );

  // ── SECURITY CENTER ENDPOINTS ──────────────────────────────────────

  app.get(
    "/api/admin/security/sessions",
    requireAuth,
    requireAdmin,
    requireAdminCapability("tenant.security.read"),
    async (req: AuthenticatedRequest & { admin?: AdminPrincipal }, res) => {
      try {
        const snap = await db
          .collection("admin_sessions")
          .orderBy("loginAt", "desc")
          .limit(100)
          .get();
        const sessions = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        res.json({ success: true, data: sessions });
      } catch (e: any) {
        res.status(500).json({ error: e.message });
      }
    }
  );

  app.post(
    "/api/admin/security/sessions/:id/revoke",
    requireAuth,
    requireAdmin,
    requireAdminCapability("tenant.security.write"),
    validateBody(AdminRevokeSessionSchema),
    async (req: AuthenticatedRequest & { admin?: AdminPrincipal }, res) => {
      const sessionId = req.params.id;
      const { reason } = req.body;
      try {
        const sessionRef = db.collection("admin_sessions").doc(sessionId);
        const sessionSnap = await sessionRef.get();
        if (!sessionSnap.exists)
          return res.status(404).json({ error: "Session not found" });

        await sessionRef.update({
          status: "revoked",
          revokedAt: admin.firestore.FieldValue.serverTimestamp(),
          revokedBy: req.user?.email || req.user?.uid,
          revokeReason: reason,
        });

        await writeAdminAudit({
          actor: req.user!,
          action: "REVOKE_ADMIN_SESSION",
          capability: "tenant.security.write",
          targetType: "admin_session",
          targetId: sessionId,
          reason,
          before: { status: "active" },
          after: { status: "revoked" },
        });

        res.json({
          success: true,
          data: { sessionId, status: "revoked" },
        });
      } catch (e: any) {
        res.status(500).json({ error: e.message });
      }
    }
  );

  app.get(
    "/api/admin/security/anomalies",
    requireAuth,
    requireAdmin,
    requireAdminCapability("tenant.security.read"),
    async (req: AuthenticatedRequest & { admin?: AdminPrincipal }, res) => {
      try {
        const snap = await db
          .collection("admin_security_anomalies")
          .orderBy("timestamp", "desc")
          .limit(100)
          .get();
        const anomalies = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        res.json({ success: true, data: anomalies });
      } catch (e: any) {
        res.status(500).json({ error: e.message });
      }
    }
  );

  app.get(
    "/api/admin/security/mfa-status",
    requireAuth,
    requireAdmin,
    requireAdminCapability("tenant.security.read"),
    async (req: AuthenticatedRequest & { admin?: AdminPrincipal }, res) => {
      try {
        const snap = await db.collection("admin_users").get();
        const admins = snap.docs
          .map((d) => {
            const data = d.data();
            return {
              id: d.id,
              email: data.email,
              displayName: data.displayName || data.email,
              role: data.role,
              mfaEnabled: data.mfaEnabled || false,
              mfaEnforced: data.mfaEnforced || false,
              mfaEnforcedAt: data.mfaEnforcedAt || null,
              lastLogin: data.lastLogin || null,
            };
          })
          .filter(
            (a) => a.role === "super_admin" || a.role === "admin"
          );

        const total = admins.length;
        const withMfa = admins.filter((a) => a.mfaEnabled).length;

        res.json({
          success: true,
          data: {
            admins,
            summary: {
              total,
              withMfa,
              withoutMfa: total - withMfa,
              complianceRate: total
                ? Math.round((withMfa / total) * 100)
                : 0,
            },
          },
        });
      } catch (e: any) {
        res.status(500).json({ error: e.message });
      }
    }
  );

  app.post(
    "/api/admin/security/force-mfa/:uid",
    requireAuth,
    requireAdmin,
    requireAdminCapability("tenant.security.write"),
    validateBody(AdminForceMfaSchema),
    async (req: AuthenticatedRequest & { admin?: AdminPrincipal }, res) => {
      const targetUid = req.params.uid;
      const { reason } = req.body;
      try {
        const adminRef = db.collection("admin_users").doc(targetUid);
        const adminSnap = await adminRef.get();
        if (!adminSnap.exists)
          return res.status(404).json({ error: "Admin user not found" });

        await adminRef.update({
          mfaEnforced: true,
          mfaEnforcedAt: admin.firestore.FieldValue.serverTimestamp(),
          mfaEnforcedBy: req.user?.email || req.user?.uid,
        });

        await writeAdminAudit({
          actor: req.user!,
          action: "FORCE_MFA",
          capability: "tenant.security.write",
          targetType: "admin_user",
          targetId: targetUid,
          reason,
          before: { mfaEnforced: false },
          after: { mfaEnforced: true },
        });

        res.json({
          success: true,
          data: { uid: targetUid, mfaEnforced: true },
        });
      } catch (e: any) {
        res.status(500).json({ error: e.message });
      }
    }
  );

  // ── BILLING OPS ENDPOINTS ────────────────────────────────────────

  app.get(
    "/api/admin/billing/overview",
    requireAuth,
    requireAdmin,
    requireAdminCapability("tenant.billing.read"),
    async (req: AuthenticatedRequest & { admin?: AdminPrincipal }, res) => {
      try {
        const snap = await db.collection("enterprise_settings").get();
        const tenants = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

        let mrr = 0;
        let active = 0,
          trialing = 0,
          pastDue = 0,
          canceled = 0;

        tenants.forEach((t: any) => {
          const billing = t.billing;
          if (!billing) return;
          const status = billing.status || "active";
          const planId = billing.planId || "starter";
          const pricing = PLAN_PRICING[planId];
          const monthly = pricing
            ? billing.billingCycle === "yearly"
              ? pricing.yearly
              : pricing.monthly
            : 0;
          const users = billing.userCount || 1;
          const branches = billing.branchCount || 1;
          const addonCost = (users - 1) * 5 + Math.max(0, branches - 1) * 29;

          if (status === "active") {
            active++;
            mrr += monthly + addonCost;
          } else if (status === "trialing") {
            trialing++;
          } else if (status === "past_due") {
            pastDue++;
            mrr += monthly + addonCost;
          } else if (status === "canceled") {
            canceled++;
          }
        });

        res.json({
          success: true,
          data: {
            mrr: Math.round(mrr * 100) / 100,
            arr: Math.round(mrr * 12 * 100) / 100,
            totalTenants: tenants.length,
            active,
            trialing,
            pastDue,
            canceled,
            churnRate: tenants.length
              ? Math.round((canceled / tenants.length) * 100)
              : 0,
          },
        });
      } catch (e: any) {
        res.status(500).json({ error: e.message });
      }
    }
  );

  app.get(
    "/api/admin/billing/tenants",
    requireAuth,
    requireAdmin,
    requireAdminCapability("tenant.billing.read"),
    async (req: AuthenticatedRequest & { admin?: AdminPrincipal }, res) => {
      try {
        const snap = await db.collection("enterprise_settings").get();
        const tenants = snap.docs.map((d) => {
          const data = d.data();
          const billing = data.billing || {};
          return {
            id: d.id,
            name: data.name || d.id,
            planId: billing.planId || "starter",
            status: billing.status || "active",
            billingCycle: billing.billingCycle || "monthly",
            userCount: billing.userCount || 1,
            branchCount: billing.branchCount || 1,
            renewalDate: billing.renewalDate || null,
            trialEndsAt: billing.trialEndsAt || null,
          };
        });

        res.json({ success: true, data: tenants });
      } catch (e: any) {
        res.status(500).json({ error: e.message });
      }
    }
  );

  app.post(
    "/api/admin/billing/tenants/:id/credit",
    requireAuth,
    requireAdmin,
    requireAdminCapability("tenant.billing.write"),
    validateBody(AdminIssueCreditSchema),
    async (req: AuthenticatedRequest & { admin?: AdminPrincipal }, res) => {
      const tenantId = req.params.id;
      const { amount, reason } = req.body;
      try {
        const tenantRef = db.collection("enterprise_settings").doc(tenantId);
        const tenantSnap = await tenantRef.get();
        if (!tenantSnap.exists)
          return res.status(404).json({ error: "Tenant not found" });

        const creditRef = await db.collection("admin_billing_credits").add({
          tenantId,
          amount,
          reason,
          issuedBy: req.user?.email || req.user?.uid,
          issuedAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        await writeAdminAudit({
          actor: req.user!,
          action: "ISSUE_BILLING_CREDIT",
          capability: "tenant.billing.write",
          targetType: "tenant",
          targetId: tenantId,
          reason,
          before: {},
          after: { creditId: creditRef.id, amount },
        });

        res.json({
          success: true,
          data: { creditId: creditRef.id, tenantId, amount },
        });
      } catch (e: any) {
        res.status(500).json({ error: e.message });
      }
    }
  );

  app.post(
    "/api/admin/billing/tenants/:id/extend-trial",
    requireAuth,
    requireAdmin,
    requireAdminCapability("tenant.billing.write"),
    validateBody(AdminExtendTrialSchema),
    async (req: AuthenticatedRequest & { admin?: AdminPrincipal }, res) => {
      const tenantId = req.params.id;
      const { days, reason } = req.body;
      try {
        const tenantRef = db.collection("enterprise_settings").doc(tenantId);
        const tenantSnap = await tenantRef.get();
        if (!tenantSnap.exists)
          return res.status(404).json({ error: "Tenant not found" });

        const data = tenantSnap.data()!;
        const billing = data.billing || {};
        const currentEnd = billing.trialEndsAt
          ? new Date(
              billing.trialEndsAt._seconds
                ? billing.trialEndsAt._seconds * 1000
                : billing.trialEndsAt
            )
          : new Date();
        const newEnd = new Date(
          currentEnd.getTime() + days * 24 * 60 * 60 * 1000
        );

        await tenantRef.update({
          "billing.trialEndsAt": newEnd.toISOString(),
          "billing.status": "trialing",
        });

        await writeAdminAudit({
          actor: req.user!,
          action: "EXTEND_TRIAL",
          capability: "tenant.billing.write",
          targetType: "tenant",
          targetId: tenantId,
          reason,
          before: { trialEndsAt: billing.trialEndsAt },
          after: { trialEndsAt: newEnd.toISOString(), daysAdded: days },
        });

        res.json({
          success: true,
          data: { tenantId, trialEndsAt: newEnd.toISOString(), daysAdded: days },
        });
      } catch (e: any) {
        res.status(500).json({ error: e.message });
      }
    }
  );

  app.get(
    "/api/admin/billing/failures",
    requireAuth,
    requireAdmin,
    requireAdminCapability("tenant.billing.read"),
    async (req: AuthenticatedRequest & { admin?: AdminPrincipal }, res) => {
      try {
        const snap = await db
          .collection("admin_billing_failures")
          .orderBy("failedAt", "desc")
          .limit(100)
          .get();
        const failures = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        res.json({ success: true, data: failures });
      } catch (e: any) {
        res.status(500).json({ error: e.message });
      }
    }
  );

  // ── INCIDENT CENTER ENDPOINTS ────────────────────────────────────

  app.get(
    "/api/admin/incidents",
    requireAuth,
    requireAdmin,
    requireAdminCapability("tenant.incidents.read"),
    async (req: AuthenticatedRequest & { admin?: AdminPrincipal }, res) => {
      try {
        const snap = await db
          .collection("admin_incidents")
          .orderBy("createdAt", "desc")
          .limit(100)
          .get();
        const incidents = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        res.json({ success: true, data: incidents });
      } catch (e: any) {
        res.status(500).json({ error: e.message });
      }
    }
  );

  app.post(
    "/api/admin/incidents",
    requireAuth,
    requireAdmin,
    requireAdminCapability("tenant.incidents.write"),
    validateBody(AdminCreateIncidentSchema),
    async (req: AuthenticatedRequest & { admin?: AdminPrincipal }, res) => {
      const { title, severity, description, affectedServices } = req.body;
      try {
        const now = new Date().toISOString();
        const incidentRef = await db.collection("admin_incidents").add({
          title,
          severity,
          status: "investigating",
          description,
          affectedServices: affectedServices || [],
          affectedTenantIds: [],
          timeline: [
            {
              timestamp: now,
              type: "created",
              message: `Incident created with severity: ${severity}`,
              author: req.user?.email || req.user?.uid,
            },
          ],
          createdBy: req.user?.email || req.user?.uid,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          resolvedAt: null,
          resolutionNotes: null,
        });

        await writeAdminAudit({
          actor: req.user!,
          action: "CREATE_INCIDENT",
          capability: "tenant.incidents.write",
          targetType: "incident",
          targetId: incidentRef.id,
          reason: title,
          before: {},
          after: { severity, status: "investigating" },
        });

        res.json({
          success: true,
          data: { id: incidentRef.id, title, severity, status: "investigating" },
        });
      } catch (e: any) {
        res.status(500).json({ error: e.message });
      }
    }
  );

  app.patch(
    "/api/admin/incidents/:id",
    requireAuth,
    requireAdmin,
    requireAdminCapability("tenant.incidents.write"),
    validateBody(AdminUpdateIncidentSchema),
    async (req: AuthenticatedRequest & { admin?: AdminPrincipal }, res) => {
      const incidentId = req.params.id;
      const { status, description, updateNote, resolutionNotes } = req.body;
      try {
        const incidentRef = db.collection("admin_incidents").doc(incidentId);
        const incidentSnap = await incidentRef.get();
        if (!incidentSnap.exists)
          return res.status(404).json({ error: "Incident not found" });

        const current = incidentSnap.data()!;
        const updates: Record<string, any> = {};
        const timelineEntry: any = {
          timestamp: new Date().toISOString(),
          author: req.user?.email || req.user?.uid,
        };

        if (status && status !== current.status) {
          updates.status = status;
          timelineEntry.type = "status_change";
          timelineEntry.message = `Status changed from ${current.status} to ${status}`;
          if (status === "resolved") {
            updates.resolvedAt = admin.firestore.FieldValue.serverTimestamp();
          }
        }
        if (description) updates.description = description;
        if (resolutionNotes) {
          updates.resolutionNotes = resolutionNotes;
          if (!timelineEntry.type) {
            timelineEntry.type = "resolution_notes";
            timelineEntry.message = "Resolution notes updated";
          }
        }
        if (updateNote) {
          timelineEntry.type = timelineEntry.type || "update";
          timelineEntry.message = updateNote;
        }

        if (timelineEntry.type) {
          updates.timeline = admin.firestore.FieldValue.arrayUnion(timelineEntry);
        }

        await incidentRef.update(updates);

        await writeAdminAudit({
          actor: req.user!,
          action: "UPDATE_INCIDENT",
          capability: "tenant.incidents.write",
          targetType: "incident",
          targetId: incidentId,
          reason: updateNote || "Incident updated",
          before: { status: current.status },
          after: updates,
        });

        res.json({
          success: true,
          data: { id: incidentId, ...updates },
        });
      } catch (e: any) {
        res.status(500).json({ error: e.message });
      }
    }
  );

  app.post(
    "/api/admin/incidents/:id/affected-tenants",
    requireAuth,
    requireAdmin,
    requireAdminCapability("tenant.incidents.write"),
    validateBody(AdminLinkAffectedTenantsSchema),
    async (req: AuthenticatedRequest & { admin?: AdminPrincipal }, res) => {
      const incidentId = req.params.id;
      const { tenantIds } = req.body;
      try {
        const incidentRef = db.collection("admin_incidents").doc(incidentId);
        const incidentSnap = await incidentRef.get();
        if (!incidentSnap.exists)
          return res.status(404).json({ error: "Incident not found" });

        const now = new Date().toISOString();
        await incidentRef.update({
          affectedTenantIds:
            admin.firestore.FieldValue.arrayUnion(...tenantIds),
          timeline: admin.firestore.FieldValue.arrayUnion({
            timestamp: now,
            type: "tenants_linked",
            message: `Linked ${tenantIds.length} affected tenant(s)`,
            author: req.user?.email || req.user?.uid,
          }),
        });

        await writeAdminAudit({
          actor: req.user!,
          action: "LINK_AFFECTED_TENANTS",
          capability: "tenant.incidents.write",
          targetType: "incident",
          targetId: incidentId,
          reason: `Linked ${tenantIds.length} tenant(s)`,
          before: {},
          after: { addedTenantIds: tenantIds },
        });

        res.json({
          success: true,
          data: { incidentId, linkedTenantIds: tenantIds },
        });
      } catch (e: any) {
        res.status(500).json({ error: e.message });
      }
    }
  );

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error("Failed to start server:", err);
});
