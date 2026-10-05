import {
  collection,
  doc,
  getDocs,
  increment,
  orderBy,
  query,
  limit,
  runTransaction,
  serverTimestamp,
  updateDoc,
  where,
  writeBatch,
  type DocumentData,
  type DocumentReference,
  type Timestamp,
} from "firebase/firestore";
import { firebase } from "@/lib/firebase/client";
import { listen } from "@/lib/firebase/listeners";
import { queued } from "@/lib/firebase/offline";
import type { Entry, Shift } from "@/lib/shift/types";
import { boxesToSheets, shiftActualUsed, shiftFramesSold } from "./units";
import {
  DEDUCTION_FIELD,
  SHIFT_LOG_PREFIX,
  STOCK_INFO,
  STOCK_TYPES,
  type EventRecord,
  type EventStatus,
  type ShiftDeduction,
  type StockDoc,
  type StockLog,
  type StockType,
} from "./types";

/*
 * Per-event inventory writes. Paper is tracked in SHEETS; restocks are entered in BOXES
 * (settings/paper.sheetsPerBox). Automatic consumption deducts a shift's actualUsed
 * (sold + hadr) from the SHIFT'S OWN eventId — never the staff member's current assignment.
 */

const db = () => firebase().db;
const eventRef = (eventId: string) => doc(db(), "events", eventId);
const stockRef = (eventId: string, type: StockType) => doc(db(), "events", eventId, "stock", type);
const logsCol = (eventId: string) => collection(db(), "events", eventId, "stockLogs");

export type Actor = { uid: string; name: string };

const ms = (t: unknown) => ((t as Timestamp | null)?.toMillis?.() ?? null);
const num = (v: unknown, d = 0) => (typeof v === "number" && Number.isFinite(v) ? v : d);

export function parseEvent(id: string, d: DocumentData): EventRecord {
  return {
    id,
    name: typeof d.name === "string" && d.name.trim() ? d.name : id,
    notes: typeof d.notes === "string" ? d.notes : "",
    status: d.status === "inactive" ? "inactive" : "active", // manual Phase-4 docs → active
    createdAtMs: ms(d.createdAt),
    createdBy: typeof d.createdBy === "string" ? d.createdBy : null,
    startDate: isDay(d.startDate) ? d.startDate : null,
    endDate: isDay(d.endDate) ? d.endDate : null,
  };
}

const isDay = (v: unknown): v is string => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);

/** Event dates: start required for new events, end optional (ongoing) but never before the start. */
export type EventDates = { startDate: string; endDate: string | null };
function checkDates(d: EventDates) {
  if (!isDay(d.startDate)) throw new Error("Pick a start date.");
  if (d.endDate != null && !isDay(d.endDate)) throw new Error("End date isn't a valid date.");
  if (d.endDate && d.endDate < d.startDate) throw new Error("The end date can't be before the start date.");
}

export function parseStock(type: StockType, d: DocumentData): StockDoc {
  return {
    type,
    currentQuantity: num(d.currentQuantity),
    lowStockThreshold: num(d.lowStockThreshold),
    trackingSinceMs: ms(d.trackingSince) ?? Date.now(), // pending server timestamp → now
    updatedAtMs: ms(d.updatedAt),
    alertDismissed: d.alertDismissed === true,
  };
}

function parseLog(id: string, d: DocumentData): StockLog {
  return {
    id,
    stockType: (STOCK_TYPES as string[]).includes(d.stockType) ? d.stockType : "paper",
    delta: num(d.delta),
    reason: typeof d.reason === "string" ? d.reason : "",
    kind: ["restock", "correction", "shift", "shiftReversal"].includes(d.kind) ? d.kind : "correction",
    boxes: typeof d.boxes === "number" ? d.boxes : undefined,
    sheetsPerBox: typeof d.sheetsPerBox === "number" ? d.sheetsPerBox : undefined,
    shiftId: typeof d.shiftId === "string" ? d.shiftId : undefined,
    byUid: d.byUid ?? "",
    byName: d.byName ?? "",
    createdAtMs: ms(d.createdAt) ?? Date.now(),
  };
}

