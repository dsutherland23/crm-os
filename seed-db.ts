import admin from "firebase-admin";
import { v4 as uuidv4 } from "uuid";

import * as dotenv from "dotenv";

dotenv.config();

const firebaseConfig = {
  projectId: process.env.VITE_FIREBASE_PROJECT_ID,
  firestoreDatabaseId: process.env.VITE_FIREBASE_FIRESTORE_DATABASE_ID
};

if (!admin.apps.length) {
  admin.initializeApp({
    projectId: firebaseConfig.projectId,
  });
}

const db = admin.firestore();
db.settings({ databaseId: firebaseConfig.firestoreDatabaseId });

async function seed() {
  console.log("Starting database seed...");

  // 1. Branches
  const branches = [
    { id: "main", name: "Main Branch", location: "Downtown", manager_id: "admin_1" },
    { id: "north", name: "North Branch", location: "Uptown", manager_id: "manager_1" },
    { id: "south", name: "South Branch", location: "Suburbs", manager_id: "manager_2" },
  ];

  for (const b of branches) {
    await db.collection("branches").doc(b.id).set(b);
  }
  console.log("Branches seeded.");

  // 2. Products
  const products = [
    { id: "P-101", name: "iPhone 15 Pro", sku: "IPH-15P-256", barcode: "123456", retail_price: 999, wholesale_price: 850, category: "Phones", image_url: "https://picsum.photos/seed/iphone/200", min_stock_level: 10 },
    { id: "P-102", name: "MacBook Air M3", sku: "MAC-M3-AIR", barcode: "234567", retail_price: 1099, wholesale_price: 900, category: "Laptops", image_url: "https://picsum.photos/seed/macbook/200", min_stock_level: 15 },
    { id: "P-103", name: "AirPods Pro", sku: "AIR-PRO-2", barcode: "345678", retail_price: 249, wholesale_price: 180, category: "Accessories", image_url: "https://picsum.photos/seed/airpods/200", min_stock_level: 20 },
    { id: "P-104", name: "Apple Watch Ultra", sku: "WATCH-ULTRA", barcode: "456789", retail_price: 799, wholesale_price: 650, category: "Wearables", image_url: "https://picsum.photos/seed/watch/200", min_stock_level: 5 },
  ];

  for (const p of products) {
    await db.collection("products").doc(p.id).set(p);
  }
  console.log("Products seeded.");

  // 3. Inventory
  const inventory = [
    { product_id: "P-101", branch_id: "main", stock: 25 },
    { product_id: "P-101", branch_id: "north", stock: 15 },
    { product_id: "P-101", branch_id: "south", stock: 5 },
    { product_id: "P-102", branch_id: "main", stock: 3 },
    { product_id: "P-102", branch_id: "north", stock: 2 },
    { product_id: "P-102", branch_id: "south", stock: 3 },
    { product_id: "P-103", branch_id: "main", stock: 60 },
    { product_id: "P-103", branch_id: "north", stock: 40 },
    { product_id: "P-103", branch_id: "south", stock: 20 },
  ];

  for (const i of inventory) {
    await db.collection("inventory").doc(uuidv4()).set(i);
  }
  console.log("Inventory seeded.");

  // 4. Customers
  const customers = [
    { id: "C-001", name: "Alice Johnson", email: "alice@example.com", phone: "+1 234 567 890", segment: "VIP", balance: 0, loyalty_points: 450, tags: ["Tech", "Early Adopter"] },
    { id: "C-002", name: "Bob Smith", email: "bob@smith.com", phone: "+1 987 654 321", segment: "RETAIL", balance: 45.50, loyalty_points: 120, tags: ["New"] },
    { id: "C-003", name: "Charlie Davis", email: "charlie@davis.org", phone: "+1 555 012 345", segment: "WHOLESALE", balance: 1200.00, loyalty_points: 50, tags: ["Bulk Buyer"] },
  ];

  for (const c of customers) {
    await db.collection("customers").doc(c.id).set(c);
  }
  console.log("Customers seeded.");

  // 5. Invoices & Expenses
  const invoices = [
    { id: "INV-1001", transaction_id: "TX-1001", customer_id: "C-001", date: "2024-04-10", due_date: "2024-04-20", status: "PAID", total: 1500 },
    { id: "INV-1002", transaction_id: "TX-1002", customer_id: "C-002", date: "2024-04-15", due_date: "2024-04-25", status: "UNPAID", total: 850 },
  ];

  for (const inv of invoices) {
    await db.collection("invoices").doc(inv.id).set(inv);
  }

  const expenses = [
    { id: "EXP-101", amount: 1200, category: "Rent", description: "Main Branch Rent", branch_id: "main", timestamp: new Date().toISOString() },
    { id: "EXP-102", amount: 450, category: "Utilities", description: "Electricity North", branch_id: "north", timestamp: new Date().toISOString() },
  ];

  for (const exp of expenses) {
    await db.collection("expenses").doc(exp.id).set(exp);
  }
  console.log("Finance data seeded.");

  // 6. Workflows
  const workflows = [
    { id: "WF-1", title: "VIP Welcome Sequence", status: "PROCESSING", assigned_to: "admin_1", related_id: "C-001", history: [] },
    { id: "WF-2", title: "Low Stock Replenishment", status: "PENDING", assigned_to: "manager_1", related_id: "P-102", history: [] },
  ];

  for (const wf of workflows) {
    await db.collection("workflows").doc(wf.id).set(wf);
  }
  console.log("Workflows seeded.");

  console.log("Database seed complete!");
}

seed().catch(err => {
  console.error("Seed failed:", err);
  process.exit(1);
});
