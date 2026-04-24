import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { initializeFirestore, memoryLocalCache } from 'firebase/firestore';
import * as fs from 'firebase/firestore';
import { getMockUser } from './auth-mock';
import * as demoFs from './firebase-demo';

const firebaseConfig = {
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || ""
};

// Resilient initialization: check for missing keys before calling Firebase SDK
const hasRequiredKeys = !!(firebaseConfig.apiKey && firebaseConfig.projectId && firebaseConfig.appId);

let appInstance;
let authInstance;
let dbInstance;
let functionsInstance;

try {
  if (!hasRequiredKeys) {
    console.warn("Firebase configuration is incomplete. App will fall back to demo mode.");
    appInstance = initializeApp({ ...firebaseConfig, apiKey: "DUMMY", projectId: "dummy", appId: "dummy" });
  } else {
    appInstance = initializeApp(firebaseConfig);
  }
  
  authInstance = getAuth(appInstance);
  dbInstance = initializeFirestore(appInstance, {
    localCache: memoryLocalCache(),
    databaseId: import.meta.env.VITE_FIREBASE_FIRESTORE_DATABASE_ID || "(default)"
  });
  functionsInstance = getFunctions(appInstance);
} catch (error) {
  console.error("Firebase failed to initialize:", error);
  // Fallback to satisfy imports and prevent white-screen crashes
  if (!appInstance) appInstance = initializeApp({ apiKey: "DUMMY", projectId: "dummy", appId: "dummy" });
  if (!authInstance) authInstance = getAuth(appInstance);
  if (!dbInstance) dbInstance = initializeFirestore(appInstance, { localCache: memoryLocalCache() });
  if (!functionsInstance) functionsInstance = getFunctions(appInstance);
}

export const auth = authInstance;
export const db = dbInstance;
export const functions = functionsInstance;
export { appInstance as default };

// Proactively clean up any stale Firestore IndexedDB databases left from previous sessions.
(async () => {
  try {
    const dbs = await indexedDB.databases();
    for (const { name } of dbs) {
      if (name && name.startsWith('firestore/')) {
        indexedDB.deleteDatabase(name);
      }
    }
  } catch {
    // indexedDB.databases() not supported in all browsers
  }
})();

// Toggle this to switch between Live and Mock databases
const USE_LIVE_DB = true; 

const isMock = () => !USE_LIVE_DB && !!getMockUser();

// Conditional Firestore Exports
export const collection = (db: any, path: string) => fs.collection(db, path);
export const query = (ref: any, ...constraints: any[]) => fs.query(ref, ...constraints);
export const doc = (dbOrCol: any, ...pathSegments: string[]) => 
  pathSegments.length > 0 ? fs.doc(dbOrCol, ...pathSegments) : fs.doc(dbOrCol);
export const where = fs.where;
export const orderBy = fs.orderBy;
export const limit = fs.limit;
export const serverTimestamp = fs.serverTimestamp;
export const increment = fs.increment;

export const onSnapshot = (q: any, cb: any, errorCb?: (error: any) => void) => 
  isMock() ? demoFs.mockOnSnapshot(q, cb) : fs.onSnapshot(q, cb, errorCb);

export const getDocs = (q: any) => 
  isMock() ? demoFs.mockGetDocs(q) : fs.getDocs(q);

export const addDoc = (ref: any, data: any) => 
  isMock() ? demoFs.mockAddDoc(ref, data) : fs.addDoc(ref, data);

export const updateDoc = (ref: any, data: any) => 
  isMock() ? demoFs.mockUpdateDoc(ref, data) : fs.updateDoc(ref, data);

export const writeBatch = (db: any) => {
  if (isMock()) {
     const operations: Array<() => Promise<any>> = [];
     return {
       set: (ref: any, data: any) => operations.push(() => demoFs.mockAddDoc(ref, data)),
       update: (ref: any, data: any) => operations.push(() => demoFs.mockUpdateDoc(ref, data)),
       delete: (ref: any) => operations.push(() => demoFs.mockDeleteDoc(ref)),
       commit: async () => {
         for (const op of operations) await op();
         return Promise.resolve();
       }
     };
  }
  return fs.writeBatch(db);
};

export const arrayUnion = fs.arrayUnion;
export const arrayRemove = fs.arrayRemove;
export const getDocFromCache = fs.getDocFromCache;
export const getDocFromServer = fs.getDocFromServer;
export const getDoc = (ref: any) => 
  isMock() ? Promise.resolve({ exists: () => true, data: () => ({}) }) : fs.getDoc(ref);

export const deleteDoc = (ref: any) =>
  isMock() ? demoFs.mockDeleteDoc(ref) : fs.deleteDoc(ref);

export const setDoc = (ref: any, data: any, options?: any) =>
  isMock() ? demoFs.mockUpdateDoc(ref, data) : fs.setDoc(ref, data, options);

import * as storageFs from 'firebase/storage';

// ── STORAGE ENGINE ──────────────────────────────────────────
export const getStorage = () => storageFs.getStorage(appInstance);
export const ref = (storage: any, path: string) => storageFs.ref(storage, path);
export const uploadBytes = (ref: any, data: any, metadata?: any) => storageFs.uploadBytes(ref, data, metadata);
export const getDownloadURL = (ref: any) => storageFs.getDownloadURL(ref);

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo, null, 2));
  throw new Error(JSON.stringify(errInfo));
}

export const setAdminRole = async (targetUid: string, role: string) => {
  const callSetRole = httpsCallable(functions, 'setAdminRole');
  return callSetRole({ targetUid, role });
};
