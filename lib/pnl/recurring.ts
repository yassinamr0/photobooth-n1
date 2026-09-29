import { addDays, dayKey, startOfDay } from "@/lib/admin/range";
import type { AmountStep, RecurringExpense } from "./types";

/*
 * Recurring (monthly) expenses, SPREAD across the days of each month:
 *   daily share = that month's amount ÷ days in that month
 * so Sep rent of 3,000 is 100/day, Feb rent of 2,800 is 100/day in a 28-day February.
 * A window gets (days of the month it covers) × (that month's daily share).
 */

export const monthKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
const daysInMonth = (y: number, m0: number) => new Date(y, m0 + 1, 0).getDate();

/** The amount in force for a month: the latest step whose `from` ≤ month. */
export function amountFor(steps: AmountStep[], month: string): number {
  let amt = 0;
  for (const s of [...steps].sort((a, b) => a.from.localeCompare(b.from))) if (s.from <= month) amt = s.amount;
  return amt;
}

/**
 * How much of a recurring expense falls in [from, until) — whole local days.
 * from/until are local midnights (until exclusive).
 */
export function recurringShare(r: RecurringExpense, from: Date, until: Date): number {
  let total = 0;
  let d = startOfDay(from);
  const end = startOfDay(until);
  while (d < end) {
    const y = d.getFullYear();
    const m0 = d.getMonth();
    const nextMonth = new Date(y, m0 + 1, 1);
    const segEnd = nextMonth < end ? nextMonth : end;
    const month = monthKey(d);
    if (month >= r.startMonth && (!r.endMonth || month <= r.endMonth)) {
      const days = Math.round((segEnd.getTime() - d.getTime()) / 86_400_000);
      total += (amountFor(r.amounts, month) * days) / daysInMonth(y, m0);
    }
    d = segEnd;
  }
  return total;
}

/** Monthly amount as of today (for the list). */
export function currentAmount(r: RecurringExpense, now: Date) {
  return amountFor(r.amounts, monthKey(now));
}

/** Is it still counting this month? */
export function isActive(r: RecurringExpense, now: Date) {
  const m = monthKey(now);
  return m >= r.startMonth && (!r.endMonth || m <= r.endMonth);
}

/** Change the monthly amount from `month` onward (earlier months keep their amount). */
export function withAmountFrom(steps: AmountStep[], month: string, amount: number): AmountStep[] {
  return [...steps.filter((s) => s.from !== month), { from: month, amount }].sort((a, b) => a.from.localeCompare(b.from));
}

export { addDays, dayKey };
