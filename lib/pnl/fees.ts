/*
 * Card machine fees (admin setting, settings/fees). The owner picks either
 *   - "percent":          p% of the Visa amount, or
 *   - "percentPlusFixed": p% of the Visa amount + a fixed EGP amount per card transaction.
 * A setting stays in force until changed. Every change is stored as a step with the day it
 * starts from, so past periods keep the fee that applied then.
 * Only the VISA part of a sale pays the fee; a split cash+visa sale is ONE card transaction.
 */

export type FeeMode = "percent" | "percentPlusFixed";
export type FeeStep = { from: string /* YYYY-MM-DD */; mode: FeeMode; percent: number; fixed: number };

/** The fee in force on a day (null = no fee set yet → 0). */
export function feeOn(steps: FeeStep[], day: string): FeeStep | null {
  let cur: FeeStep | null = null;
  for (const s of [...steps].sort((a, b) => a.from.localeCompare(b.from))) if (s.from <= day) cur = s;
  return cur;
}

/** Fee on one sale's Visa amount. */
export function saleFee(step: FeeStep | null, visa: number): number {
  if (!step || !(visa > 0)) return 0;
  return (visa * step.percent) / 100 + (step.mode === "percentPlusFixed" ? step.fixed : 0);
}

export function describeFee(s: FeeStep | null): string {
  if (!s || (s.percent === 0 && (s.mode === "percent" || s.fixed === 0))) return "No fee";
  const p = `${new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(s.percent)}%`;
  return s.mode === "percentPlusFixed" ? `${p} + ${new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(s.fixed)} EGP per card sale` : `${p} of card sales`;
}

/** Add/replace the step starting on `day` (later steps are kept). */
export function withFeeFrom(steps: FeeStep[], step: FeeStep): FeeStep[] {
  return [...steps.filter((s) => s.from !== step.from), step].sort((a, b) => a.from.localeCompare(b.from));
}
