#!/usr/bin/env node
/**
 * ORIVO CRM — Admin Account Setup Script
 * 
 * Run this ONCE to create your admin Firebase Auth account
 * and add it to the admin_users Firestore collection.
 * 
 * Usage:
 *   node scripts/create-admin.mjs
 * 
 * You will be prompted for:
 *   - Admin email
 *   - Admin password (min 8 chars)
 */

import { initializeApp } from "firebase/app";
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
} from "firebase/auth";
import {
  getFirestore,
  doc,
  setDoc,
  getDoc,
  serverTimestamp,
} from "firebase/firestore";
import readline from "readline/promises";
import { stdin as input, stdout as output } from "process";
import { createRequire } from "module";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const config = JSON.parse(
  readFileSync(join(__dirname, "../firebase-applet-config.json"), "utf8")
);

// ── Firebase init ──────────────────────────────────────────────────
const app = initializeApp(config);
const auth = getAuth(app);
const db = getFirestore(app, config.firestoreDatabaseId);

// ── Prompt helper ─────────────────────────────────────────────────
const rl = readline.createInterface({ input, output });

async function prompt(question) {
  return rl.question(question);
}

// ── Main ──────────────────────────────────────────────────────────
console.log("\n╔════════════════════════════════════════╗");
console.log("║   ORIVO CRM — Admin Account Setup     ║");
console.log("╚════════════════════════════════════════╝\n");

const email    = await prompt("Admin email:    ");
const password = await prompt("Admin password (min 8 chars): ");
const role     = await prompt("Role [super_admin / admin] (default: super_admin): ") || "super_admin";

if (!email || !password) {
  console.error("❌  Email and password are required.");
  process.exit(1);
}
if (password.length < 8) {
  console.error("❌  Password must be at least 8 characters.");
  process.exit(1);
}
if (!["super_admin", "admin"].includes(role)) {
  console.error("❌  Role must be super_admin or admin.");
  process.exit(1);
}

console.log("\n⏳  Creating admin account…");

try {
  let user;

  // Try creating new account
  try {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    user = cred.user;
    console.log("✅  Firebase Auth account created.");
  } catch (err) {
    if (err.code === "auth/email-already-in-use") {
      // Account exists — sign in and upgrade it
      console.log("ℹ️   Account already exists. Upgrading to admin…");
      const cred = await signInWithEmailAndPassword(auth, email, password);
      user = cred.user;
    } else {
      throw err;
    }
  }

  // Write to admin_users collection
  await setDoc(doc(db, "admin_users", user.uid), {
    email,
    role,
    granted_at: new Date().toISOString(),
    granted_by: "setup_script",
  });

  // Write bootstrap audit log
  await setDoc(doc(db, "admin_audit_logs", `bootstrap-${user.uid}`), {
    action: "ADMIN_ACCOUNT_CREATED",
    admin_uid: user.uid,
    admin_email: email,
    resource_type: "admin_account",
    after: { role, email },
    timestamp: new Date().toISOString(),
    ip: "setup_script",
  });

  console.log("\n╔════════════════════════════════════════╗");
  console.log("║   ✅  Admin account ready!             ║");
  console.log("╚════════════════════════════════════════╝");
  console.log(`\n  Email:  ${email}`);
  console.log(`  Role:   ${role}`);
  console.log(`  UID:    ${user.uid}`);
  console.log("\n  1. Go to your CRM app");
  console.log("  2. Navigate to:  /#/admin  (or ?admin=1)");
  console.log("  3. Log in with the credentials above");
  console.log("\n  ⚠️  Keep these credentials safe — this account");
  console.log("     bypasses the tenant system entirely.\n");

} catch (err) {
  console.error("\n❌  Error:", err.code || err.message);
  if (err.code === "auth/weak-password") {
    console.error("   Use a stronger password (min 8 characters with mixed case/numbers).");
  }
  process.exit(1);
} finally {
  rl.close();
  process.exit(0);
}
