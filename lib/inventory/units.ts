import { aggregate } from "@/lib/shift/summary";
import type { Entry } from "@/lib/shift/types";
import { fmtNum } from "@/lib/format";
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

/** Frames a shift sold (from its OWN sale entries) — deducted from frame stock at shift end. */
export function shiftFramesSold(entries: Entry[]): { acrylic: number; magnetic: number } {
  const t = aggregate(entries);
  return { acrylic: Math.max(0, Math.trunc(t.acrylic)), magnetic: Math.max(0, Math.trunc(t.magnetic)) };
}

/** Below its location's warning level. */
export function isLow(stock: StockDoc | null | undefined): boolean {
  return !!stock && stock.currentQuantity < stock.lowStockThreshold;
}

/** Low AND not marked as read → shows as an active alert. */
export function isAlerting(stock: StockDoc | null | undefined): boolean {
  return isLow(stock) && !stock!.alertDismissed;
}

/** "1.5 sheets, 1 ink cartridge and 2 acrylic frames" — only the non-zero parts (paper always). */
export function describeDeduction(d: { sheets: number; cartridges: number; acrylic?: number; magnetic?: number }): string {
  const plural = (n: number, one: string, many: string) => `${fmtNum(n)} ${n === 1 ? one : many}`;
  const parts = [plural(d.sheets, "sheet", "sheets")];
  if (d.cartridges > 0) parts.push(plural(d.cartridges, "ink cartridge", "ink cartridges"));
  if ((d.acrylic ?? 0) > 0) parts.push(plural(d.acrylic!, "acrylic frame", "acrylic frames"));
  if ((d.magnetic ?? 0) > 0) parts.push(plural(d.magnetic!, "magnetic frame", "magnetic frames"));
  return parts.length === 1 ? parts[0] : `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`;
}
