import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import * as fs from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import { getMockUser } from './auth-mock';
import * as demoFs from './firebase-demo';

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

// Conditional Firestore Exports
export const collection = (db: any, path: string) => fs.collection(db, path);
export const query = (ref: any, ...constraints: any[]) => fs.query(ref, ...constraints);
export const doc = (db: any, path: string, ...rest: string[]) => fs.doc(db, path, ...rest);
export const where = fs.where;
export const orderBy = fs.orderBy;
export const limit = fs.limit;
export const serverTimestamp = fs.serverTimestamp;

export const onSnapshot = (q: any, cb: any, errorCb?: (error: any) => void) => 
  getMockUser() ? demoFs.mockOnSnapshot(q, cb) : fs.onSnapshot(q, cb, errorCb);

export const getDocs = (q: any) => 
  getMockUser() ? demoFs.mockGetDocs(q) : fs.getDocs(q);

export const addDoc = (ref: any, data: any) => 
  getMockUser() ? demoFs.mockAddDoc(ref, data) : fs.addDoc(ref, data);

export const updateDoc = (ref: any, data: any) => 
  getMockUser() ? demoFs.mockUpdateDoc(ref, data) : fs.updateDoc(ref, data);

export const writeBatch = (db: any) => 
  getMockUser() ? { 
    set: () => {}, 
    update: () => {}, 
    delete: () => {}, 
    commit: () => Promise.resolve() 
  } : fs.writeBatch(db);

export const arrayUnion = fs.arrayUnion;
export const arrayRemove = fs.arrayRemove;
export const getDocFromCache = fs.getDocFromCache;
export const getDocFromServer = fs.getDocFromServer;
export const getDoc = (ref: any) => 
  getMockUser() ? Promise.resolve({ exists: () => true, data: () => ({}) }) : fs.getDoc(ref);

export const deleteDoc = (ref: any) =>
  getMockUser() ? demoFs.mockDeleteDoc(ref) : fs.deleteDoc(ref);

export const setDoc = (ref: any, data: any, options?: any) =>
  getMockUser() ? demoFs.mockUpdateDoc(ref, data) : fs.setDoc(ref, data, options);

// Storage Stubs for Demo Mode
export const getStorage = () => ({});
export const ref = (storage: any, path: string) => ({ path });
export const uploadBytes = async (ref: any, file: Blob | Uint8Array | ArrayBuffer) => {
  if (getMockUser()) return { ref };
  throw new Error("Real storage not configured in this turn");
};
export const getDownloadURL = async (ref: any) => {
  if (getMockUser()) return `https://firebasestorage.googleapis.com/v0/b/mock/o/${encodeURIComponent(ref.path)}?alt=media`;
  return "";
};

async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    console.log("Firestore connection successful");
  } catch (error) {
    if(error instanceof Error && error.message.includes('the client is offline')) {
      console.error("Please check your Firebase configuration. The client is offline.");
    }
    // Skip logging for other errors, as this is simply a connection test.
  }
}
// testConnection();

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

export default app;
