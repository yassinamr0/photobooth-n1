import type { InventoryRow } from "@/lib/inventory/scope";

/*
 * Stat 3 — Inventory burn-rate projection. Reuses the Phase 5 figure (forecastStock, 14-day
 * rolling average) computed in scopeInventory — so Statistics and Inventory can never disagree.
 */

/** Locations running out within this many days get the warning treatment. */
export const RUNS_OUT_SOON_DAYS = 7;

export type BurnRow = {
  row: InventoryRow;
  paperDays: number | null;
  inkDays: number | null;
  warn: boolean;
};

export function burnRows(rows: InventoryRow[]): BurnRow[] {
  return rows
    .filter((r) => r.tracked)
    .map((r) => {
      const paperDays = r.forecast?.daysLeft ?? null;
      const inkDays = r.inkForecast?.daysLeft ?? null;
      const soon = [paperDays, inkDays].some((d) => d != null && d <= RUNS_OUT_SOON_DAYS);
      return { row: r, paperDays, inkDays, warn: soon || r.paperLow || r.inkLow };
    })
    .sort((a, b) => soonest(a) - soonest(b) || a.row.event.name.localeCompare(b.row.event.name));
}

function soonest(b: BurnRow) {
  const ds = [b.paperDays, b.inkDays].filter((d): d is number => d != null);
  return ds.length ? Math.min(...ds) : Number.POSITIVE_INFINITY;
}
