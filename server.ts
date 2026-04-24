import express from "express";
import * as dotenv from "dotenv";
import { createServer as createViteServer } from "vite";

dotenv.config();
import path from "path";
import { fileURLToPath } from "url";
import { v4 as uuidv4 } from "uuid";
import admin from "firebase-admin";

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

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API routes
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  // ── SECURE AI PROXY ─────────────────────────────────────────────────
  // Keeps the Gemini API key server-side so it never ships in the client bundle.
  app.post("/api/ai/generate", async (req, res) => {
    const { prompt, model = "gemini-1.5-flash" } = req.body;
    if (!prompt || typeof prompt !== "string" || prompt.length > 8000) {
      return res.status(400).json({ error: "Invalid prompt" });
    }

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
  });

  // ── ORPHANED FILE CLEANUP ──────────────────────────────────────────
  // Triggered by a scheduler (e.g. Cloud Scheduler → cron) to remove Storage
  // files uploaded to customer profiles that were abandoned (no Firestore ref).
  app.post("/api/cleanup/orphaned-files", async (req, res) => {
    // This requires Firebase Storage Admin which needs a service account key.
    // Implementation placeholder — enable when a service account is configured.
    res.json({ message: "Orphan cleanup scheduled. Implement with Storage Admin SDK when service account is available." });
  });

  // ── DASHBOARD AGGREGATION CRON ─────────────────────────────────────
  // Periodic background aggregation of metrics, replacing heavy client-side
  // data fetching and processing on the Dashboard for enterprise scalability.
  app.post("/api/cron/aggregate-dashboard", async (req, res) => {
    try {
      // In production, limit to active enterprise IDs or iterate through them.
      // For this implementation, we will use the test enterprise "main-workspace" or take from req.body
      const enterpriseId = req.body.enterpriseId || process.env.VITE_FIREBASE_PROJECT_ID || "crm-os-enterprise";
      
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
        // Assuming price comes from joined product data in a real environment,
        // but for now, fallback to stock * price if available.
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
  });


  // POS Checkout Logic
  app.post("/api/pos/checkout", async (req, res) => {
    const { items, customerId, branchId, paymentMethod, subtotal, discount, tax, total } = req.body;
    const transactionId = uuidv4();

    try {
      const batch = db.batch();

      // 1. Create Transaction
      const transactionRef = db.collection("transactions").doc(transactionId);
      batch.set(transactionRef, {
        id: transactionId,
        type: "SALE",
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
      // Reading stock then subtracting (stale-read pattern) causes race conditions
      // when two sales process the same item concurrently.
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
        user_id: "system", // Should be actual user ID from auth
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
  });

  // Inventory Transfer Logic
  app.post("/api/inventory/transfer", async (req, res) => {
    const { productId, fromBranchId, toBranchId, quantity } = req.body;

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
          stock: quantity
        });
      }

      await batch.commit();
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: "Transfer failed", details: error.message });
    }
  });

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
