#!/usr/bin/env node
/**
 * ORIVO CRM — Admin Account Bootstrap Script
 *
 * Uses the Firebase ADMIN SDK (bypasses all Firestore security rules).
 * This is the ONLY safe way to write the first admin_users document
 * because client-SDK writes are blocked by the Firestore rules we set.
 *
 * Prerequisites:
 *   1. Download a service account key from Firebase Console:
 *      Project Settings → Service Accounts → Generate new private key
 *      Save it as:  scripts/service-account.json
 *   2. Run:  node scripts/create-admin.mjs
 *
 * Usage (interactive):
 *   node scripts/create-admin.mjs
 *
 * Usage (non-interactive):
 *   ADMIN_EMAIL=you@domain.com ADMIN_PASSWORD=yourpassword node scripts/create-admin.mjs
 */

import { createRequire } from "module";
import { readFileSync, existsSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import readline from "readline/promises";
import { stdin as input, stdout as output } from "process";

import * as dotenv from "dotenv";

const require = createRequire(import.meta.url);
const __dirname = dirname(fileURLToPath(import.meta.url));

dotenv.config({ path: join(__dirname, "../.env") });

// ── Check service account exists ─────────────────────────────────────────────
const SA_PATH = join(__dirname, "service-account.json");
if (!existsSync(SA_PATH)) {
  console.error(`
╔══════════════════════════════════════════════════════════════╗
║  ERROR: Service account key not found                        ║
╠══════════════════════════════════════════════════════════════╣
║  1. Go to Firebase Console → Project Settings → Service      ║
║     Accounts → Generate new private key                      ║
║  2. Save the downloaded JSON as:                             ║
║       scripts/service-account.json                           ║
║  3. Run this script again                                    ║
║                                                               ║
║  This file is gitignored — never commit it.                  ║
╚══════════════════════════════════════════════════════════════╝
`);
  process.exit(1);
}

const admin = require("firebase-admin");
const serviceAccount = JSON.parse(readFileSync(SA_PATH, "utf8"));

const appletConfig = {
  projectId: process.env.VITE_FIREBASE_PROJECT_ID,
  firestoreDatabaseId: process.env.VITE_FIREBASE_FIRESTORE_DATABASE_ID
};

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: `https://${appletConfig.projectId}.firebaseio.com`,
  });
}

const db = admin.firestore();
if (appletConfig.firestoreDatabaseId && appletConfig.firestoreDatabaseId !== "(default)") {
  // Use named database if configured
}
const authAdmin = admin.auth();

// ── Prompt helper ─────────────────────────────────────────────────────────────
const rl = readline.createInterface({ input, output });
const prompt = (q) => rl.question(q);

// ── Main ───────────────────────────────────────────────────────────────────────
console.log(`
╔════════════════════════════════════════════╗
║   ORIVO CRM — Admin Bootstrap (Admin SDK) ║
╚════════════════════════════════════════════╝
`);

const email    = process.env.ADMIN_EMAIL    || await prompt("Admin email:               ");
const password = process.env.ADMIN_PASSWORD || await prompt("Admin password (min 8):    ");
const role     = process.env.ADMIN_ROLE     || await prompt("Role [super_admin/admin]:   ") || "super_admin";

rl.close();

// Validate inputs
if (!email || !password) {
  console.error("❌  Email and password are required.");
  process.exit(1);
}
if (password.length < 8) {
  console.error("❌  Password must be at least 8 characters.");
  process.exit(1);
}
if (!["super_admin", "admin"].includes(role.trim())) {
  console.error("❌  Role must be 'super_admin' or 'admin'.");
  process.exit(1);
}

const cleanRole = role.trim();

try {
  console.log("\n⏳  Setting up admin account via Admin SDK…\n");

  // ── Step 1: Create or fetch Firebase Auth user ────────────────────────────
  let uid;
  try {
    const newUser = await authAdmin.createUser({ email, password, emailVerified: true });
    uid = newUser.uid;
    console.log(`✅  Firebase Auth account created  →  ${uid}`);
  } catch (err) {
    if (err.code === "auth/email-already-in-use" || err.code === "auth/uid-already-exists") {
      const existing = await authAdmin.getUserByEmail(email);
      uid = existing.uid;
      // Update the password in case it changed
      await authAdmin.updateUser(uid, { password, emailVerified: true });
      console.log(`ℹ️   Account already exists. Password updated  →  ${uid}`);
    } else {
      throw err;
    }
  }

  // ── Step 2: Set custom claims ─────────────────────────────────────────────
  await authAdmin.setCustomUserClaims(uid, {
    role: cleanRole,
    granted_at: new Date().toISOString(),
    granted_by: "bootstrap_script",
  });
  console.log(`✅  Custom claim set: role = "${cleanRole}"`);

  // ── Step 3: Write admin_users document (Admin SDK bypasses rules) ─────────
  await db.collection("admin_users").doc(uid).set({
    email,
    role: cleanRole,
    granted_at: admin.firestore.FieldValue.serverTimestamp(),
    granted_by: "bootstrap_script",
  });
  console.log(`✅  admin_users/${uid} written to Firestore`);

  // ── Step 4: Bootstrap audit log ───────────────────────────────────────────
  await db.collection("admin_audit_logs").add({
    action: "GRANT_SUPER_ADMIN_BOOTSTRAP",
    admin_uid: "system",
    admin_email: "system@bootstrap",
    resource_type: "admin_account",
    resource_id: uid,
    target_uid: uid,
    after: { role: cleanRole, email },
    timestamp: admin.firestore.FieldValue.serverTimestamp(),
    source: "create-admin.mjs",
  });
  console.log(`✅  Audit log written`);

  console.log(`
╔════════════════════════════════════════════╗
║   ✅  Admin account ready!                ║
╚════════════════════════════════════════════╝

  Email:  ${email}
  Role:   ${cleanRole}
  UID:    ${uid}

  Next steps:
  1. Open your CRM app in the browser
  2. Navigate to:  /#/admin  (or append ?admin=1 to the URL)
  3. Log in with the credentials above

  ⚠️  Keep these credentials secure.
     This account bypasses the tenant system.
`);

} catch (err) {
  console.error("\n❌  Bootstrap failed:", err.code || err.message);
  if (err.code === "auth/weak-password") {
    console.error("   Use a stronger password (8+ chars, mixed case, numbers).");
  }
  process.exit(1);
}

process.exit(0);
