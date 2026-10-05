import { addDays, dayKey, daysBetween, parseDay, rangeWindow, startOfDay, type DateRange } from "@/lib/admin/range";
import { scopeDashboard, scopeWindow, type RawDashboard, type Scope, type ScopedDashboard } from "@/lib/admin/scope";
import { breakEven, type BreakEven } from "./breakeven";
import type { CostStep } from "./costs";
import { feeOn, saleFee, type FeeStep } from "./fees";
import { productBreakdown, type ProductBreakdown } from "./products";
import { comparisonWindows } from "@/lib/stats/revenue";
import { trendBuckets } from "@/lib/stats/waste";
import { recurringShare } from "./recurring";
import { clampToSpan, eventSpan, overlapDays, spanDays, type EventSpan } from "./eventSpan";
import { EXPENSE_CATEGORIES, type Expense, type ExpenseCategory, type RecurringExpense } from "./types";

/*
 * Profit & loss. Revenue is EXACTLY the Overview figure for the same scope + range (sales
 * entries only, via scopeDashboard/scopeWindow). Expenses:
 *   - one-off: counted on its date;
 *   - recurring: spread evenly over the days of each month (recurring.ts), and — when tied to
 *     an event — only on the days that event runs (eventSpan.ts);
 *   - whole-event: split evenly over the event's days.
 * Expenses are counted in whole local days, up to and including TODAY — like revenue, the
 * P&L is "to date": a future-dated expense or a future part of a month counts once it arrives.
 * Scope: an event → only that event's expenses. Global → everything, incl. General (eventId null).
 */

export type PnlInputs = {
  raw: RawDashboard;
  expenses: Expense[];
  recurring: RecurringExpense[];
  fees?: FeeStep[];
  costs?: CostStep[];
  sheetsPerBox?: number;
};

/** Manual categories + the automatic "Card fees" line. */
export type PnlCategory = ExpenseCategory | "cardFees";

export type ExpenseTotals = {
  total: number; // manual expenses + card fees
  manual: number; // one-offs + monthly (what break-even treats as fixed)
  cardFees: number;
  byCategory: Record<PnlCategory, number>;
  oneOffs: Expense[]; // in the window, newest first
  /** What each one-off counts in the window (a whole-event expense counts only its share). */
  oneOffAmounts: Record<string, number>;
  recurring: { r: RecurringExpense; amount: number }[]; // share in the window (> 0)
};

const emptyCats = () => Object.fromEntries([...EXPENSE_CATEGORIES, "cardFees"].map((c) => [c, 0])) as Record<PnlCategory, number>;
const inScope = (scope: Scope) => (eventId: string | null) => scope === "global" || eventId === scope;

/** End of the day containing the last instant before `until` (whole-day windows). */
const dayCeil = (until: Date) => addDays(startOfDay(new Date(until.getTime() - 1)), 1);

/** First day any expense could count (for "All time"). */
function firstExpenseDay(inp: PnlInputs): Date | null {
  const days = [
    // A whole-event expense starts counting on its event's first day (its stored date can be
    // stale if the event's dates were changed after it was added).
    ...inp.expenses.map((e) => {
      const d = parseDay(e.date);
      const from = e.spread === "event" && e.eventId ? eventSpan(inp.raw, e.eventId).from : null;
      return from && from < d ? from : d;
    }),
    ...inp.recurring.map((r) => parseDay(`${r.startMonth}-01`)),
  ];
  return days.length ? new Date(Math.min(...days.map((d) => d.getTime()))) : null;
}

/** Expenses matching `match` in [from, until) (null = unbounded), whole days, capped at today. */
export function expenseTotals(
  inp: PnlInputs,
  match: (eventId: string | null) => boolean,
  from: Date | null,
  until: Date | null,
  now: Date,
): ExpenseTotals {
  const out: ExpenseTotals = { total: 0, manual: 0, cardFees: 0, byCategory: emptyCats(), oneOffs: [], oneOffAmounts: {}, recurring: [] };
  const endToday = addDays(startOfDay(now), 1);
  let u = until ? dayCeil(until) : endToday;
  if (u > endToday) u = endToday;
  const f = from ? startOfDay(from) : firstExpenseDay(inp);
  if (!f || f >= u) return out;
  const spans = new Map<string, EventSpan>();
  const spanOf = (id: string) => {
    if (!spans.has(id)) spans.set(id, eventSpan(inp.raw, id));
    return spans.get(id)!;
  };
  for (const e of inp.expenses) {
    if (!match(e.eventId)) continue;
    let amount = 0;
    const span = e.spread === "event" && e.eventId ? spanOf(e.eventId) : null;
    const total = span ? spanDays(span) : null;
    if (span && total) {
      // Whole-event expense: its share of the event's days that fall in the window.
      amount = (e.amount * overlapDays(f, u, span)) / total;
    } else {
      const d = parseDay(e.date);
      if (d >= f && d < u) amount = e.amount;
    }
    if (amount <= 0.004) continue;
    out.oneOffs.push(e);
    out.oneOffAmounts[e.id] = amount;
    out.total += amount;
    out.byCategory[e.category] += amount;
  }
  for (const r of inp.recurring) {
    if (!match(r.eventId)) continue;
    // Tied to an event → only the days it runs.
    const w = r.eventId && inp.raw.events.some((ev) => ev.id === r.eventId) ? clampToSpan(f, u, spanOf(r.eventId)) : { from: f, until: u };
    const amount = w.until > w.from ? recurringShare(r, w.from, w.until) : 0;
    if (amount <= 0) continue;
    out.recurring.push({ r, amount });
    out.total += amount;
    out.byCategory[r.category] += amount;
  }
  out.oneOffs.sort((a, b) => b.date.localeCompare(a.date));
  out.manual = out.total;
  return out;
}

