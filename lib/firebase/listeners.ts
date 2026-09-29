import {
  onSnapshot,
  type DocumentReference,
  type DocumentSnapshot,
  type FirestoreError,
  type Query,
  type QuerySnapshot,
  type SnapshotListenOptions,
} from "firebase/firestore";
import { firebase } from "./client";

/*
 * Central registry for every live Firestore listener in the app.
 *
 * RULE: never call onSnapshot() directly anywhere else — always use listen().
 * On logout, unsubscribeAll() runs BEFORE signOut() (see lib/auth/logout.ts). If a listener
 * were still attached when the auth token disappears, Firestore would fire a trailing
 * permission-denied error and it would flash on screen (a real bug in the legacy app).
 */

const active = new Set<() => void>();
let signingOut = false;

export function isSigningOut() {
  return signingOut;
}

export function setSigningOut(value: boolean) {
  signingOut = value;
}

/** Unsubscribe and forget every registered listener. Safe to call repeatedly. */
export function unsubscribeAll() {
  for (const unsub of active) {
    try {
      unsub();
    } catch {
      // already detached — ignore
    }
  }
  active.clear();
}

/** Number of live listeners (dev diagnostics / tests). */
export function activeListenerCount() {
  return active.size;
}

type ErrorHandler = (err: FirestoreError) => void;

function guardError(onError?: ErrorHandler) {
  return (err: FirestoreError) => {
    // Safety net: a permission-denied that races a logout is expected noise, never shown.
    if (err.code === "permission-denied" && (signingOut || !firebase().auth.currentUser)) return;
    if (onError) onError(err);
    else console.error("[firestore listener]", err);
  };
}

export function listen<T>(
  ref: DocumentReference<T>,
  onNext: (snap: DocumentSnapshot<T>) => void,
  onError?: ErrorHandler,
  options?: SnapshotListenOptions,
): () => void;
export function listen<T>(
  ref: Query<T>,
  onNext: (snap: QuerySnapshot<T>) => void,
  onError?: ErrorHandler,
  options?: SnapshotListenOptions,
): () => void;
export function listen<T>(
  ref: DocumentReference<T> | Query<T>,
  onNext: (snap: never) => void,
  onError?: ErrorHandler,
  options: SnapshotListenOptions = {},
): () => void {
  // Overloads above give callers precise snapshot types; onSnapshot's own overloads can't
  // be selected from a union, hence the cast.
  const raw = (onSnapshot as (r: unknown, o: unknown, n: unknown, e: unknown) => () => void)(
    ref,
    options,
    onNext,
    guardError(onError),
  );
  let done = false;
  const unsub = () => {
    if (done) return;
    done = true;
    active.delete(unsub);
    raw();
  };
  active.add(unsub);
  return unsub;
}