export type EventStock = Record<StockType, StockDoc | null>;

/** Live stock docs for one event (paper, ink, frames). A missing doc → null (not set up yet). */
export function watchEventStock(eventId: string, onChange: (stock: EventStock & { fromServer: boolean }) => void) {
  return listen(collection(db(), "events", eventId, "stock"), (snap) => {
    const stock: EventStock = { paper: null, ink: null, acrylic: null, magnetic: null };
    snap.docs.forEach((d) => {
      if ((STOCK_TYPES as string[]).includes(d.id)) stock[d.id as StockType] = parseStock(d.id as StockType, d.data());
    });
    onChange({ ...stock, fromServer: !snap.metadata.fromCache });
  });
}

/** Most recent stock logs for one event (newest first). */
export function watchEventLogs(eventId: string, onChange: (logs: StockLog[]) => void) {
  return listen(query(logsCol(eventId), orderBy("createdAt", "desc"), limit(300)), (snap) =>
    onChange(snap.docs.map((d) => parseLog(d.id, d.data()))),
  );
}

/** Default warning level per type — paper = one BOX (from settings, never hardcoded). */
const defaultThreshold = (type: StockType, sheetsPerBox: number) => {
  const d = STOCK_INFO[type].defaultThreshold;
  return d === "box" ? sheetsPerBox : d;
};

/**
 * Create the stock docs an event doesn't have yet (older events predate ink/frames).
 * Transactional so two admin tabs can't both initialise. Tracking starts now.
 */
export async function ensureStockDocs(eventId: string, sheetsPerBox: number) {
  await runTransaction(db(), async (tx) => {
    // Never resurrect stock for an event that has just been deleted.
    if (!(await tx.get(eventRef(eventId))).exists()) return;
    const snaps = await Promise.all(STOCK_TYPES.map((t) => tx.get(stockRef(eventId, t))));
    const base = { currentQuantity: 0, updatedAt: serverTimestamp(), trackingSince: serverTimestamp() };
    STOCK_TYPES.forEach((t, i) => {
      if (!snaps[i].exists()) tx.set(stockRef(eventId, t), { ...base, lowStockThreshold: defaultThreshold(t, sheetsPerBox) });
    });
  });
}

/* ───────────────────────────── Events CRUD ───────────────────────────── */

export async function createEvent(name: string, notes: string, by: Actor, sheetsPerBox: number, dates: EventDates) {
  checkDates(dates);
  const ref = doc(collection(db(), "events"));
  const b = writeBatch(db());
  b.set(ref, { name: name.trim(), notes: notes.trim(), status: "active", startDate: dates.startDate, endDate: dates.endDate, createdAt: serverTimestamp(), createdBy: by.uid });
  const base = { currentQuantity: 0, updatedAt: serverTimestamp(), trackingSince: serverTimestamp() };
  for (const t of STOCK_TYPES) b.set(stockRef(ref.id, t), { ...base, lowStockThreshold: defaultThreshold(t, sheetsPerBox) });
  await b.commit();
  return ref.id;
}

export function updateEvent(eventId: string, patch: { name: string; notes: string } & EventDates) {
  checkDates(patch);
  return updateDoc(eventRef(eventId), { name: patch.name.trim(), notes: patch.notes.trim(), startDate: patch.startDate, endDate: patch.endDate });
}

/**
 * Mark as ended → its end date becomes `today` (unless it already ended earlier);
 * Reopen → back to ongoing (end date cleared).
 */
export function setEventStatus(eventId: string, status: EventStatus, opts?: { today: string; endDate: string | null }) {
  if (status === "inactive" && opts) {
    const end = opts.endDate && opts.endDate <= opts.today ? opts.endDate : opts.today;
    return updateDoc(eventRef(eventId), { status, endDate: end });
  }
  return updateDoc(eventRef(eventId), status === "active" ? { status, endDate: null } : { status });
}

