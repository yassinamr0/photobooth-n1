import { addDays, parseDay, rangeWindow, startOfDay, type DateRange } from "@/lib/admin/range";
import { scopeDashboard, scopeWindow, type RawDashboard, type Scope } from "@/lib/admin/scope";
import { comparisonWindows } from "@/lib/stats/revenue";
import { trendBuckets } from "@/lib/stats/waste";
import { recurringShare } from "./recurring";
import { EXPENSE_CATEGORIES, type Expense, type ExpenseCategory, type RecurringExpense } from "./types";

/*
 * Profit & loss. Revenue is EXACTLY the Overview figure for the same scope + range (sales
 * entries only, via scopeDashboard/scopeWindow). Expenses:
 *   - one-off: counted on its date;
 *   - recurring: spread evenly over the days of each month (recurring.ts).
 * Expenses are counted in whole local days, up to and including TODAY — like revenue, the
 * P&L is "to date": a future-dated expense or a future part of a month counts once it arrives.
 * Scope: an event → only that event's expenses. Global → everything, incl. General (eventId null).
 */

export type PnlInputs = { raw: RawDashboard; expenses: Expense[]; recurring: RecurringExpense[] };

export type ExpenseTotals = {
  total: number;
  byCategory: Record<ExpenseCategory, number>;
  oneOffs: Expense[]; // in the window, newest first
  recurring: { r: RecurringExpense; amount: number }[]; // share in the window (> 0)
};

const emptyCats = () => Object.fromEntries(EXPENSE_CATEGORIES.map((c) => [c, 0])) as Record<ExpenseCategory, number>;
const inScope = (scope: Scope) => (eventId: string | null) => scope === "global" || eventId === scope;

/** End of the day containing the last instant before `until` (whole-day windows). */
const dayCeil = (until: Date) => addDays(startOfDay(new Date(until.getTime() - 1)), 1);

/** First day any expense could count (for "All time"). */
function firstExpenseDay(inp: PnlInputs): Date | null {
  const days = [
    ...inp.expenses.map((e) => parseDay(e.date)),
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
  const out: ExpenseTotals = { total: 0, byCategory: emptyCats(), oneOffs: [], recurring: [] };
  const endToday = addDays(startOfDay(now), 1);
  let u = until ? dayCeil(until) : endToday;
  if (u > endToday) u = endToday;
  const f = from ? startOfDay(from) : firstExpenseDay(inp);
  if (!f || f >= u) return out;
  for (const e of inp.expenses) {
    if (!match(e.eventId)) continue;
    const d = parseDay(e.date);
    if (d < f || d >= u) continue;
    out.oneOffs.push(e);
    out.total += e.amount;
    out.byCategory[e.category] += e.amount;
  }
  for (const r of inp.recurring) {
    if (!match(r.eventId)) continue;
    const amount = recurringShare(r, f, u);
    if (amount <= 0) continue;
    out.recurring.push({ r, amount });
    out.total += amount;
    out.byCategory[r.category] += amount;
  }
  out.oneOffs.sort((a, b) => b.date.localeCompare(a.date));
  return out;
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
  const revenue = scopeDashboard(inp.raw, scope, range, now).overview.total;
  const expenses = expenseTotals(inp, inScope(scope), w.from, w.until, now);
  const profit = revenue - expenses.total;
  const cw = comparisonWindows(range, now);
  let previous: PnlSummary["previous"] = null;
  if (cw) {
    const pr = scopeWindow(inp.raw, scope, cw.previous.from, cw.previous.until).overview.total;
    const pe = expenseTotals(inp, inScope(scope), cw.previous.from, cw.previous.until, now).total;
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
    const revenue = scopeWindow(inp.raw, scope, b.start, until).overview.total;
    const expenses = expenseTotals(inp, inScope(scope), b.start, until, now).total;
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
  const rows = inp.raw.events.map((ev) =>
    row(ev.id, ev.name, scopeDashboard(inp.raw, ev.id, range, now).overview.total,
      expenseTotals(inp, (id) => id === ev.id, w.from, w.until, now).total),
  );
  const globalRevenue = scopeDashboard(inp.raw, "global", range, now).overview.total;
  const noEventRevenue = globalRevenue - rows.reduce((s, r) => s + r.revenue, 0);
  const general = expenseTotals(inp, (id) => !id || !ids.has(id), w.from, w.until, now).total;
  rows.sort((a, b) => b.profit - a.profit || a.name.localeCompare(b.name));
  if (Math.abs(noEventRevenue) > 0.004) rows.push(row(null, "No event", noEventRevenue, 0));
  if (general > 0.004) rows.push(row(null, "General", 0, general));
  return rows;
}
