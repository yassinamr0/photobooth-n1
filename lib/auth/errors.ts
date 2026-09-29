import { FirebaseError } from "firebase/app";

/** Human-friendly message for Firebase Auth / Firestore errors. */
export function authErrorMessage(e: unknown): string {
  const code = e instanceof FirebaseError ? e.code : "";
  switch (code) {
    case "auth/invalid-credential":
    case "auth/wrong-password":
    case "auth/user-not-found":
    case "auth/invalid-login-credentials":
      return "Wrong email or password.";
    case "auth/invalid-email":
      return "That email address doesn't look right.";
    case "auth/email-already-in-use":
      return "An account with this email already exists — try logging in instead.";
    case "auth/weak-password":
      return "Password should be at least 6 characters.";
    case "auth/too-many-requests":
      return "Too many attempts. Wait a minute and try again.";
    case "auth/network-request-failed":
    case "unavailable":
      return "No connection. Check your internet and try again.";
    case "auth/user-disabled":
      return "This account has been disabled.";
    case "permission-denied":
      return "You don't have permission to do that.";
    default:
      return e instanceof Error && e.message ? e.message : "Something went wrong. Try again.";
  }
}
