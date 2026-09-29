import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  query,
  serverTimestamp,
  updateDoc,
  where,
  type DocumentData,
} from "firebase/firestore";
import { firebase } from "@/lib/firebase/client";
import { listen } from "@/lib/firebase/listeners";
import { queued } from "@/lib/firebase/offline";
import type { UserProfile } from "@/lib/users";
import { parsePaperSettings, type PaperSettings } from "./paper";
import { saleDescription, type SaleCheck, type Payment } from "./sale";
import type { Cart } from "./pricing";
import type { Entry, Shift } from "./types";

/*
 * Shift + entry reads/writes. The /shifts and /entries collections are shared with the
 * legacy app (same shape), so both apps see the same live shift.
 * All subscriptions go through listen() so logout can detach them before signOut().
 */

const shiftsCol = () => collection(firebase().db, "shifts");
const entriesCol = () => collection(firebase().db, "entries");

const num = (v: unknown, d = 0) => (typeof v === "number" && Number.isFinite(v) ? v : d);
const numOrNull = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);

export function parseShift(id: string, d: DocumentData): Shift {
  return {
    id,
    uid: d.uid,
    staffName: d.staffName ?? "",
    eventId: typeof d.eventId === "string" ? d.eventId : null,
    startTime: d.startTime,
    endTime: d.endTime ?? null,
    startPaperCount: numOrNull(d.startPaperCount),
    paperChanges: num(d.paperChanges),
    inkChanges: num(d.inkChanges),
    endPaperCount: numOrNull(d.endPaperCount),
    sheetsPerPack: numOrNull(d.sheetsPerPack),
    paperVerified: d.paperVerified === true,
    stockDeduction:
      d.stockDeduction && typeof d.stockDeduction.eventId === "string"
        ? {
            eventId: d.stockDeduction.eventId,
            sheets: num(d.stockDeduction.sheets),
            cartridges: num(d.stockDeduction.cartridges),
            acrylic: num(d.stockDeduction.acrylic),
            magnetic: num(d.stockDeduction.magnetic),
          }
        : null,
    stockExempt: d.stockExempt === true,
    createdAt: d.createdAt ?? null,
  };
}

export function parseEntry(id: string, d: DocumentData): Entry {
  const common = {
    id,
    uid: d.uid,
    staffName: d.staffName ?? "",
    shiftId: d.shiftId,
    time: d.time,
    desc: d.desc ?? "",
    total: num(d.total),
    cash: num(d.cash),
    visa: num(d.visa),
  };
  if (d.type === "waste") return { ...common, type: "waste", hadr: num(d.hadr) };
  return {
    ...common,
    type: "sale",
    sheets: num(d.sheets),
    frames: { Acrylic: num(d.frames?.Acrylic), Magnetic: num(d.frames?.Magnetic) },
    custom: Array.isArray(d.custom) ? d.custom : [],
  };
}

/** The signed-in staff member's open shift (endTime == null), or null. */
export function watchActiveShift(
  uid: string,
  onChange: (shift: Shift | null) => void,
  onError: (e: Error) => void,
) {
  const q = query(shiftsCol(), where("uid", "==", uid), where("endTime", "==", null));
  return listen(
    q,
    (snap) => {
      if (snap.empty) return onChange(null);
      // Should only ever be one; if the legacy app left a stray, use the most recent.
      const shifts = snap.docs.map((d) => parseShift(d.id, d.data()));
      shifts.sort((a, b) => (b.startTime ?? "").localeCompare(a.startTime ?? ""));
      onChange(shifts[0]);
    },
    onError,
  );
}

/** Entries for ONE shift (current-shift-only summary). */
export function watchShiftEntries(
  uid: string,
  shiftId: string,
  onChange: (entries: Entry[]) => void,
  onError: (e: Error) => void,
) {
  const q = query(entriesCol(), where("uid", "==", uid), where("shiftId", "==", shiftId));
  return listen(q, (snap) => onChange(snap.docs.map((d) => parseEntry(d.id, d.data()))), onError);
}

