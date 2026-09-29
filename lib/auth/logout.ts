import { signOut } from "firebase/auth";
import { firebase } from "@/lib/firebase/client";
import { setSigningOut, unsubscribeAll } from "@/lib/firebase/listeners";
import { clearMissingProfileTimer } from "./missingProfileTimer";

/**
 * Log out. ORDER MATTERS — every Firestore listener is detached BEFORE signOut(), so none of
 * them can receive a permission-denied error when the auth token goes away.
 */
export async function logout() {
  setSigningOut(true);
  try {
    clearMissingProfileTimer();
    unsubscribeAll();
    await signOut(firebase().auth);
  } finally {
    setSigningOut(false);
  }
}
