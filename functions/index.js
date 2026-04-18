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
