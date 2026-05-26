import { initializeApp, getApp, getApps, deleteApp } from "firebase/app";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut } from "firebase/auth";
import { getFirestore, doc, setDoc, onSnapshot } from "firebase/firestore";

let firebaseApp = null;
let firebaseAuth = null;
let firebaseDb = null;

export const APP_ID = 'neuroflow-minimal';

export function getFirebaseInstances() {
  return {
    app: firebaseApp,
    auth: firebaseAuth,
    db: firebaseDb,
    isConnected: !!firebaseAuth?.currentUser
  };
}

export async function initFirebase(config) {
  try {
    // If apps exist, delete the existing one to allow a clean re-initialization with new configs
    if (getApps().length > 0) {
      const activeApp = getApp();
      await deleteApp(activeApp);
    }
    
    firebaseApp = initializeApp(config);
    firebaseAuth = getAuth(firebaseApp);
    firebaseDb = getFirestore(firebaseApp);
    
    return { app: firebaseApp, auth: firebaseAuth, db: firebaseDb };
  } catch (error) {
    console.error("Error initializing Firebase:", error);
    throw error;
  }
}

export async function signInUser(email, password) {
  if (!firebaseAuth) throw new Error("Firebase not initialized");
  return signInWithEmailAndPassword(firebaseAuth, email, password);
}

export async function registerUser(email, password) {
  if (!firebaseAuth) throw new Error("Firebase not initialized");
  return createUserWithEmailAndPassword(firebaseAuth, email, password);
}

export async function signOutUser() {
  if (!firebaseAuth) throw new Error("Firebase not initialized");
  return signOut(firebaseAuth);
}

export async function syncUserDataToCloud(uid, dateStr, userSettings, dailyLogs) {
  if (!firebaseDb) return;
  try {
    await setDoc(doc(firebaseDb, APP_ID, uid, "settings", "user_settings"), userSettings, { merge: true });
    await setDoc(doc(firebaseDb, APP_ID, uid, "daily_logs", dateStr), dailyLogs, { merge: true });
  } catch (error) {
    console.error("Error syncing data to cloud:", error);
  }
}
