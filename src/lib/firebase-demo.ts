// Inline demo store — no external imports to avoid circular dependencies
const demoStore: Record<string, any[]> = {
  branches: [
    { id: "main", name: "Main Branch", location: "Downtown" },
    { id: "north", name: "North Branch", location: "Uptown" },
  ],
  products: [
    { id: "P-101", name: "iPhone 15 Pro", sku: "IPH-15P-256", retail_price: 999, category: "Phones", stock: 25 },
    { id: "P-102", name: "MacBook Air M3", sku: "MAC-M3-AIR", retail_price: 1099, category: "Laptops", stock: 10 },
    { id: "P-103", name: "AirPods Pro", sku: "AIR-PRO-2", retail_price: 249, category: "Accessories", stock: 50 },
  ],
  customers: [
    { id: "C-001", name: "Alice Johnson", email: "alice@example.com", segment: "VIP", loyalty_points: 450, status: "Active", balance: 0, spend: 1200 },
    { id: "C-002", name: "Bob Smith", email: "bob@smith.com", segment: "RETAIL", loyalty_points: 120, status: "Active", balance: 50, spend: 320 },
  ],
  inventory: [
    { id: "i1", product_id: "P-101", branch_id: "main", stock: 25 },
    { id: "i2", product_id: "P-102", branch_id: "main", stock: 10 },
    { id: "i3", product_id: "P-103", branch_id: "main", stock: 50 },
  ],
  transactions: [
    { id: "t1", type: "SALE", total: 999, status: "COMPLETED", branch_id: "main", customer_id: "C-001", timestamp: new Date().toISOString() },
    { id: "t2", type: "SALE", total: 249, status: "COMPLETED", branch_id: "main", customer_id: "C-002", timestamp: new Date(Date.now() - 86400000).toISOString() },
  ],
  audit_logs: [],
  invoices: [],
  communications: [],
  staff: [],
  campaigns: [],
  customer_groups: [],
  inventory_movements: [],
  pos_sessions: [],
  settings: [],
  suppliers: [],
  workflows: [],
  documents: [],
};

// Simple listener registry
const listeners: Record<string, Set<(snapshot: any) => void>> = {};

function notifyListeners(colName: string) {
  if (listeners[colName]) {
    const data = demoStore[colName] || [];
    const snapshot = { docs: data.map(d => ({ 
      id: d.id || "mock-id", 
      ref: { id: d.id || "mock-id", path: `${colName}/${d.id || 'mock-id'}` },
      data: () => d 
    })) };
    listeners[colName].forEach(cb => cb(snapshot));
  }
}

export function mockOnSnapshot(query: any, callback: (snapshot: any) => void): () => void {
  const colName = extractCollectionName(query);
  if (!colName) return () => {};

  if (!listeners[colName]) listeners[colName] = new Set();
  listeners[colName].add(callback);

  // Initial call
  const data = demoStore[colName] || [];
  setTimeout(() => {
    callback({ docs: data.map(d => ({ 
      id: d.id || "mock-id", 
      ref: { id: d.id || "mock-id", path: `${colName}/${d.id || 'mock-id'}` },
      data: () => d 
    })) });
  }, 10);

  return () => {
    listeners[colName].delete(callback);
  };
}

export async function mockGetDocs(query: any) {
  const colName = extractCollectionName(query);
  const data = (colName && demoStore[colName]) ? demoStore[colName] : [];
  return {
    empty: data.length === 0,
    docs: data.map(d => ({ 
      id: d.id || "mock-id", 
      ref: { id: d.id || "mock-id", path: `${colName}/${d.id || 'mock-id'}` },
      data: () => d 
    }))
  };
}

export async function mockAddDoc(collectionRef: any, data: any) {
  const colName = collectionRef?.path?.split("/")?.pop();
  const newDoc = { id: `mock-${Date.now()}`, ...data };
  if (colName && demoStore[colName]) {
    demoStore[colName].push(newDoc);
    notifyListeners(colName);
  }
  return { id: newDoc.id };
}

export async function mockUpdateDoc(docRef: any, data: any) {
  const segments = (docRef?.path || "").split("/");
  const id = segments.pop();
  const colName = segments.pop();
  if (colName && id && demoStore[colName]) {
    const idx = demoStore[colName].findIndex((i: any) => i.id === id);
    if (idx !== -1) {
      demoStore[colName][idx] = { ...demoStore[colName][idx], ...data };
      notifyListeners(colName);
    }
  }
}

export async function mockDeleteDoc(docRef: any) {
  const segments = (docRef?.path || "").split("/");
  const id = segments.pop();
  const colName = segments.pop();
  if (colName && id && demoStore[colName]) {
    demoStore[colName] = demoStore[colName].filter((i: any) => i.id !== id);
    notifyListeners(colName);
  }
}

function extractCollectionName(query: any): string | null {
  return (
    query?._query?.path?.segments?.join("/")?.split("/")?.pop() ||
    query?.path?.split("/")?.pop() ||
    null
  );
}

