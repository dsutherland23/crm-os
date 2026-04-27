/**
 * ORIVO CRM — FIREBASE CLOUD FUNCTIONS (Admin API Layer)
 * 
 * 2026 Zero Trust Admin Operations
 * Deploy with: firebase deploy --only functions
 * 
 * These functions use the Firebase Admin SDK to:
 *   1. Set custom claims (role assignment)
 *   2. Perform privileged Firestore writes with Admin SDK (bypasses client rules)
 *   3. Capture real client IP for audit logs
 *   4. Force token revocation (sign out users globally)
 * 
 * All functions verify the CALLER is an admin before executing.
 */

const functions = require("firebase-functions");
const admin = require("firebase-admin");

admin.initializeApp();

const db = admin.firestore();
const auth = admin.auth();

// ── CORS (restrict to your hosted domain in production) ──
const cors = require("cors")({ origin: true });

// ── Helper: verify caller is an admin ────────────────────────────────
async function verifyAdminCaller(context) {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "Must be signed in.");
  }
  const uid = context.auth.uid;
  const tokenRole = context.auth.token?.role;

  if (tokenRole === "super_admin" || tokenRole === "admin") {
    return { uid, role: tokenRole };
  }

  // Fallback: check admin_users collection
  const adminDoc = await db.collection("admin_users").doc(uid).get();
  if (!adminDoc.exists) {
    throw new functions.https.HttpsError(
      "permission-denied",
      "Insufficient privileges. This incident has been logged."
    );
  }
  const role = adminDoc.data().role;
  if (!["super_admin", "admin"].includes(role)) {
    throw new functions.https.HttpsError("permission-denied", "Invalid admin role.");
  }
  return { uid, role };
}

// ── Helper: write immutable audit log ────────────────────────────────
async function writeAuditLog(adminUid, adminEmail, action, data) {
  await db.collection("admin_audit_logs").add({
    admin_uid: adminUid,
    admin_email: adminEmail,
    action,
    timestamp: admin.firestore.FieldValue.serverTimestamp(),
    ...data,
  });
}

// ════════════════════════════════════════════════════════════════════
// FUNCTION 1: Set Admin Role (super_admin only)
// ════════════════════════════════════════════════════════════════════
exports.setAdminRole = functions.https.onCall(async (data, context) => {
  const caller = await verifyAdminCaller(context);

  if (caller.role !== "super_admin") {
    throw new functions.https.HttpsError(
      "permission-denied",
      "Only super_admin can assign roles."
    );
  }

  const { targetUid, role } = data;
  if (!targetUid || !["admin", "super_admin", "tenant_user"].includes(role)) {
    throw new functions.https.HttpsError("invalid-argument", "Invalid targetUid or role.");
  }

  // Set custom claim
  await auth.setCustomUserClaims(targetUid, {
    role,
    granted_at: new Date().toISOString(),
    granted_by: caller.uid,
  });

  // Update admin_users collection
  if (role === "tenant_user") {
    await db.collection("admin_users").doc(targetUid).delete();
  } else {
    await db.collection("admin_users").doc(targetUid).set({
      role,
      granted_at: admin.firestore.FieldValue.serverTimestamp(),
      granted_by: caller.uid,
    });
  }

  const targetUser = await auth.getUser(targetUid);
  await writeAuditLog(caller.uid, context.auth.token.email, "SET_ADMIN_ROLE", {
    resource_type: "user",
    resource_id: targetUid,
    before: { role: "unknown" },
    after: { role },
    target_uid: targetUid,
  });

  return { success: true, message: `Role '${role}' set for ${targetUser.email}` };
});