export function watchPaperSettings(onChange: (s: PaperSettings) => void) {
  return listen(
    doc(firebase().db, "settings", "paper"),
    (snap) => onChange(parsePaperSettings(snap.data())),
    () => onChange(parsePaperSettings(undefined)),
  );
}

/**
 * Start a shift. eventId is a ONE-TIME SNAPSHOT of the profile's assignedEventId right now
 * (CLAUDE.md). It is written once here and never recomputed; security rules also require it
 * to equal the user's assignedEventId at creation time.
 */
export function startShift(profile: UserProfile, startPaperCount: number, sheetsPerPack: number) {
  return queued(addDoc(shiftsCol(), {
    uid: profile.uid,
    staffName: profile.name,
    eventId: profile.assignedEventId ?? null,
    startTime: new Date().toISOString(),
    endTime: null,
    startPaperCount,
    paperChanges: 0,
    inkChanges: 0,
    endPaperCount: null,
    // Snapshot of the pack size in force now, so later settings changes never rewrite this
    // shift's reconciliation. Rules require it to equal settings/paper.sheetsPerPack.
    sheetsPerPack,
    createdAt: serverTimestamp(),
  }));
}

export function setStartPaperCount(shiftId: string, startPaperCount: number) {
  return queued(updateDoc(doc(shiftsCol(), shiftId), { startPaperCount }));
}

/**
 * +1 / −1 PACK (never a box). Clamped at 0. Returns false if nothing changed.
 */
export async function adjustPaperChanges(shift: Shift, delta: 1 | -1) {
  const next = Math.max(0, (shift.paperChanges || 0) + delta);
  if (next === shift.paperChanges) return false;
  await queued(updateDoc(doc(shiftsCol(), shift.id), { paperChanges: next }));
  return true;
}

/** +1 / −1 ink CARTRIDGE swapped in. Clamped at 0. Returns false if nothing changed. */
export async function adjustInkChanges(shift: Shift, delta: 1 | -1) {
  const next = Math.max(0, (shift.inkChanges || 0) + delta);
  if (next === (shift.inkChanges || 0)) return false;
  await queued(updateDoc(doc(shiftsCol(), shift.id), { inkChanges: next }));
  return true;
}

export function endShift(shiftId: string, start: Date, end: Date, endPaperCount: number) {
  return queued(updateDoc(doc(shiftsCol(), shiftId), {
    startTime: start.toISOString(),
    endTime: end.toISOString(),
    endPaperCount,
  }));
}

export function logSale(profile: UserProfile, shift: Shift, cart: Cart, payment: Payment, check: SaleCheck) {
  return queued(addDoc(entriesCol(), {
    uid: profile.uid,
    staffName: profile.name,
    shiftId: shift.id,
    time: new Date().toISOString(),
    type: "sale",
    sheets: cart.sheets,
    frames: { Acrylic: cart.frames.Acrylic, Magnetic: cart.frames.Magnetic },
    custom: cart.custom.map((c) => ({ id: c.id, name: c.name, price: c.price })),
    desc: saleDescription(cart),
    total: check.total,
    cash: payment.cash,
    visa: payment.visa,
    createdAt: serverTimestamp(),
  }));
}

export function logWaste(profile: UserProfile, shift: Shift, hadr: number, cost: number) {
  return queued(addDoc(entriesCol(), {
    uid: profile.uid,
    staffName: profile.name,
    shiftId: shift.id,
    time: new Date().toISOString(),
    type: "waste",
    hadr,
    desc: `Hadr waste (${hadr})`,
    total: cost || 0,
    cash: 0,
    visa: 0,
    createdAt: serverTimestamp(),
  }));
}

export function deleteEntry(entryId: string) {
  return queued(deleteDoc(doc(entriesCol(), entryId)));
}
