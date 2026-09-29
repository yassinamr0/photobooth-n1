/*
 * Date ranges for the admin switcher: the presets (This week · This month · All time) plus a
 * CUSTOM range — a single day, a Mon–Sun week, or any from–to span (both ends inclusive).
 * Everything is in LOCAL time (same as the rest of the dashboard). Pure + unit-tested.
 */

export type RangePreset = "week" | "month" | "all";
export type CustomMode = "day" | "week" | "range";
/** from / to are local calendar days, "YYYY-MM-DD", inclusive. */
export type CustomRange = { kind: "custom"; mode: CustomMode; from: string; to: string };
export type DateRange = RangePreset | CustomRange;

export const isCustom = (r: DateRange): r is CustomRange => typeof r === "object" && r !== null && r.kind === "custom";

const DAY_KEY = /^\d{4}-\d{2}-\d{2}$/;

/** Monday 00:00 local (matches the legacy app). */
export function startOfWeek(now: Date) {
  const d = new Date(now);
  const day = d.getDay();
  d.setDate(d.getDate() + (day === 0 ? -6 : 1 - day));
  d.setHours(0, 0, 0, 0);
  return d;
}

export function startOfMonth(now: Date) {
  return new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
}

export function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/** Calendar-safe (DST-safe) day arithmetic. */
export function addDays(d: Date, n: number) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
}

export function dayKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** "YYYY-MM-DD" → local midnight of that day. */
export function parseDay(key: string) {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
}

/** Whole calendar days between two local midnights. */
export function daysBetween(a: Date, b: Date) {
  return Math.round((startOfDay(b).getTime() - startOfDay(a).getTime()) / 86_400_000);
}

/**
 * Build a normalised custom range:
 *   day   → just `a`
 *   week  → the Mon–Sun week containing `a`
 *   range → `a`…`b`, swapped if picked backwards
 */
export function customRange(mode: CustomMode, a: string, b?: string): CustomRange {
  if (mode === "day") return { kind: "custom", mode, from: a, to: a };
  if (mode === "week") {
    const mon = startOfWeek(parseDay(a));
    return { kind: "custom", mode, from: dayKey(mon), to: dayKey(addDays(mon, 6)) };
  }
  const end = b ?? a;
  return a <= end ? { kind: "custom", mode, from: a, to: end } : { kind: "custom", mode, from: end, to: a };
}

/** Step a Day / Week custom range back or forward by one day / one week. */
export function shiftCustom(r: CustomRange, dir: -1 | 1): CustomRange {
  const n = r.mode === "week" ? 7 : r.mode === "day" ? 1 : daysBetween(parseDay(r.from), parseDay(r.to)) + 1;
  return { ...r, from: dayKey(addDays(parseDay(r.from), dir * n)), to: dayKey(addDays(parseDay(r.to), dir * n)) };
}

/**
 * The time window a range covers: [from, until). null = unbounded.
 * Presets run from their start up to now (until = null); custom ranges end at midnight after
 * their last day.
 */
export function rangeWindow(range: DateRange, now: Date): { from: Date | null; until: Date | null } {
  if (isCustom(range)) return { from: parseDay(range.from), until: addDays(parseDay(range.to), 1) };
  if (range === "week") return { from: startOfWeek(now), until: null };
  if (range === "month") return { from: startOfMonth(now), until: null };
  return { from: null, until: null };
}

/** Kept for existing callers: the start of a range (null = all time). */
export function rangeStart(range: DateRange, now: Date): Date | null {
  return rangeWindow(range, now).from;
}

/** Number of days in a custom range (inclusive). */
export function customDays(r: CustomRange) {
  return daysBetween(parseDay(r.from), parseDay(r.to)) + 1;
}

const fmt = (d: Date, o: Intl.DateTimeFormatOptions) => d.toLocaleDateString("en-US", o);

/**
 * Human wording, used inside sentences: "this week", "all time",
 * "Tue, Sep 29, 2026", "Sep 28 – Oct 4, 2026".
 */
export function rangeLabel(range: DateRange): string {
  if (range === "week") return "this week";
  if (range === "month") return "this month";
  if (range === "all") return "all time";
  const a = parseDay(range.from);
  const b = parseDay(range.to);
  if (range.from === range.to) return fmt(a, { weekday: "short", month: "short", day: "numeric", year: "numeric" });
  const sameYear = a.getFullYear() === b.getFullYear();
  return `${fmt(a, { month: "short", day: "numeric", ...(sameYear ? {} : { year: "numeric" }) })} – ${fmt(b, { month: "short", day: "numeric", year: "numeric" })}`;
}

/** Short chip text for the Custom tab: "Sep 29", "Sep 28 – Oct 4". */
export function rangeChip(r: CustomRange): string {
  const a = parseDay(r.from);
  const b = parseDay(r.to);
  if (r.from === r.to) return fmt(a, { month: "short", day: "numeric" });
  return `${fmt(a, { month: "short", day: "numeric" })} – ${fmt(b, { month: "short", day: "numeric" })}`;
}

/** Validates a range loaded from storage. */
export function parseStoredRange(v: unknown): DateRange | null {
  if (v === "week" || v === "month" || v === "all") return v;
  if (v && typeof v === "object") {
    const r = v as Partial<CustomRange>;
    if (
      r.kind === "custom" && (r.mode === "day" || r.mode === "week" || r.mode === "range") &&
      typeof r.from === "string" && typeof r.to === "string" && DAY_KEY.test(r.from) && DAY_KEY.test(r.to) && r.from <= r.to
    ) return { kind: "custom", mode: r.mode, from: r.from, to: r.to };
  }
  return null;
}
