/*
 * Per-event inventory types.
 *   paper    — stored in RAW SHEETS; restocked in BOXES (settings/paper.sheetsPerBox), never packs
 *   ink      — cartridges
 *   acrylic  — frames, pieces
 *   magnetic — frames, pieces
 */

export type StockType = "paper" | "ink" | "acrylic" | "magnetic";
export const STOCK_TYPES: StockType[] = ["paper", "ink", "acrylic", "magnetic"];

/** Display info per stock type. */
export const STOCK_INFO: Record<StockType, { label: string; unit: string; unitOne: string; defaultThreshold: number | "box" }> = {
  paper: { label: "Paper", unit: "sheets", unitOne: "sheet", defaultThreshold: "box" }, // one box, from settings
  ink: { label: "Ink", unit: "cartridges", unitOne: "cartridge", defaultThreshold: 1 },
  acrylic: { label: "Acrylic frames", unit: "frames", unitOne: "frame", defaultThreshold: 5 },
  magnetic: { label: "Magnetic frames", unit: "frames", unitOne: "frame", defaultThreshold: 5 },
};

export type EventStatus = "active" | "inactive";

export type EventRecord = {
  id: string;
  name: string;
  notes: string;
  status: EventStatus;
  createdAtMs: number | null;
  createdBy: string | null;
  /** First day the booth runs (YYYY-MM-DD). null on older events → first shift's day is used. */
  startDate: string | null;
  /** Last day it runs (YYYY-MM-DD, inclusive). null = ongoing / not known yet. */
  endDate: string | null;
};

export type StockDoc = {
  type: StockType;
  currentQuantity: number;
  lowStockThreshold: number;
  /** When inventory tracking started for this event — shifts that ended earlier are never back-deducted. */
  trackingSinceMs: number | null;
  updatedAtMs: number | null;
  /** Admin marked the low-stock alert as read; cleared when stock is back at/above the threshold. */
  alertDismissed: boolean;
};

export type StockLogKind = "restock" | "correction" | "shift" | "shiftReversal";

export type StockLog = {
  id: string;
  stockType: StockType;
  delta: number;
  reason: string;
  kind: StockLogKind;
  boxes?: number;
  sheetsPerBox?: number;
  shiftId?: string;
  byUid: string;
  byName: string;
  createdAtMs: number | null;
};

/** Stock + logs per event id. */
export type EventInventory = {
  paper: StockDoc | null;
  ink: StockDoc | null;
  acrylic: StockDoc | null;
  magnetic: StockDoc | null;
  logs: StockLog[]; // newest first
};

export const emptyInventory = (): EventInventory => ({ paper: null, ink: null, acrylic: null, magnetic: null, logs: [] });

/** What a shift's end-of-shift deduction took from its event (stored on the shift). */
export type ShiftDeduction = {
  eventId: string;
  sheets: number; // paper
  cartridges: number; // ink
  acrylic: number;
  magnetic: number;
};

/** Log doc ids — at most one log per stock type per shift (enforced by security rules). */
export const SHIFT_LOG_PREFIX: Record<StockType, string> = {
  paper: "shift_",
  ink: "shiftink_",
  acrylic: "shiftacr_",
  magnetic: "shiftmag_",
};
/** Field on stockDeduction that holds each type's amount. */
export const DEDUCTION_FIELD: Record<StockType, keyof Omit<ShiftDeduction, "eventId">> = {
  paper: "sheets",
  ink: "cartridges",
  acrylic: "acrylic",
  magnetic: "magnetic",
};
