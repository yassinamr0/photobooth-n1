import { addDays, customDays, isCustom, parseDay, rangeStart, rangeWindow } from "@/lib/admin/range";
import {
  scopeDashboard,
  scopeWindow,
  type DateRange,
  type RawDashboard,
  type Scope,
  type ScopedDashboard,
} from "@/lib/admin/scope";
import { aggregate, type ShiftTotals } from "@/lib/shift/summary";
import { sumUsage, trendBuckets, type Usage } from "./waste";

/*
 * Revenue insights (owner-approved additions after Phase 6):
 *   - revenue trend (adaptive granularity) + "vs same point last period"
 *   - cash vs visa trend
 *   - location comparison table
 * All built on scopeDashboard/scopeWindow, so the numbers always match Overview.
 * Money comes from SALE entries only (aggregate()); an entry counts toward the period its
 * SHIFT started in (orphan entries — shift deleted — by their own time, Global only).
 */

/* ───────────────────────── Previous-period comparison ───────────────────────── */

export type PeriodWindow = { from: Date; until: Date };

/**
 * Like-for-like windows. This week so far (Mon 00:00 → now) vs last week over the same
 * elapsed time; same for this month vs last month (clipped to last month's length).
 * "All time" has no previous period.
 */
export function comparisonWindows(range: DateRange, now: Date): { current: PeriodWindow; previous: PeriodWindow; previousLabel: string } | null {
  if (range === "all") return null;
  if (isCustom(range)) {
    // Custom: the same number of days immediately before.
    const { from, until } = rangeWindow(range, now) as PeriodWindow;
    const n = customDays(range);
    const previousLabel = n === 1 ? "the day before" : range.mode === "week" ? "the week before" : `the ${n} days before`;
    return { current: { from, until }, previous: { from: addDays(parseDay(range.from), -n), until: from }, previousLabel };
  }
  const start = rangeStart(range, now)!;
  const elapsed = now.getTime() - start.getTime();
  let prevStart: Date;
  let prevEnd: Date; // hard end of the previous period
  if (range === "week") {
    prevStart = new Date(start.getFullYear(), start.getMonth(), start.getDate() - 7);
    prevEnd = start;
  } else {
    prevStart = new Date(start.getFullYear(), start.getMonth() - 1, 1);
    prevEnd = start;
  }
  const until = new Date(Math.min(prevStart.getTime() + elapsed, prevEnd.getTime()));
  return {
    current: { from: start, until: now },
    previous: { from: prevStart, until },
    previousLabel: range === "week" ? "same point last week" : "same point last month",
  };
}

export type Comparison = {
  current: number;
  previous: number;
  /** Fractional change (0.12 = +12%); null when there was nothing last period. */
  change: number | null;
  previousLabel: string;
};

export function revenueComparison(raw: RawDashboard, scope: Scope, range: DateRange, now: Date): Comparison | null {
  const w = comparisonWindows(range, now);
  if (!w) return null;
  // Presets: the current period runs up to now (nothing later exists); custom: to its end.
  const current = scopeWindow(raw, scope, w.current.from, isCustom(range) ? w.current.until : null).overview.total;
  const previous = scopeWindow(raw, scope, w.previous.from, w.previous.until).overview.total;
  return {
    current,
    previous,
    change: previous > 0 ? (current - previous) / previous : null,
    previousLabel: w.previousLabel,
  };
}

/* ───────────────────────── Trend (revenue + cash/visa) ───────────────────────── */

export type MoneyPoint = { key: string; label: string; start: Date; totals: ShiftTotals; sales: number };

/**
 * Buckets the SCOPED entries (same data as Overview) by their shift's start date — daily for
 * This week, weekly for This month, monthly for All time (same buckets as the waste trend).
 */
export function moneyTrend(scoped: ScopedDashboard, range: DateRange, now: Date): MoneyPoint[] {
  const shiftStart = new Map(scoped.shifts.map((s) => [s.shift.id, new Date(s.shift.startTime)]));
  const dated = scoped.entries
    .filter((e) => e.type === "sale")
    .map((e) => ({ e, t: shiftStart.get(e.shiftId) ?? new Date(e.time) }))
    .filter((x) => !Number.isNaN(x.t.getTime()));
  const firstMs = dated.length ? Math.min(...dated.map((x) => x.t.getTime())) : null;
  const buckets = trendBuckets(range, now, firstMs);
  const lists = buckets.map(() => [] as typeof dated);
  for (const x of dated) {
    let i = -1;
    for (let j = 0; j < buckets.length; j++) if (buckets[j].start <= x.t) i = j;
    if (i >= 0) lists[i].push(x);
  }
  return buckets.map((b, i) => ({
    key: b.start.toISOString(),
    label: b.label,
    start: b.start,
    totals: aggregate(lists[i].map((x) => x.e)),
    sales: lists[i].length,
  }));
}

/* ───────────────────────── Location comparison ───────────────────────── */

export type LocationRow = {
  id: string | null; // null = shifts with no event
  name: string;
  revenue: number;
  cash: number;
  visa: number;
  sales: number;
  avgSale: number | null;
  sheets: number;
  waste: Usage;
  shifts: number;
  hours: number;
  revenuePerHour: number | null;
};

const HOUR = 3600_000;

function rowFrom(id: string | null, name: string, d: ScopedDashboard, now: Date): LocationRow {
  const sales = d.entries.filter((e) => e.type === "sale").length;
  const hours = d.shifts.reduce((h, s) => {
    const start = new Date(s.shift.startTime).getTime();
    const end = s.shift.endTime ? new Date(s.shift.endTime).getTime() : now.getTime();
    return h + Math.max(0, end - start) / HOUR;
  }, 0);
  return {
    id,
    name,
    revenue: d.overview.total,
    cash: d.overview.cash,
    visa: d.overview.visa,
    sales,
    avgSale: sales ? d.overview.total / sales : null,
    sheets: d.overview.sheets,
    waste: sumUsage(d.shifts),
    shifts: d.shifts.length,
    hours: Math.round(hours * 10) / 10,
    revenuePerHour: hours > 0 ? d.overview.total / hours : null,
  };
}

/**
 * One row per location, each computed with the SAME scoping as selecting that event in the
 * switcher (so a row always equals that event's Overview). Adds a "No event" row for
 * unattributed shifts when there are any. Sorted by revenue, highest first.
 */
export function locationComparison(raw: RawDashboard, range: DateRange, now: Date): LocationRow[] {
  const rows = raw.events.map((ev) => rowFrom(ev.id, ev.name, scopeDashboard(raw, ev.id, range, now), now));
  // Unattributed shifts: global minus every event's shifts (never guessed onto a location).
  const noEventRaw: RawDashboard = { ...raw, shifts: raw.shifts.filter((s) => !s.eventId) };
  const noEvent = scopeDashboard(noEventRaw, "global", range, now);
  // Orphan entries (their shift is gone) aren't shifts with no event — keep them out of this row.
  const unattributedEntries = noEvent.shifts.flatMap((s) => s.entries);
  const unattributed = { ...noEvent, entries: unattributedEntries, overview: aggregate(unattributedEntries) };
  if (unattributed.shifts.length) rows.push(rowFrom(null, "No event", unattributed, now));
  return rows.sort((a, b) => b.revenue - a.revenue || a.name.localeCompare(b.name));
}