/**
 * Card machine fees on the scoped sales: each sale's Visa amount, with the fee setting in
 * force on the day its SHIFT started (orphan entries: their own day).
 */
export function cardFeesFor(d: ScopedDashboard, fees: FeeStep[] = []): number {
  if (!fees.length) return 0;
  const startDay = new Map(d.shifts.map((s) => [s.shift.id, dayKey(new Date(s.shift.startTime))]));
  let total = 0;
  for (const e of d.entries) {
    if (e.type !== "sale" || !(e.visa > 0)) continue;
    const day = startDay.get(e.shiftId) ?? dayKey(new Date(e.time || Date.now()));
    total += saleFee(feeOn(fees, day), e.visa);
  }
  return total;
}

function addFees(t: ExpenseTotals, fees: number): ExpenseTotals {
  return { ...t, cardFees: fees, total: t.total + fees, byCategory: { ...t.byCategory, cardFees: fees } };
}

export type PnlSummary = {
  revenue: number;
  expenses: ExpenseTotals;
  profit: number;
  /** profit ÷ revenue; null with no revenue. */
  margin: number | null;
  previous: { revenue: number; expenses: number; profit: number; label: string } | null;
};

export function pnlSummary(inp: PnlInputs, scope: Scope, range: DateRange, now: Date): PnlSummary {
  const w = rangeWindow(range, now);
  const scoped = scopeDashboard(inp.raw, scope, range, now);
  const revenue = scoped.overview.total;
  const expenses = addFees(expenseTotals(inp, inScope(scope), w.from, w.until, now), cardFeesFor(scoped, inp.fees));
  const profit = revenue - expenses.total;
  const cw = comparisonWindows(range, now);
  let previous: PnlSummary["previous"] = null;
  if (cw) {
    const prevScoped = scopeWindow(inp.raw, scope, cw.previous.from, cw.previous.until);
    const pr = prevScoped.overview.total;
    const pe = expenseTotals(inp, inScope(scope), cw.previous.from, cw.previous.until, now).total + cardFeesFor(prevScoped, inp.fees);
    previous = { revenue: pr, expenses: pe, profit: pr - pe, label: cw.previousLabel };
  }
  return { revenue, expenses, profit, margin: revenue > 0 ? profit / revenue : null, previous };
}

export type PnlPoint = { key: string; label: string; revenue: number; expenses: number; profit: number };

/** Revenue vs expenses per period, same buckets as the other trends. */
export function pnlTrend(inp: PnlInputs, scope: Scope, range: DateRange, now: Date): PnlPoint[] {
  const w = rangeWindow(range, now);
  const shiftStarts = inp.raw.shifts
    .filter((s) => scope === "global" || s.eventId === scope)
    .map((s) => new Date(s.startTime).getTime())
    .filter((t) => !Number.isNaN(t));
  const fe = firstExpenseDay(inp)?.getTime();
  const firsts = [...shiftStarts, ...(fe != null ? [fe] : [])];
  const buckets = trendBuckets(range, now, firsts.length ? Math.min(...firsts) : null);
  return buckets.map((b, i) => {
    const until = buckets[i + 1]?.start ?? w.until;
    const d = scopeWindow(inp.raw, scope, b.start, until);
    const revenue = d.overview.total;
    const expenses = expenseTotals(inp, inScope(scope), b.start, until, now).total + cardFeesFor(d, inp.fees);
    return { key: b.start.toISOString(), label: b.label, revenue, expenses, profit: revenue - expenses };
  });
}

export type PnlLocationRow = { id: string | null; name: string; revenue: number; expenses: number; profit: number; margin: number | null };

/**
 * Global breakdown: one row per location (= that event's own P&L), plus "No event" revenue
 * (shifts without an event) and "General" expenses (not tied to a booth). Rows add up to
 * the Global P&L exactly.
 */
