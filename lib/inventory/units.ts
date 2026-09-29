import { aggregate } from "@/lib/shift/summary";
import type { Entry } from "@/lib/shift/types";
import type { StockDoc } from "./types";

/*
 * INVENTORY UNITS — BOXES, never packs (CLAUDE.md).
 *   Restock: admin enters N boxes → N × settings/paper.sheetsPerBox sheets.
 *   The PACK size belongs to the staff shift flow only and is never used here.
 */

export function boxesToSheets(boxes: number, sheetsPerBox: number): number {
  return boxes * sheetsPerBox;
}

/** Box equivalent for display, e.g. 346 sheets / 108 → 3.2 */
export function sheetsToBoxes(sheets: number, sheetsPerBox: number): number {
  if (sheetsPerBox <= 0) return 0;
  return Math.round((sheets / sheetsPerBox) * 10) / 10;
}

/**
 * What a shift actually consumed = sheets sold + hadr wasted, from its OWN entries.
 * This (not the reconciliation's "expected" figure) is what gets deducted from stock.
 */
export function shiftActualUsed(entries: Entry[]): number {
  const t = aggregate(entries);
  return Math.round((t.sheets + t.hadr) * 10) / 10;
}

export function isLow(stock: StockDoc | null | undefined): boolean {
  return !!stock && stock.currentQuantity < stock.lowStockThreshold;
}
