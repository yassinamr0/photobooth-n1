/*
 * Offline support for staff writes.
 *
 * Firestore (with its persistent on-device cache, see client.ts) applies a write locally at
 * once and sends it when the connection is back — but the write's promise only resolves on
 * the SERVER's acknowledgement. Awaiting it offline would leave "Logging…" spinning forever.
 *
 * queued(p): tracks the write as pending (for the "Offline · N waiting to sync" pill) and
 *   - offline → resolves straight away (the change is already saved on this phone);
 *   - online  → waits for the server as before, so rule rejections still surface at once,
 *               but gives up waiting after a few seconds (flaky mall Wi-Fi) — it keeps
 *               syncing in the background.
 * A write the server rejects later is reported through onLateError (toast).
 */

type Listener = () => void;
const listeners = new Set<Listener>();
let pending = 0;
let lateErrorHandler: ((e: unknown) => void) | null = null;

const notify = () => listeners.forEach((l) => l());

export function subscribeSync(l: Listener) {
  listeners.add(l);
  return () => listeners.delete(l);
}
export const pendingWrites = () => pending;

/** Where to report a queued write the server rejected after we stopped waiting. */
export function onLateError(fn: ((e: unknown) => void) | null) {
  lateErrorHandler = fn;
}

export const isOnline = () => (typeof navigator === "undefined" ? true : navigator.onLine);

const ONLINE_WAIT_MS = 4000;

export function queued<T>(write: Promise<T>): Promise<void> {
  pending++;
  notify();
  let settledEarly = false;
  const tracked = write.then(
    () => undefined,
    (e) => {
      if (settledEarly) lateErrorHandler?.(e);
      throw e;
    },
  ).finally(() => {
    pending--;
    notify();
  });
  tracked.catch(() => {}); // handled via the race below / lateErrorHandler

  if (!isOnline()) {
    settledEarly = true;
    return Promise.resolve();
  }
  return Promise.race([
    tracked,
    new Promise<void>((resolve) => setTimeout(() => { settledEarly = true; resolve(); }, ONLINE_WAIT_MS)),
  ]);
}
