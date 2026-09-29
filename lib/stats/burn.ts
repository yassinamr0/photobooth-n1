import type { InventoryRow } from "@/lib/inventory/scope";
import { STOCK_TYPES, type StockType } from "@/lib/inventory/types";

/*
 * Stat 3 — Inventory burn-rate projection. Reuses the Phase 5 figure (forecastStock, 14-day
 * rolling average) computed in scopeInventory — so Statistics and Inventory can never disagree.
 * Covers every tracked stock type (paper, ink, acrylic + magnetic frames).
 */

/** Locations running out within this many days get the warning treatment. */
export const RUNS_OUT_SOON_DAYS = 7;

export type BurnRow = {
  row: InventoryRow;
  days: Record<StockType, number | null>;
  warn: boolean;
};

export const runsOutSoon = (d: number | null) => d != null && d <= RUNS_OUT_SOON_DAYS;

export function burnRows(rows: InventoryRow[]): BurnRow[] {
  return rows
    .filter((r) => r.tracked)
    .map((r) => {
      const days = Object.fromEntries(STOCK_TYPES.map((t) => [t, r.forecasts[t]?.daysLeft ?? null])) as Record<StockType, number | null>;
      const warn = STOCK_TYPES.some((t) => runsOutSoon(days[t]) || r.low[t]);
      return { row: r, days, warn };
    })
    .sort((a, b) => soonest(a) - soonest(b) || a.row.event.name.localeCompare(b.row.event.name));
}

function soonest(b: BurnRow) {
  const ds = STOCK_TYPES.map((t) => b.days[t]).filter((d): d is number => d != null);
  return ds.length ? Math.min(...ds) : Number.POSITIVE_INFINITY;
}
