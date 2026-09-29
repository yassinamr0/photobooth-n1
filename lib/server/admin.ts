import { cert, getApps, initializeApp, type App } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

/*
 * Firebase Admin SDK — SERVER ONLY (daily summary email). Credentials come from the
 * FIREBASE_SERVICE_ACCOUNT env var (the JSON key from Firebase console → Project settings →
 * Service accounts), set in Vercel. Never shipped to the browser, never committed.
 * With FIRESTORE_EMULATOR_HOST set (local testing) no key is needed.
 */

let app: App | null = null;

export function adminApp(): App {
  if (app) return app;
  if (getApps().length) return (app = getApps()[0]);
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  if (process.env.FIRESTORE_EMULATOR_HOST) return (app = initializeApp({ projectId }));
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) throw new Error("FIREBASE_SERVICE_ACCOUNT is not set");
  const key = JSON.parse(raw);
  if (typeof key.private_key === "string") key.private_key = key.private_key.replace(/\\n/g, "\n");
  return (app = initializeApp({ credential: cert(key), projectId: key.project_id ?? projectId }));
}

export const adminDb = () => getFirestore(adminApp());
export const adminAuth = () => getAuth(adminApp());
