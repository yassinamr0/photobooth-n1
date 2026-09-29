import { collection, deleteDoc, doc, runTransaction, serverTimestamp, setDoc, updateDoc, writeBatch } from "firebase/firestore";
import { firebase } from "@/lib/firebase/client";
import { listen } from "@/lib/firebase/listeners";
import { parseEntry, parseShift, watchPaperSettings } from "@/lib/shift/firestore";
import { parseUserDoc, type UserProfile } from "@/lib/users";
import type { Entry, Shift } from "@/lib/shift/types";
import { parseEvent } from "@/lib/inventory/firestore";
import { DEDUCTION_FIELD, STOCK_INFO, STOCK_TYPES, type EventRecord } from "@/lib/inventory/types";
import type { PaperSettings } from "@/lib/shift/paper";

/*
 * Admin reads + writes. Every subscription goes through listen() (logout-safe).
 * The dashboard holds ONE set of these listeners; sections consume scoped data only
 * (see lib/admin/scope.ts).
 */

const db = () => firebase().db;
const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : 0);

type Handlers = {
  users: (u: UserProfile[]) => void;
  shifts: (s: Shift[]) => void;
  entries: (e: Entry[]) => void;
  events: (e: EventRecord[]) => void;
  paperSettings: (p: PaperSettings) => void;
  error: (label: string, e: Error) => void;
};

export function watchDashboard(h: Handlers) {
  const unsubs = [
    listen(collection(db(), "users"), (s) => h.users(s.docs.map((d) => parseUserDoc(d.id, d.data()))), (e) => h.error("Users", e)),
    listen(collection(db(), "shifts"), (s) => h.shifts(s.docs.map((d) => parseShift(d.id, d.data()))), (e) => h.error("Shifts", e)),
    listen(collection(db(), "entries"), (s) => h.entries(s.docs.map((d) => parseEntry(d.id, d.data()))), (e) => h.error("Entries", e)),
    listen(
      collection(db(), "events"),
      (s) => h.events(s.docs.map((d) => parseEvent(d.id, d.data())).sort((a, b) => a.name.localeCompare(b.name))),
      (e) => h.error("Events", e),
    ),
    watchPaperSettings(h.paperSettings),
  ];
  return () => unsubs.forEach((u) => u());
}

export function approveUser(uid: string) {
  return updateDoc(doc(db(), "users", uid), { approved: true });
}

/** Reject a pending signup: removes the profile doc only (the login itself remains). */
export function rejectUser(uid: string) {
  return deleteDoc(doc(db(), "users", uid));
}

/**
 * Change a staff member's CURRENT assignment. Only affects shifts they START from now on —
 * existing shifts keep the eventId they were stamped with.
 */
export function assignEvent(uid: string, eventId: string | null) {
  return updateDoc(doc(db(), "users", uid), { assignedEventId: eventId });
}

export function setPaperVerified(shiftId: string, verified: boolean) {
  return updateDoc(doc(db(), "shifts", shiftId), { paperVerified: verified });
}

/**
 * Irreversibly delete a shift AND every entry logged under it (batched, chunked).
 * If the shift's paper was already deducted from its event's stock, the same final batch
 * puts those sheets (and ink cartridges) back and logs reversals — stock always equals
 * restocks − existing shifts.
 */
export async function deleteShiftAndEntries(
  shift: Pick<Shift, "id" | "stockDeduction">,
  entryIds: string[],
  by: { uid: string; name: string },
) {
  const CHUNK = 450;
  for (let i = 0; i < entryIds.length; i += CHUNK) {
    const batch = writeBatch(db());
    entryIds.slice(i, i + CHUNK).forEach((id) => batch.delete(doc(db(), "entries", id)));
    await batch.commit();
  }
  const d = shift.stockDeduction;
  // Put back exactly what this shift took from its event's stock (paper, ink, frames).
  // A transaction, so a restored quantity back at/above the warning level re-arms the alert.
  const types = d ? STOCK_TYPES.filter((t) => (d[DEDUCTION_FIELD[t]] ?? 0) > 0) : [];
  await runTransaction(db(), async (tx) => {
    const refs = types.map((t) => doc(db(), "events", d!.eventId, "stock", t));
    const snaps = await Promise.all(refs.map((r) => tx.get(r)));
    types.forEach((t, i) => {
      const n = d![DEDUCTION_FIELD[t]];
      const data = snaps[i].data() ?? {};
      const q = Math.round((num(data.currentQuantity) + n) * 10) / 10;
      tx.update(refs[i], {
        currentQuantity: q,
        updatedAt: serverTimestamp(),
        ...(q >= num(data.lowStockThreshold) ? { alertDismissed: false } : {}),
      });
      tx.set(doc(collection(db(), "events", d!.eventId, "stockLogs")), {
        stockType: t, delta: n, kind: "shiftReversal", reason: `Shift deleted — ${STOCK_INFO[t].unit} restored`,
        shiftId: shift.id, byUid: by.uid, byName: by.name, createdAt: serverTimestamp(),
      });
    });
    tx.delete(doc(db(), "shifts", shift.id));
  });
}

/**
 * Remove a staff member from the Staff section: deletes their /users profile only. Their
 * past shifts and sales stay in history. Their Firebase login must be deleted in the
 * Firebase console (the app has no Admin SDK).
 */
export function removeUser(uid: string) {
  return deleteDoc(doc(db(), "users", uid));
}

/**
 * One-time admin tool: tag ended shifts that have NO event (legacy app) with an event.
 * Only shifts whose eventId is null are touched — real snapshots are never changed.
 * stockExempt keeps them out of inventory entirely (no deduction, never "pending").
 */
export async function tagShiftsWithEvent(shiftIds: string[], eventId: string) {
  const CHUNK = 450;
  for (let i = 0; i < shiftIds.length; i += CHUNK) {
    const b = writeBatch(db());
    shiftIds.slice(i, i + CHUNK).forEach((id) => b.update(doc(db(), "shifts", id), { eventId, stockExempt: true }));
    await b.commit();
  }
}

/** Admin-only: the two SEPARATE paper units (pack = staff shift changes, box = inventory restocks). */
export function savePaperSettings(p: PaperSettings) {
  if (!(p.sheetsPerPack > 0 && Number.isInteger(p.sheetsPerPack))) throw new Error("Sheets per pack must be a whole number above 0");
  if (!(p.sheetsPerBox > 0 && Number.isInteger(p.sheetsPerBox))) throw new Error("Sheets per box must be a whole number above 0");
  return setDoc(doc(db(), "settings", "paper"), { sheetsPerPack: p.sheetsPerPack, sheetsPerBox: p.sheetsPerBox }, { merge: true });
}
