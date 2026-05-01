import express from "express";
import * as dotenv from "dotenv";
import { createServer as createViteServer } from "vite";

dotenv.config();
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

function requireEnterpriseMatch(req: AuthenticatedRequest, res: express.Response, next: express.NextFunction) {
  const requestedEnterpriseId = req.body?.enterpriseId || req.body?.enterprise_id;
  if (!requestedEnterpriseId || requestedEnterpriseId === req.user?.enterpriseId) {
    return next();
  }
  return res.status(403).json({ error: "Enterprise scope mismatch" });
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
