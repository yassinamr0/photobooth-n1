import { collection, deleteDoc, doc, updateDoc, writeBatch } from "firebase/firestore";
import { firebase } from "@/lib/firebase/client";
import { listen } from "@/lib/firebase/listeners";
import { parseEntry, parseShift, watchPaperSettings } from "@/lib/shift/firestore";
import { parseUserDoc, type UserProfile } from "@/lib/users";
import type { Entry, Shift } from "@/lib/shift/types";
import type { EventDoc } from "./scope";

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
  events: (e: EventDoc[]) => void;
  sheetsPerPack: (n: number) => void;
  error: (label: string, e: Error) => void;
};

export function watchDashboard(h: Handlers) {
  const unsubs = [
    listen(collection(db(), "users"), (s) => h.users(s.docs.map((d) => parseUserDoc(d.id, d.data()))), (e) => h.error("Users", e)),
    listen(collection(db(), "shifts"), (s) => h.shifts(s.docs.map((d) => parseShift(d.id, d.data()))), (e) => h.error("Shifts", e)),
    listen(collection(db(), "entries"), (s) => h.entries(s.docs.map((d) => parseEntry(d.id, d.data()))), (e) => h.error("Entries", e)),
    listen(
      collection(db(), "events"),
      (s) =>
        h.events(
          s.docs
            .map((d) => ({ id: d.id, name: typeof d.data().name === "string" && d.data().name ? d.data().name : d.id }))
            .sort((a, b) => a.name.localeCompare(b.name)),
        ),
      (e) => h.error("Events", e),
    ),
    watchPaperSettings((p) => h.sheetsPerPack(p.sheetsPerPack)),
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

/** Irreversibly delete a shift AND every entry logged under it (batched, chunked). */
export async function deleteShiftAndEntries(shiftId: string, entryIds: string[]) {
  const CHUNK = 450;
  for (let i = 0; i < entryIds.length; i += CHUNK) {
    const batch = writeBatch(db());
    entryIds.slice(i, i + CHUNK).forEach((id) => batch.delete(doc(db(), "entries", id)));
    await batch.commit();
  }
  await deleteDoc(doc(db(), "shifts", shiftId));
}
