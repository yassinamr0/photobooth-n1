import { collection, deleteDoc, doc, increment, serverTimestamp, setDoc, updateDoc, writeBatch } from "firebase/firestore";
import { firebase } from "@/lib/firebase/client";
import { listen } from "@/lib/firebase/listeners";
import { parseEntry, parseShift, watchPaperSettings } from "@/lib/shift/firestore";
import { parseUserDoc, type UserProfile } from "@/lib/users";
import type { Entry, Shift } from "@/lib/shift/types";
import { parseEvent } from "@/lib/inventory/firestore";
import type { EventRecord } from "@/lib/inventory/types";
import type { PaperSettings } from "@/lib/shift/paper";

/*
 * Admin reads + writes. Every subscription goes through listen() (logout-safe).
 * The dashboard holds ONE set of these listeners; sections consume scoped data only
 * (see lib/admin/scope.ts).
 */

const db = () => firebase().db;

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
 * puts those sheets back and logs a reversal — stock always equals restocks − existing shifts.
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
  const final = writeBatch(db());
  const d = shift.stockDeduction;
  if (d && d.sheets > 0) {
    final.update(doc(db(), "events", d.eventId, "stock", "paper"), {
      currentQuantity: increment(d.sheets),
      updatedAt: serverTimestamp(),
    });
    final.set(doc(collection(db(), "events", d.eventId, "stockLogs")), {
      stockType: "paper", delta: d.sheets, kind: "shiftReversal", reason: "Shift deleted — sheets restored",
      shiftId: shift.id, byUid: by.uid, byName: by.name, createdAt: serverTimestamp(),
    });
  }
  final.delete(doc(db(), "shifts", shift.id));
  await final.commit();
}

/** Admin-only: the two SEPARATE paper units (pack = staff shift changes, box = inventory restocks). */
export function savePaperSettings(p: PaperSettings) {
  if (!(p.sheetsPerPack > 0 && Number.isInteger(p.sheetsPerPack))) throw new Error("Sheets per pack must be a whole number above 0");
  if (!(p.sheetsPerBox > 0 && Number.isInteger(p.sheetsPerBox))) throw new Error("Sheets per box must be a whole number above 0");
  return setDoc(doc(db(), "settings", "paper"), { sheetsPerPack: p.sheetsPerPack, sheetsPerBox: p.sheetsPerBox }, { merge: true });
}