/**
 * Delete an event (admin). Always removes its stock counts + stock history and unassigns any
 * staff assigned to it. Its history:
 *   - "keep": past shifts and sales stay (shown as "Deleted event", still in Global totals);
 *     its one-off, whole-event and monthly expenses move to General — money totals for past
 *     dates don't change.
 *   - "all": its shifts, their sales/waste and its expenses are deleted too (can't be undone).
 * Refused while a shift is still running there. The event doc is deleted LAST, so if anything
 * fails half-way it can simply be retried (its stock goes in that same final batch).
 */
export async function deleteEvent(eventId: string, mode: "keep" | "all") {
  const d = db();
  const shifts = await getDocs(query(collection(d, "shifts"), where("eventId", "==", eventId)));
  if (shifts.docs.some((s) => !s.data().endTime)) {
    throw new Error("A shift is still running at this event — delete it after that shift ends.");
  }
  const ops: ((b: ReturnType<typeof writeBatch>) => void)[] = [];
  const del = (r: DocumentReference) => ops.push((b) => b.delete(r));
  const upd = (r: DocumentReference, data: DocumentData) => ops.push((b) => b.update(r, data));

  (await getDocs(collection(d, "events", eventId, "stockLogs"))).docs.forEach((x) => del(x.ref));
  // Stock counts go in the SAME final batch as the event doc (below), so nothing can see the
  // event without its stock and re-create it in between.
  const stockDocs = (await getDocs(collection(d, "events", eventId, "stock"))).docs;
  (await getDocs(query(collection(d, "users"), where("assignedEventId", "==", eventId)))).docs.forEach((u) => upd(u.ref, { assignedEventId: null }));
  for (const col of ["expenses", "recurringExpenses"]) {
    (await getDocs(query(collection(d, col), where("eventId", "==", eventId)))).docs.forEach((x) =>
      mode === "all" ? del(x.ref) : upd(x.ref, { eventId: null, ...(col === "expenses" ? { spread: null } : {}) }),
    );
  }
  if (mode === "all") {
    const ids = shifts.docs.map((s) => s.id);
    for (let i = 0; i < ids.length; i += 30) {
      (await getDocs(query(collection(d, "entries"), where("shiftId", "in", ids.slice(i, i + 30))))).docs.forEach((x) => del(x.ref));
    }
    shifts.docs.forEach((s) => del(s.ref));
  }
  for (let i = 0; i < ops.length; i += 450) {
    const b = writeBatch(d);
    ops.slice(i, i + 450).forEach((op) => op(b));
    await b.commit();
  }
  const last = writeBatch(d);
  stockDocs.forEach((x) => last.delete(x.ref));
  last.delete(eventRef(eventId));
  await last.commit();
}

/* ───────────────────────────── Stock writes ───────────────────────────── */

/*
 * Admin stock writes run as transactions so they can re-arm a "marked as read" low-stock
 * alert: once the new quantity is back AT OR ABOVE the warning level, alertDismissed is
 * cleared, so the alert shows again the next time stock drops low.
 */
const rearm = (quantity: number, threshold: number) => (quantity >= threshold ? { alertDismissed: false } : {});

async function adminAdjust(
  eventId: string,
  type: StockType,
  next: (current: number) => number,
  log: (current: number, updated: number) => Record<string, unknown> | null,
) {
  let updated = 0;
  await runTransaction(db(), async (tx) => {
    const snap = await tx.get(stockRef(eventId, type));
    if (!snap.exists()) throw new Error("Inventory isn't set up for this event yet");
    const current = num(snap.data().currentQuantity);
    updated = Math.round(next(current) * 10) / 10;
    tx.update(stockRef(eventId, type), {
      currentQuantity: updated,
      updatedAt: serverTimestamp(),
      ...rearm(updated, num(snap.data().lowStockThreshold)),
    });
    const l = log(current, updated);
    if (l) tx.set(doc(logsCol(eventId)), { ...l, stockType: type, createdAt: serverTimestamp() });
  });
  return updated;
}