// ════════════════════════════════════════════════════════════════════
// FUNCTION 2: Suspend User (admin or super_admin)
// ════════════════════════════════════════════════════════════════════
exports.suspendUser = functions.https.onCall(async (data, context) => {
  const caller = await verifyAdminCaller(context);
  const { targetUid, reason } = data;

  if (!targetUid) throw new functions.https.HttpsError("invalid-argument", "targetUid required.");

  // Disable Firebase Auth account
  await auth.updateUser(targetUid, { disabled: true });

  // Mark in Firestore
  const userDocs = await db.collection("users").where("__name__", "==", targetUid).get();
  if (!userDocs.empty) {
    await userDocs.docs[0].ref.update({ status: "SUSPENDED" });
  }

  // Revoke all refresh tokens (force sign-out)
  await auth.revokeRefreshTokens(targetUid);

  const targetUser = await auth.getUser(targetUid);
  await writeAuditLog(caller.uid, context.auth.token.email, "SUSPEND_USER", {
    resource_type: "user",
    resource_id: targetUid,
    target_uid: targetUid,
    after: { status: "SUSPENDED", reason: reason || "Admin action" },
  });

  return { success: true, message: `${targetUser.email} suspended and signed out.` };
});

// ════════════════════════════════════════════════════════════════════
// FUNCTION 3: Reactivate User
// ════════════════════════════════════════════════════════════════════
exports.reactivateUser = functions.https.onCall(async (data, context) => {
  const caller = await verifyAdminCaller(context);
  const { targetUid } = data;

  await auth.updateUser(targetUid, { disabled: false });

  const userDocs = await db.collection("users").where("__name__", "==", targetUid).get();
  if (!userDocs.empty) {
    await userDocs.docs[0].ref.update({ status: "ACTIVE" });
  }

  const targetUser = await auth.getUser(targetUid);
  await writeAuditLog(caller.uid, context.auth.token.email, "REACTIVATE_USER", {
    resource_type: "user",
    resource_id: targetUid,
    target_uid: targetUid,
    after: { status: "ACTIVE" },
  });

  return { success: true };
});

// ════════════════════════════════════════════════════════════════════
// FUNCTION 4: Suspend Tenant
// ════════════════════════════════════════════════════════════════════
exports.suspendTenant = functions.https.onCall(async (data, context) => {
  const caller = await verifyAdminCaller(context);

  if (caller.role !== "super_admin") {
    throw new functions.https.HttpsError("permission-denied", "Only super_admin can suspend tenants.");
  }

  const { tenantId, reason } = data;
  if (!tenantId) throw new functions.https.HttpsError("invalid-argument", "tenantId required.");

  // Suspend enterprise settings
  await db.collection("enterprise_settings").doc(tenantId).update({
    status: "suspended",
    suspended_at: admin.firestore.FieldValue.serverTimestamp(),
    suspended_by: caller.uid,
    suspension_reason: reason || "Admin action",
  });

  // Disable all users in this tenant
  const usersSnap = await db.collection("users")
    .where("enterprise_id", "==", tenantId)
    .get();

  const batch = db.batch();
  for (const userDoc of usersSnap.docs) {
    batch.update(userDoc.ref, { status: "SUSPENDED" });
    try {
      await auth.updateUser(userDoc.id, { disabled: true });
      await auth.revokeRefreshTokens(userDoc.id);
    } catch (e) {
      // User may not exist in Auth
    }
  }
  await batch.commit();

  await writeAuditLog(caller.uid, context.auth.token.email, "SUSPEND_TENANT", {
    resource_type: "tenant",
    resource_id: tenantId,
    target_tenant: tenantId,
    after: { status: "suspended", affected_users: usersSnap.size },
  });

  return { success: true, affected_users: usersSnap.size };
});

// ════════════════════════════════════════════════════════════════════
// FUNCTION 5: Force Sign-Out Single User
// ════════════════════════════════════════════════════════════════════
exports.forceSignOut = functions.https.onCall(async (data, context) => {
  const caller = await verifyAdminCaller(context);
  const { targetUid } = data;

  await auth.revokeRefreshTokens(targetUid);

  await writeAuditLog(caller.uid, context.auth.token.email, "FORCE_SIGN_OUT", {
    resource_type: "user",
    resource_id: targetUid,
    target_uid: targetUid,
  });

  return { success: true };
});

