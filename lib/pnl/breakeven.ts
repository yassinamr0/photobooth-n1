/*
 * Break-even per day for a location (or Global).
 *   fixed per day     = manual expenses in the range (monthly spread + one-offs) ÷ days
 *   variable share    = (materials + card fees) ÷ revenue   — costs that grow with sales
 *   break-even / day  = fixed per day ÷ (1 − variable share)
 * Days = days in the range up to and including today.
 */

export type BreakEven = {
  days: number;
  fixedPerDay: number;
  variableShare: number | null; // null = no revenue to measure it on
  breakEvenPerDay: number | null; // null = variable costs eat everything (≥ 100%)
  avgPerDay: number;
  covered: boolean | null;
  /** Break-even in 0.5-sheet prints (200 EGP each). */
  printsPerDay: number | null;
};

export function breakEven(o: { revenue: number; fixed: number; variable: number; days: number }): BreakEven {
  const days = Math.max(1, o.days);
  const fixedPerDay = o.fixed / days;
  const variableShare = o.revenue > 0 ? o.variable / o.revenue : null;
  const v = variableShare ?? 0;
  const breakEvenPerDay = v >= 1 ? null : fixedPerDay / (1 - v);
  const avgPerDay = o.revenue / days;
  return {
    days,
    fixedPerDay,
    variableShare,
    breakEvenPerDay,
    avgPerDay,
    covered: breakEvenPerDay == null ? false : o.fixed === 0 && o.revenue === 0 ? null : avgPerDay >= breakEvenPerDay,
    printsPerDay: breakEvenPerDay == null ? null : breakEvenPerDay / 200,
  };
}
