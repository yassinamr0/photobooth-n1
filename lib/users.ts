import { doc, serverTimestamp, setDoc, type DocumentData, type Timestamp } from "firebase/firestore";
import { firebase } from "@/lib/firebase/client";

export type Role = "staff" | "admin";

export type UserProfile = {
  uid: string;
  name: string;
  email: string;
  role: Role;
  approved: boolean;
  /** Event this staff member is currently assigned to (Phase 5). Legacy docs lack it → null. */
  assignedEventId: string | null;
  createdAt: Timestamp | null;
};

export function userDocRef(uid: string) {
  return doc(firebase().db, "users", uid);
}

/** Normalise a /users doc, tolerating legacy docs that predate some fields. */
export function parseUserDoc(uid: string, data: DocumentData): UserProfile {
  return {
    uid,
    name: typeof data.name === "string" ? data.name : "",
    email: typeof data.email === "string" ? data.email : "",
    role: data.role === "admin" ? "admin" : "staff",
    approved: data.approved === true,
    assignedEventId: typeof data.assignedEventId === "string" ? data.assignedEventId : null,
    createdAt: (data.createdAt as Timestamp | undefined) ?? null,
  };
}

/**
 * Create the caller's own profile. Every new account starts as unapproved staff with no event.
 * Used by both signup and the "Finish setting up" recovery screen.
 */
export function createUserProfile(uid: string, name: string, email: string) {
  return setDoc(userDocRef(uid), {
    uid,
    name,
    email,
    role: "staff",
    approved: false,
    assignedEventId: null,
    createdAt: serverTimestamp(),
  });
}

export function fullName(first: string, last: string) {
  return `${first.trim()} ${last.trim()}`.trim();
}
