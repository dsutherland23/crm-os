/**
 * IndexedDB-backed offline transaction queue for POS.
 * Stores pending transactions when offline; flushes on reconnect.
 */

const DB_NAME = 'crm-os-offline';
const STORE_NAME = 'pending-transactions';
const DB_VERSION = 1;

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'offlineId' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function queueTransaction(transaction: Record<string, unknown>): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put(transaction);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getPendingTransactions(): Promise<Record<string, unknown>[]> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const req = tx.objectStore(STORE_NAME).getAll();
    req.onsuccess = () => resolve(req.result as Record<string, unknown>[]);
    req.onerror = () => reject(req.error);
  });
}

export async function removeTransaction(offlineId: string): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).delete(offlineId);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function flushQueue(apiBaseUrl: string, accessToken: string): Promise<void> {
  const pending = await getPendingTransactions();
  for (const txn of pending) {
    try {
      const res = await fetch(`${apiBaseUrl}/api/v1/pos/transactions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ ...txn, syncedFromOffline: true }),
      });
      if (res.ok || res.status === 409) {
        // 409 = already exists (safe dedup)
        await removeTransaction(txn['offlineId'] as string);
      }
    } catch {
      // Network still unavailable — leave in queue
      break;
    }
  }
}