export function pnlByLocation(inp: PnlInputs, range: DateRange, now: Date): PnlLocationRow[] {
  const w = rangeWindow(range, now);
  const ids = new Set(inp.raw.events.map((e) => e.id));
  const row = (id: string | null, name: string, revenue: number, expenses: number): PnlLocationRow => ({
    id, name, revenue, expenses, profit: revenue - expenses, margin: revenue > 0 ? (revenue - expenses) / revenue : null,
  });
  let eventFees = 0;
  const rows = inp.raw.events.map((ev) => {
    const d = scopeDashboard(inp.raw, ev.id, range, now);
    const fees = cardFeesFor(d, inp.fees);
    eventFees += fees;
    return row(ev.id, ev.name, d.overview.total, expenseTotals(inp, (id) => id === ev.id, w.from, w.until, now).total + fees);
  });
  const globalScoped = scopeDashboard(inp.raw, "global", range, now);
  // Whatever Global has beyond the events = sales with no event (and their card fees).
  const noEventRevenue = globalScoped.overview.total - rows.reduce((s, r) => s + r.revenue, 0);
  const noEventFees = cardFeesFor(globalScoped, inp.fees) - eventFees;
  const general = expenseTotals(inp, (id) => !id || !ids.has(id), w.from, w.until, now).total;
  rows.sort((a, b) => b.profit - a.profit || a.name.localeCompare(b.name));
  if (Math.abs(noEventRevenue) > 0.004 || noEventFees > 0.004) rows.push(row(null, "No event", noEventRevenue, noEventFees));
  if (general > 0.004) rows.push(row(null, "General", 0, general));
  return rows;
}

/**
 * Days the range covers up to and including today (All time: from the scope's first data).
 * For one event: only the days it was open (its start date → end date), so a booth that
 * opened on the 12th isn't judged on the 1st–11th. 0 = not open at all in the range.
 */
function daysToDate(inp: PnlInputs, scope: Scope, range: DateRange, now: Date): number {
  const w = rangeWindow(range, now);
  const endToday = addDays(startOfDay(now), 1);
  let until = w.until && w.until < endToday ? w.until : endToday;
  let from = w.from;
  if (!from) {
    const starts = inp.raw.shifts
      .filter((s) => scope === "global" || s.eventId === scope)
      .map((s) => new Date(s.startTime).getTime())
      .filter((t) => !Number.isNaN(t));
    const fe = firstExpenseDay({ ...inp, expenses: inp.expenses.filter((e) => inScope(scope)(e.eventId)), recurring: inp.recurring.filter((r) => inScope(scope)(r.eventId)) });
    const all = [...starts, ...(fe ? [fe.getTime()] : [])];
    from = all.length ? startOfDay(new Date(Math.min(...all))) : startOfDay(now);
  }
  if (scope !== "global") {
    const c = clampToSpan(startOfDay(from), until, eventSpan(inp.raw, scope));
    from = c.from;
    until = c.until;
    if (until <= from) return 0;
  }
  return Math.max(1, daysBetween(from, until));
}

/** Profit per product + waste cost for a scope/range (analysis only). */
export function pnlProducts(inp: PnlInputs, scope: Scope, range: DateRange, now: Date): ProductBreakdown {
  const d = scopeDashboard(inp.raw, scope, range, now);
  return productBreakdown(d, inp.fees ?? [], inp.costs ?? [], inp.sheetsPerBox ?? 0);
}

export type BreakEvenRow = { id: string | null; name: string; be: BreakEven; materialsMissing: boolean; notOpen: boolean };

/** Break-even for one scope (a location, or Global incl. General costs). */
export function pnlBreakEven(inp: PnlInputs, scope: Scope, range: DateRange, now: Date): { be: BreakEven; materialsMissing: boolean; notOpen: boolean } {
  const s = pnlSummary(inp, scope, range, now);
  const products = pnlProducts(inp, scope, range, now);
  const materials = products.materials ?? products.rows.reduce((t, r) => t + (r.materials ?? 0), 0);
  const days = daysToDate(inp, scope, range, now);
  return {
    be: breakEven({ revenue: s.revenue, fixed: s.expenses.manual, variable: materials + s.expenses.cardFees, days }),
    materialsMissing: products.missingCosts,
    /** The event wasn't running on any day of the selected dates. */
    notOpen: days === 0,
  };
}

/** Break-even per location (ended events left out). */
export function breakEvenByLocation(inp: PnlInputs, range: DateRange, now: Date, endedIds: Set<string>): BreakEvenRow[] {
  return inp.raw.events
    .filter((ev) => !endedIds.has(ev.id))
    .map((ev) => ({ id: ev.id, name: ev.name, ...pnlBreakEven(inp, ev.id, range, now) }));
}
