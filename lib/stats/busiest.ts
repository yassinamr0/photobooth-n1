import type { Entry } from "@/lib/shift/types";

/*
 * Stat 1 — Busiest hours. SALE entries only, bucketed by each entry's OWN timestamp
 * (device-local time) into weekday × hour. Input is already event/date-range scoped.
 */

export const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

export type Cell = { sales: number; egp: number };

export type BusiestHours = {
  grid: Cell[][]; // [weekday 0=Mon..6=Sun][hour 0..23]
  byHour: Cell[]; // 24
  byWeekday: Cell[]; // 7
  total: Cell;
  max: number; // max sales in any cell (for the color scale)
  peak: { weekday: number; hour: number; cell: Cell } | null;
};

const empty = (): Cell => ({ sales: 0, egp: 0 });

/** JS getDay() is Sun=0; the grid is Monday-first. */
export const mondayIndex = (d: Date) => (d.getDay() + 6) % 7;

export function busiestHours(entries: Entry[]): BusiestHours {
  const grid = Array.from({ length: 7 }, () => Array.from({ length: 24 }, empty));
  const byHour = Array.from({ length: 24 }, empty);
  const byWeekday = Array.from({ length: 7 }, empty);
  const total = empty();
  for (const e of entries) {
    if (e.type !== "sale" || !e.time) continue;
    const d = new Date(e.time);
    if (Number.isNaN(d.getTime())) continue;
    const w = mondayIndex(d);
    const h = d.getHours();
    for (const c of [grid[w][h], byHour[h], byWeekday[w], total]) {
      c.sales += 1;
      c.egp += e.total || 0;
    }
  }
  let max = 0;
  let peak: BusiestHours["peak"] = null;
  grid.forEach((row, w) =>
    row.forEach((cell, h) => {
      if (cell.sales > max || (cell.sales === max && max > 0 && peak && cell.egp > peak.cell.egp)) {
        max = cell.sales;
        peak = { weekday: w, hour: h, cell };
      }
    }),
  );
  return { grid, byHour, byWeekday, total, max, peak };
}

export const hourLabel = (h: number) => `${String(h).padStart(2, "0")}:00`;
