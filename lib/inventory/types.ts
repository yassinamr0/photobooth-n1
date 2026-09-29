/*
 * Per-event inventory types. Paper is stored in RAW SHEETS; ink in cartridges.
 * Restocks are entered in BOXES (settings/paper.sheetsPerBox) — never packs.
 */

export type StockType = "paper" | "ink";

export type EventStatus = "active" | "inactive";

export type EventRecord = {
  id: string;
  name: string;
  notes: string;
  status: EventStatus;
  createdAtMs: number | null;
  createdBy: string | null;
};

export type StockDoc = {
  type: StockType;
  currentQuantity: number;
  lowStockThreshold: number;
  /** When inventory tracking started for this event — shifts that ended earlier are never back-deducted. */
  trackingSinceMs: number | null;
  updatedAtMs: number | null;
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
  logs: StockLog[]; // newest first
};