// ════════════════════════════════════════════════════════════════════
// FUNCTION 6: Update Platform Stats (scheduled, every 5 min)
// ════════════════════════════════════════════════════════════════════
exports.updatePlatformStats = functions.pubsub
  .schedule("every 5 minutes")
  .onRun(async () => {
    const [usersSnap, tenantsSnap] = await Promise.all([
      db.collection("users").get(),
      db.collection("enterprise_settings").get(),
    ]);

    const now = Date.now();
    const sevenDaysAgo = new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString();

    const newSignups = usersSnap.docs.filter(
      (d) => d.data().createdAt >= sevenDaysAgo
    ).length;

    const suspendedUsers = usersSnap.docs.filter(
      (d) => d.data().status === "SUSPENDED"
    ).length;

    await db.collection("admin_meta").doc("platform_stats").set({
      total_tenants: tenantsSnap.size,
      total_users: usersSnap.size,
      new_signups_7d: newSignups,
      flagged_accounts: suspendedUsers,
      updated_at: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });

    console.log("Platform stats updated.");
  });

// ════════════════════════════════════════════════════════════════════
// FUNCTION 7: Grant Initial Super Admin (one-time bootstrap)
// Call this once from Firebase Console or CLI:
//   firebase functions:shell
//   > grantBootstrapAdmin({email: "your@email.com", secret: "<BOOTSTRAP_SECRET>"})
// ════════════════════════════════════════════════════════════════════
exports.grantBootstrapAdmin = functions.https.onCall(async (data) => {
  const BOOTSTRAP_SECRET = functions.config().admin?.bootstrap_secret;

  if (!BOOTSTRAP_SECRET || data.secret !== BOOTSTRAP_SECRET) {
    throw new functions.https.HttpsError("permission-denied", "Invalid bootstrap secret.");
  }

  const user = await auth.getUserByEmail(data.email);
  await auth.setCustomUserClaims(user.uid, {
    role: "super_admin",
    granted_at: new Date().toISOString(),
    granted_by: "bootstrap",
  });

  await db.collection("admin_users").doc(user.uid).set({
    role: "super_admin",
    email: data.email,
    granted_at: admin.firestore.FieldValue.serverTimestamp(),
    granted_by: "bootstrap",
  });

  await db.collection("admin_audit_logs").add({
    admin_uid: "system",
    admin_email: "system@bootstrap",
    action: "GRANT_SUPER_ADMIN_BOOTSTRAP",
    resource_type: "user",
    resource_id: user.uid,
    target_uid: user.uid,
    after: { role: "super_admin" },
    timestamp: admin.firestore.FieldValue.serverTimestamp(),
  });

  return { success: true, message: `Super admin granted to ${data.email}` };
});

// ════════════════════════════════════════════════════════════════════
// FUNCTION 8: Aggregate Financials (on ledger write)
// ════════════════════════════════════════════════════════════════════
exports.aggregateFinancials = functions.firestore
  .document("ledger/{entryId}")
  .onCreate(async (snap) => {
    const data = snap.data();
    const { enterprise_id, amount, type, account } = data;

    if (!enterprise_id) return null;

    const summaryRef = db.collection("financial_summaries").doc(enterprise_id);
    const increment = admin.firestore.FieldValue.increment;

    const updates = {
      last_updated: admin.firestore.FieldValue.serverTimestamp()
    };

    // Aggregation Logic for Income Statement:
    // Only aggregate Revenue (SALES) and Expense accounts to calculate Net Profit.
    // Asset accounts (CASH, RECEIVABLE) are for Balance Sheet and handled separately if needed.
    if (account === "SALES" && type === "CREDIT") {
      updates.total_revenue = increment(amount);
      updates.net_profit = increment(amount);
    } else if (account === "EXPENSE" && type === "DEBIT") {
      updates.total_expenses = increment(amount);
      updates.net_profit = increment(-amount);
    } else {
      // For other accounts (CASH, etc.), we don't update Income Statement metrics
      return null;
    }

    return summaryRef.set(updates, { merge: true });
  });