/** Restock PAPER in BOXES → converted to sheets via sheetsPerBox. Logs both numbers. */
/**
 * Restock PAPER in BOXES → sheets via sheetsPerBox. Each box also comes with its ink, so
 * boxes × cartridgesPerBox cartridges are added to the SAME event's ink stock in the same
 * transaction (both logged). cartridgesPerBox null/0 → paper only.
 */
export async function restockPaper(eventId: string, boxes: number, sheetsPerBox: number, by: Actor, cartridgesPerBox: number | null = null) {
  if (!Number.isInteger(boxes) || boxes <= 0) throw new Error("Enter a whole number of boxes");
  const sheets = boxesToSheets(boxes, sheetsPerBox);
  const cartridges = cartridgesPerBox && cartridgesPerBox > 0 ? boxes * cartridgesPerBox : 0;
  const boxWord = `${boxes} box${boxes === 1 ? "" : "es"}`;
  await runTransaction(db(), async (tx) => {
    const pSnap = await tx.get(stockRef(eventId, "paper"));
    const iSnap = cartridges ? await tx.get(stockRef(eventId, "ink")) : null;
    if (!pSnap.exists() || (iSnap && !iSnap.exists())) throw new Error("Inventory isn't set up for this event yet");
    const bump = (ref: ReturnType<typeof stockRef>, data: DocumentData, add: number) => {
      const q = Math.round((num(data.currentQuantity) + add) * 10) / 10;
      tx.update(ref, { currentQuantity: q, updatedAt: serverTimestamp(), ...rearm(q, num(data.lowStockThreshold)) });
    };
    bump(stockRef(eventId, "paper"), pSnap.data(), sheets);
    tx.set(doc(logsCol(eventId)), {
      stockType: "paper", delta: sheets, kind: "restock", boxes, sheetsPerBox, reason: `Restock: ${boxWord}`,
      byUid: by.uid, byName: by.name, createdAt: serverTimestamp(),
    });
    if (iSnap) {
      bump(stockRef(eventId, "ink"), iSnap.data()!, cartridges);
      tx.set(doc(logsCol(eventId)), {
        stockType: "ink", delta: cartridges, kind: "restock", boxes,
        reason: `Restock: ink from ${boxWord} (${cartridgesPerBox} per box)`,
        byUid: by.uid, byName: by.name, createdAt: serverTimestamp(),
      });
    }
  });
  return { sheets, cartridges };
}

/** Restock ink or frames BY PIECE (no unit conversion). */
export async function restockPieces(eventId: string, type: Exclude<StockType, "paper">, count: number, by: Actor) {
  const { unit, unitOne } = STOCK_INFO[type];
  if (!Number.isInteger(count) || count <= 0) throw new Error(`Enter a whole number of ${unit}`);
  await adminAdjust(eventId, type, (c) => c + count, () => ({
    delta: count, kind: "restock", reason: `Restock: ${count} ${count === 1 ? unitOne : unit}`,
    byUid: by.uid, byName: by.name,
  }));
}

export const restockInk = (eventId: string, cartridges: number, by: Actor) => restockPieces(eventId, "ink", cartridges, by);

/** Stock-take correction: set the counted amount; logs the difference. NOT a restock. */
export async function correctCount(eventId: string, type: StockType, counted: number, reason: string, by: Actor) {
  if (!Number.isFinite(counted) || counted < 0) throw new Error("Enter the counted amount");
  await adminAdjust(eventId, type, () => counted, (current, updated) => ({
    delta: Math.round((updated - current) * 10) / 10, kind: "correction",
    reason: `Count correction${reason.trim() ? `: ${reason.trim()}` : ""}`,
    byUid: by.uid, byName: by.name,
  }));
}

