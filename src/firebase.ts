import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

declare const __FIREBASE_CONFIG__: string;
const firebaseConfig = JSON.parse(__FIREBASE_CONFIG__);

const app = initializeApp(firebaseConfig);
export const db = firebaseConfig.firestoreDatabaseId
  ? getFirestore(app, firebaseConfig.firestoreDatabaseId)
  : getFirestore(app);
export const auth = getAuth(app);