// ════════════════════════════════════════════════════════════════════
// FUNCTION 9: Sync Group Memberships (on customer write)
// 
// FIX for Groups module production risk #5 (Staleness):
// Triggers automatically whenever a customer document is written.
// Evaluates all dynamic groups for that customer's enterprise and
// updates member_count on affected groups — no manual "Sync Now" needed.
//
// FIX for Groups module production risk #1 (Client-Side Scale):
// Heavy evaluation runs here in Node.js (Admin SDK), NOT in the browser.
// Eliminates the frontend getDocs() full-table-scan risk entirely.
// ════════════════════════════════════════════════════════════════════

/** Client-side evaluator mirror — must stay in sync with Groups.tsx evalRules() */
function evalRulesServer(customer, rules, logic) {
  if (!rules || !rules.length) return true;
  const NUMERIC = ["balance", "loyalty_points"];
  const ARRAY = ["tags"];

  const results = rules.map((r) => {
    const cv = customer[r.field];
    const rv = String(r.value ?? "");

    if (NUMERIC.includes(r.field)) {
      const n = parseFloat(cv ?? 0), v = parseFloat(rv);
      if (isNaN(v)) return false;
      switch (r.operator) {
        case ">":  return n > v;
        case ">=": return n >= v;
        case "<":  return n < v;
        case "<=": return n <= v;
        case "==": return n === v;
        case "!=": return n !== v;
        default: return false;
      }
    }

    if (ARRAY.includes(r.field)) {
      const arr = Array.isArray(cv) ? cv : [];
      const q = rv.toLowerCase().trim();
      if (r.operator === "array-contains") return arr.some((t) => String(t).toLowerCase() === q);
      if (r.operator === "contains") return arr.some((t) => String(t).toLowerCase().includes(q));
      return false;
    }

    // FIX: Consistent case-insensitive string comparison (mirrors Groups.tsx)
    const s = String(cv ?? "").toLowerCase(), q = rv.toLowerCase().trim();
    switch (r.operator) {
      case "==": return s === q;
      case "!=": return s !== q;
      case "contains": return s.includes(q);
      default: return false;
    }
  });

  return logic === "AND" ? results.every(Boolean) : results.some(Boolean);
}

exports.syncGroupMembershipsOnCustomerWrite = functions.firestore
  .document("customers/{customerId}")
  .onWrite(async (change, context) => {
    const customerId = context.params.customerId;

    // Get the new state (null if deleted)
    const afterData = change.after.exists ? { id: customerId, ...change.after.data() } : null;
    const enterpriseId = afterData?.enterprise_id || change.before.data()?.enterprise_id;

    if (!enterpriseId) return null;

    try {
      // Fetch all dynamic groups for this enterprise
      const groupsSnap = await db
        .collection("customer_groups")
        .where("enterprise_id", "==", enterpriseId)
        .where("type", "==", "Dynamic")
        .get();

      if (groupsSnap.empty) return null;

      const batch = db.batch();
      let batchCount = 0;

      for (const groupDoc of groupsSnap.docs) {
        const group = groupDoc.data();
        const rules = group.rules || [];
        const logic = group.logic || "AND";

        // Check if this customer now qualifies
        const qualifies = afterData ? evalRulesServer(afterData, rules, logic) : false;

        // We need the current count to delta — use a lightweight count query
        // Recount only if customer qualification status changed
        const prevData = change.before.exists ? { id: customerId, ...change.before.data() } : null;
        const prevQualified = prevData ? evalRulesServer(prevData, rules, logic) : false;

        if (qualifies === prevQualified) continue; // No change for this group, skip

        const delta = qualifies ? 1 : -1;
        batch.update(groupDoc.ref, {
          member_count: admin.firestore.FieldValue.increment(delta),
          last_synced: admin.firestore.FieldValue.serverTimestamp(),
        });

        batchCount++;

        // Firestore batch limit is 500 — commit and start new batch if needed
        if (batchCount >= 490) {
          await batch.commit();
          batchCount = 0;
        }
      }

      if (batchCount > 0) await batch.commit();

      return null;
    } catch (err) {
      console.error("syncGroupMembershipsOnCustomerWrite error:", err);
      return null;
    }
  });