export async function setThreshold(eventId: string, type: StockType, threshold: number) {
  if (!Number.isFinite(threshold) || threshold < 0) throw new Error("Enter a threshold of 0 or more");
  await runTransaction(db(), async (tx) => {
    const snap = await tx.get(stockRef(eventId, type));
    if (!snap.exists()) throw new Error("Inventory isn't set up for this event yet");
    tx.update(stockRef(eventId, type), {
      lowStockThreshold: threshold,
      updatedAt: serverTimestamp(),
      ...rearm(num(snap.data().currentQuantity), threshold),
    });
  });
}

/** "Mark as read" on a low-stock alert — hidden for every admin until stock is fixed. */
export function dismissLowStock(eventId: string, type: StockType) {
  return updateDoc(stockRef(eventId, type), { alertDismissed: true });
}

/* ─────────────────────── Automatic shift consumption ─────────────────────── */

/** Doc id of the (at most one) log per stock type written for a shift. */
export const shiftStockLogId = (type: StockType, shiftId: string) => `${SHIFT_LOG_PREFIX[type]}${shiftId}`;
export const shiftLogId = (shiftId: string) => shiftStockLogId("paper", shiftId);
export const shiftInkLogId = (shiftId: string) => shiftStockLogId("ink", shiftId);

/** What a shift takes from stock: paper = actual use, ink = logged changes, frames = sold. */
export function shiftConsumption(shift: Shift, entries: Entry[]): Omit<ShiftDeduction, "eventId"> {
  const own = entries.filter((e) => e.shiftId === shift.id);
  return {
    sheets: shiftActualUsed(own),
    cartridges: Math.max(0, Math.trunc(shift.inkChanges || 0)),
    ...shiftFramesSold(own),
  };
}

const SHIFT_LOG_REASON: Record<StockType, (n: number) => string> = {
  paper: () => "Shift ended",
  ink: (n) => `Shift ended — ${n} ink change${n === 1 ? "" : "s"}`,
  acrylic: (n) => `Shift ended — ${n} acrylic frame${n === 1 ? "" : "s"} sold`,
  magnetic: (n) => `Shift ended — ${n} magnetic frame${n === 1 ? "" : "s"} sold`,
};

/**
 * Deduct a finished shift's consumption from the stock of the event the SHIFT was stamped
 * with, in one atomic batch (security rules allow it once per shift):
 *   - paper:  the shift's ACTUAL use (sheets sold + hadr wasted) — always logged
 *   - ink:    the cartridges staff logged with "+ Ink change" (shift.inkChanges)
 *   - frames: acrylic / magnetic frames sold in the shift's own sale entries
 * Non-paper types are only written when above 0.
 * Returns what was deducted, or null when the shift has no event (never guessed) or is
 * stock-exempt (tagged with an event by an admin after the fact).
 */
export async function applyShiftDeduction(shift: Shift, entries: Entry[], by: Actor): Promise<ShiftDeduction | null> {
  const eventId = shift.eventId; // the shift's own snapshot — NOT anyone's current assignment
  if (!eventId || shift.stockDeduction || shift.stockExempt) return null;
  const amounts = shiftConsumption(shift, entries);
  const deduction: ShiftDeduction = { eventId, ...amounts };
  const b = writeBatch(db());
  b.update(doc(db(), "shifts", shift.id), { stockDeduction: deduction });
  for (const type of STOCK_TYPES) {
    const n = amounts[DEDUCTION_FIELD[type]];
    if (type !== "paper" && n <= 0) continue;
    b.update(stockRef(eventId, type), { currentQuantity: increment(-n), updatedAt: serverTimestamp(), lastShiftId: shift.id });
    b.set(doc(logsCol(eventId), shiftStockLogId(type, shift.id)), {
      stockType: type, delta: n === 0 ? 0 : -n, kind: "shift", reason: SHIFT_LOG_REASON[type](n), shiftId: shift.id,
      byUid: by.uid, byName: by.name, createdAt: serverTimestamp(),
    });
  }
  // Queued: at shift end with no signal, the deduction syncs with the shift when back online.
  await queued(b.commit());
  return deduction;
}
