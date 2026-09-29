import { getApp, getApps, initializeApp, type FirebaseApp } from "firebase/app";
import { connectAuthEmulator, getAuth, type Auth } from "firebase/auth";
import {
  connectFirestoreEmulator,
  getFirestore,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  type Firestore,
} from "firebase/firestore";

// Each var must be referenced literally so Next.js can inline it into the client bundle.
const config = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

const envNames: Record<keyof typeof config, string> = {
  apiKey: "NEXT_PUBLIC_FIREBASE_API_KEY",
  authDomain: "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN",
  projectId: "NEXT_PUBLIC_FIREBASE_PROJECT_ID",
  storageBucket: "NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET",
  messagingSenderId: "NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID",
  appId: "NEXT_PUBLIC_FIREBASE_APP_ID",
};

/** Env var names that are missing/empty. Empty array = fully configured. */
export const missingFirebaseEnv: string[] = (Object.keys(config) as (keyof typeof config)[])
  .filter((k) => !config[k])
  .map((k) => envNames[k]);

/** Local testing only: point the SDK at the Firebase emulators. */
const useEmulators = process.env.NEXT_PUBLIC_FIREBASE_USE_EMULATORS === "true";

let cached: { app: FirebaseApp; auth: Auth; db: Firestore } | null = null;

/** Lazily initialised Firebase handles. Throws if config env vars are missing. */
export function firebase() {
  if (cached) return cached;
  if (missingFirebaseEnv.length) {
    throw new Error(`Firebase is not configured. Missing: ${missingFirebaseEnv.join(", ")}`);
  }
  const alreadyInitialised = getApps().length > 0;
  const app = alreadyInitialised ? getApp() : initializeApp(config);
  const auth = getAuth(app);
  // Offline mode: keep a persistent on-device copy of the data this user can see and queue
  // writes while offline (synced automatically when the connection is back). Multi-tab safe.
  let db: Firestore;
  if (alreadyInitialised) db = getFirestore(app);
  else {
    try {
      db = initializeFirestore(app, typeof window === "undefined" ? {} : {
        localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
      });
    } catch {
      db = getFirestore(app); // e.g. private browsing without IndexedDB → memory cache
    }
  }
  if (useEmulators && !alreadyInitialised) {
    connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
    connectFirestoreEmulator(db, "127.0.0.1", 8080);
  }
  cached = { app, auth, db };
  return cached;
}
