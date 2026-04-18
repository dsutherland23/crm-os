import { db, collection, addDoc, serverTimestamp } from "./firebase";

export async function seedClientData(enterpriseId: string) {
  if (!enterpriseId) return;
  
  // Seed only if necessary (you could check for existing data here)
  console.log(`Seeding starting enterprise data for: ${enterpriseId}`);
  
  try {
    // Seed standard products
    const products = [
      { name: "Premium Widget", category: "Hardware", sku: "HW-001", stock: 50, price: 99.99, enterprise_id: enterpriseId },
      { name: "Digital License", category: "Software", sku: "SW-001", stock: 999, price: 249.99, enterprise_id: enterpriseId }
    ];
    
    for (const p of products) {
      await addDoc(collection(db, "products"), p);
    }

    // Seed initial branch
    await addDoc(collection(db, "branches"), {
      name: "Main Headquarters",
      status: "ACTIVE",
      enterprise_id: enterpriseId,
      parish: "Head Office"
    });

    console.log("Seeding complete.");
  } catch (e) {
    console.error("Seed failed:", e);
  }
}