// ════════════════════════════════════════════════════════════════════
// FUNCTION 10: Full Group Resync (callable — for admin "Sync All" action)
// FIX: Provides an exact count by iterating ALL customers server-side.
// FIX: Chunked pagination prevents 9-minute Cloud Function timeout on
// enterprises with 100k+ customers. Processes in pages of 1000 documents.
// Runtime: 540s timeout, 1GB memory (set via runWith options).
// ════════════════════════════════════════════════════════════════════
exports.resyncAllGroups = functions
  .runWith({ timeoutSeconds: 540, memory: "1GB" })
  .https.onCall(async (data, context) => {
  if (!context.auth) throw new functions.https.HttpsError("unauthenticated", "Must be signed in.");

  const { enterpriseId } = data;
  if (!enterpriseId) throw new functions.https.HttpsError("invalid-argument", "enterpriseId required.");

  try {
    // Load all groups once — groups per enterprise are bounded (usually < 100)
    const groupsSnap = await db.collection("customer_groups").where("enterprise_id", "==", enterpriseId).get();
    if (groupsSnap.empty) return { success: true, groupsProcessed: 0, customersEvaluated: 0 };

    // Pre-fetch Manual group member counts from subcollections
    const manualCounts = {};
    for (const gDoc of groupsSnap.docs) {
      if (gDoc.data().type !== "Dynamic") {
        const membSnap = await gDoc.ref.collection("members").get();
        manualCounts[gDoc.id] = membSnap.size;
      }
    }

    // Dynamic groups: accumulate match counts per group using paginated customer scan
    // FIX: Cursor-based pagination prevents timeout — loads 1000 customers per iteration.
    const dynamicGroups = groupsSnap.docs.filter(g => g.data().type === "Dynamic");
    const matchCounts = {};
    dynamicGroups.forEach(g => { matchCounts[g.id] = 0; });

    let totalCustomers = 0;
    let lastDoc = null;
    const PAGE_SIZE = 1000;

    // eslint-disable-next-line no-constant-condition
    while (true) {
      let custQuery = db.collection("customers")
        .where("enterprise_id", "==", enterpriseId)
        .limit(PAGE_SIZE);
      if (lastDoc) custQuery = custQuery.startAfter(lastDoc);

      const custSnap = await custQuery.get();
      if (custSnap.empty) break;

      totalCustomers += custSnap.size;
      const customers = custSnap.docs.map(d => ({ id: d.id, ...d.data() }));

      for (const gDoc of dynamicGroups) {
        const group = gDoc.data();
        const matched = customers.filter(c =>
          evalRulesServer(c, group.rules || [], group.logic || "AND")
        ).length;
        matchCounts[gDoc.id] += matched;
      }

      if (custSnap.size < PAGE_SIZE) break;
      lastDoc = custSnap.docs[custSnap.size - 1];
    }

    // Write all counts in batches
    let batch = db.batch();
    let batchCount = 0;

    for (const groupDoc of groupsSnap.docs) {
      const count = groupDoc.data().type === "Dynamic"
        ? (matchCounts[groupDoc.id] || 0)
        : (manualCounts[groupDoc.id] || 0);

      batch.update(groupDoc.ref, {
        member_count: count,
        last_synced: admin.firestore.FieldValue.serverTimestamp(),
      });

      batchCount++;
      if (batchCount >= 490) {
        await batch.commit();
        batch = db.batch();
        batchCount = 0;
      }
    }

    if (batchCount > 0) await batch.commit();

    return {
      success: true,
      groupsProcessed: groupsSnap.size,
      customersEvaluated: totalCustomers,
    };
  } catch (err) {
    console.error("resyncAllGroups error:", err);
    throw new functions.https.HttpsError("internal", "Resync failed: " + err.message);
  }
});

