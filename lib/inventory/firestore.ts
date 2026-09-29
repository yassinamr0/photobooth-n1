import {
  collection,
  doc,
  increment,
  orderBy,
  query,
  limit,
  runTransaction,
  serverTimestamp,
  updateDoc,
  writeBatch,
  type DocumentData,
  type Timestamp,
} from "firebase/firestore";
import { firebase } from "@/lib/firebase/client";
import { listen } from "@/lib/firebase/listeners";
import type { Entry, Shift } from "@/lib/shift/types";
import { boxesToSheets, shiftActualUsed } from "./units";
import type { EventRecord, EventStatus, StockDoc, StockLog, StockType } from "./types";

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
  };
}

function parseStock(type: StockType, d: DocumentData): StockDoc {
  return {
    type,
    currentQuantity: num(d.currentQuantity),
    lowStockThreshold: num(d.lowStockThreshold),
    trackingSinceMs: ms(d.trackingSince) ?? Date.now(), // pending server timestamp → now
    updatedAtMs: ms(d.updatedAt),
  };
}

function parseLog(id: string, d: DocumentData): StockLog {
  return {
    id,
    stockType: d.stockType === "ink" ? "ink" : "paper",
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

/** Live stock docs for one event (paper + ink). `exists` tells us whether tracking was set up. */
export function watchEventStock(
  eventId: string,
  onChange: (stock: { paper: StockDoc | null; ink: StockDoc | null; fromServer: boolean }) => void,
) {
  return listen(collection(db(), "events", eventId, "stock"), (snap) => {
    let paper: StockDoc | null = null;
    let ink: StockDoc | null = null;
    snap.docs.forEach((d) => {
      if (d.id === "paper") paper = parseStock("paper", d.data());
      if (d.id === "ink") ink = parseStock("ink", d.data());
    });
    onChange({ paper, ink, fromServer: !snap.metadata.fromCache });
  });
}

/** Most recent stock logs for one event (newest first). */
export function watchEventLogs(eventId: string, onChange: (logs: StockLog[]) => void) {
  return listen(query(logsCol(eventId), orderBy("createdAt", "desc"), limit(300)), (snap) =>
    onChange(snap.docs.map((d) => parseLog(d.id, d.data()))),
  );
}

/**
 * Create the stock docs for an event that doesn't have them yet (e.g. the manual Phase-4 test
 * doc). Transactional so two admin tabs can't both initialise. Tracking starts now.
 */
export async function ensureStockDocs(eventId: string, sheetsPerBox: number) {
  await runTransaction(db(), async (tx) => {
    const [p, i] = await Promise.all([tx.get(stockRef(eventId, "paper")), tx.get(stockRef(eventId, "ink"))]);
    const base = { currentQuantity: 0, updatedAt: serverTimestamp(), trackingSince: serverTimestamp() };
    if (!p.exists()) tx.set(stockRef(eventId, "paper"), { ...base, lowStockThreshold: sheetsPerBox });
    if (!i.exists()) tx.set(stockRef(eventId, "ink"), { ...base, lowStockThreshold: 1 });
  });
}

/* ───────────────────────────── Events CRUD ───────────────────────────── */

export async function createEvent(name: string, notes: string, by: Actor, sheetsPerBox: number) {
  const ref = doc(collection(db(), "events"));
  const b = writeBatch(db());
  b.set(ref, { name: name.trim(), notes: notes.trim(), status: "active", createdAt: serverTimestamp(), createdBy: by.uid });
  const base = { currentQuantity: 0, updatedAt: serverTimestamp(), trackingSince: serverTimestamp() };
  // Default low-stock threshold for paper = one box (from settings, never hardcoded).
  b.set(stockRef(ref.id, "paper"), { ...base, lowStockThreshold: sheetsPerBox });
  b.set(stockRef(ref.id, "ink"), { ...base, lowStockThreshold: 1 });
  await b.commit();
  return ref.id;
}

export function updateEvent(eventId: string, patch: { name: string; notes: string }) {
  return updateDoc(eventRef(eventId), { name: patch.name.trim(), notes: patch.notes.trim() });
}

export function setEventStatus(eventId: string, status: EventStatus) {
  return updateDoc(eventRef(eventId), { status });
}

/* ───────────────────────────── Stock writes ───────────────────────────── */

/** Restock PAPER in BOXES → converted to sheets via sheetsPerBox. Logs both numbers. */
export async function restockPaper(eventId: string, boxes: number, sheetsPerBox: number, by: Actor) {
  if (!Number.isInteger(boxes) || boxes <= 0) throw new Error("Enter a whole number of boxes");
  const sheets = boxesToSheets(boxes, sheetsPerBox);
  const b = writeBatch(db());
  b.update(stockRef(eventId, "paper"), { currentQuantity: increment(sheets), updatedAt: serverTimestamp() });
  b.set(doc(logsCol(eventId)), {
    stockType: "paper", delta: sheets, kind: "restock", boxes, sheetsPerBox,
    reason: `Restock: ${boxes} box${boxes === 1 ? "" : "es"}`,
    byUid: by.uid, byName: by.name, createdAt: serverTimestamp(),
  });
  await b.commit();
  return sheets;
}

/** Restock INK (cartridges — no unit conversion). */
export async function restockInk(eventId: string, cartridges: number, by: Actor) {
  if (!Number.isInteger(cartridges) || cartridges <= 0) throw new Error("Enter a whole number of cartridges");
  const b = writeBatch(db());
  b.update(stockRef(eventId, "ink"), { currentQuantity: increment(cartridges), updatedAt: serverTimestamp() });
  b.set(doc(logsCol(eventId)), {
    stockType: "ink", delta: cartridges, kind: "restock", reason: `Restock: ${cartridges} cartridge${cartridges === 1 ? "" : "s"}`,
    byUid: by.uid, byName: by.name, createdAt: serverTimestamp(),
  });
  await b.commit();
}

/** Stock-take correction: set the counted amount; logs the difference. NOT a restock. */
export async function correctCount(eventId: string, type: StockType, counted: number, reason: string, by: Actor) {
  if (!Number.isFinite(counted) || counted < 0) throw new Error("Enter the counted amount");
  await runTransaction(db(), async (tx) => {
    const snap = await tx.get(stockRef(eventId, type));
    if (!snap.exists()) throw new Error("Inventory isn't set up for this event yet");
    const current = num(snap.data().currentQuantity);
    const delta = Math.round((counted - current) * 10) / 10;
    tx.update(stockRef(eventId, type), { currentQuantity: counted, updatedAt: serverTimestamp() });
    tx.set(doc(logsCol(eventId)), {
      stockType: type, delta, kind: "correction", reason: `Count correction${reason.trim() ? `: ${reason.trim()}` : ""}`,
      byUid: by.uid, byName: by.name, createdAt: serverTimestamp(),
    });
  });
}

export function setThreshold(eventId: string, type: StockType, threshold: number) {
  if (!Number.isFinite(threshold) || threshold < 0) throw new Error("Enter a threshold of 0 or more");
  return updateDoc(stockRef(eventId, type), { lowStockThreshold: threshold, updatedAt: serverTimestamp() });
}

/* ─────────────────────── Automatic shift consumption ─────────────────────── */

/**
 * Deduct a finished shift's ACTUAL paper use (sold + hadr) from the stock of the event the
 * SHIFT was stamped with. One atomic batch; security rules allow it once per shift.
 * Returns the sheets deducted, or null when the shift has no event (never guessed).
 */
export async function applyShiftDeduction(shift: Shift, entries: Entry[], by: Actor): Promise<number | null> {
  const eventId = shift.eventId; // the shift's own snapshot — NOT anyone's current assignment
  if (!eventId || shift.stockDeduction) return null;
  const sheets = shiftActualUsed(entries.filter((e) => e.shiftId === shift.id));
  const b = writeBatch(db());
  b.update(doc(db(), "shifts", shift.id), { stockDeduction: { eventId, sheets } });
  b.update(stockRef(eventId, "paper"), {
    currentQuantity: increment(-sheets),
    updatedAt: serverTimestamp(),
    lastShiftId: shift.id,
  });
  b.set(doc(logsCol(eventId), `shift_${shift.id}`), {
    stockType: "paper", delta: sheets === 0 ? 0 : -sheets, kind: "shift", reason: "Shift ended", shiftId: shift.id,
    byUid: by.uid, byName: by.name, createdAt: serverTimestamp(),
  });
  await b.commit();
  return sheets;
}
