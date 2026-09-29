import type { DateRange, ScopedShift } from "@/lib/admin/scope";
import { rangeStart, startOfWeek } from "@/lib/admin/scope";

/*
 * Stat 2 — Waste rate = hadr ÷ (sheets sold + hadr). Input is already event/date-range scoped
 * (ScopedShift carries each shift's own entries + totals).
 */

/** "Unusually high" = at least this many × the scope's overall rate… */
export const HIGH_RATIO = 1.5;
/** …AND at least this many percentage points above it… */
export const HIGH_MIN_POINTS = 0.02;
/** …AND based on at least this many sheets used (so one bad print isn't a crisis). */
export const HIGH_MIN_SHEETS = 10;
/** "Climbing" = the last N non-empty trend points each strictly higher than the one before. */
export const CLIMB_POINTS = 3;

export type Usage = { sold: number; hadr: number; used: number; rate: number | null };

const round1 = (n: number) => Math.round(n * 10) / 10;

export function usage(sold: number, hadr: number): Usage {
  const used = round1(sold + hadr);
  return { sold: round1(sold), hadr: round1(hadr), used, rate: used > 0 ? hadr / used : null };
}

/** High relative to a baseline rate (the overall rate for the same scope/range). */
export function isHigh(u: Usage, baseline: number | null): boolean {
  if (u.rate == null || u.used < HIGH_MIN_SHEETS) return false;
  const base = baseline ?? 0;
  return u.rate >= base * HIGH_RATIO && u.rate - base >= HIGH_MIN_POINTS;
}

export function sumUsage(shifts: ScopedShift[]): Usage {
  let sold = 0;
  let hadr = 0;
  for (const s of shifts) {
    sold += s.totals.sheets;
    hadr += s.totals.hadr;
  }
  return usage(sold, hadr);
}

export type TrendPoint = {
  key: string;
  label: string;
  start: Date;
  usage: Usage; // rate null = no usage that bucket (gap, not 0%)
  high: boolean;
};

export type Granularity = "day" | "week" | "month";

export const granularityFor = (range: DateRange): Granularity =>
  range === "week" ? "day" : range === "month" ? "week" : "month";

const dayKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);

/**
 * Bucket starts for the trend, adaptive to the range:
 *   week → each day Mon..today · month → each Monday-start week, clipped to the month
 *   all → each month from the first month with data to this month.
 */
export function trendBuckets(range: DateRange, now: Date, firstDataMs: number | null): { start: Date; label: string }[] {
  const g = granularityFor(range);
  const out: { start: Date; label: string }[] = [];
  if (g === "day") {
    for (let d = startOfWeek(now); d <= now; d = addDays(d, 1))
      out.push({ start: d, label: d.toLocaleDateString(undefined, { weekday: "short" }) });
  } else if (g === "week") {
    const monthStart = rangeStart("month", now)!;
    for (let d = monthStart; d <= now; d = addDays(startOfWeek(d), 7))
      out.push({ start: d, label: `${d.toLocaleDateString(undefined, { month: "short" })} ${d.getDate()}` });
  } else {
    const first = firstDataMs == null ? new Date(now.getFullYear(), now.getMonth(), 1) : new Date(firstDataMs);
    for (let d = new Date(first.getFullYear(), first.getMonth(), 1); d <= now; d = new Date(d.getFullYear(), d.getMonth() + 1, 1))
      out.push({ start: d, label: d.toLocaleDateString(undefined, { month: "short", year: "2-digit" }) });
  }
  return out;
}

/** Trend of waste rate over the range, each shift counted in the bucket of its START date. */
export function wasteTrend(shifts: ScopedShift[], range: DateRange, now: Date, overall: Usage): TrendPoint[] {
  const firstMs = shifts.length ? Math.min(...shifts.map((s) => new Date(s.shift.startTime).getTime())) : null;
  const buckets = trendBuckets(range, now, firstMs);
  const lists: ScopedShift[][] = buckets.map(() => []);
  for (const s of shifts) {
    const t = new Date(s.shift.startTime);
    // last bucket whose start <= t
    let i = -1;
    for (let j = 0; j < buckets.length; j++) if (buckets[j].start <= t) i = j;
    if (i >= 0) lists[i].push(s);
  }
  return buckets.map((b, i) => {
    const u = sumUsage(lists[i]);
    return { key: dayKey(b.start), label: b.label, start: b.start, usage: u, high: isHigh(u, overall.rate) };
  });
}

/** Last CLIMB_POINTS non-empty points each strictly higher than the previous one. */
export function isClimbing(points: TrendPoint[]): boolean {
  const rates = points.map((p) => p.usage.rate).filter((r): r is number => r != null);
  if (rates.length < CLIMB_POINTS) return false;
  const tail = rates.slice(-CLIMB_POINTS);
  return tail.every((r, i) => i === 0 || r > tail[i - 1]);
}

export const pct = (rate: number | null) => (rate == null ? "—" : `${round1(rate * 100)}%`);
