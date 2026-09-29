/*
 * What things cost the owner (admin setting, settings/costs). Used ONLY for analysis:
 * profit per product, what waste cost, and break-even. Never subtracted from the headline
 * P&L again — stock purchases are already entered there as expenses.
 * Paper is priced per BOX (converted with settings/paper.sheetsPerBox — never the pack size).
 * Each change is a step from a day on; earlier days keep the older costs.
 */

export type CostStep = {
  from: string; // YYYY-MM-DD
  paperBox: number | null; // EGP per box of paper
  inkCartridge: number | null; // EGP per cartridge
  acrylic: number | null; // EGP per acrylic frame
  magnetic: number | null; // EGP per magnetic frame
};

export function costsOn(steps: CostStep[], day: string): CostStep | null {
  let cur: CostStep | null = null;
  for (const s of [...steps].sort((a, b) => a.from.localeCompare(b.from))) if (s.from <= day) cur = s;
  return cur;
}

export function withCostsFrom(steps: CostStep[], step: CostStep): CostStep[] {
  return [...steps.filter((s) => s.from !== step.from), step].sort((a, b) => a.from.localeCompare(b.from));
}

/** EGP per sheet of paper from the BOX price. */
export function paperPerSheet(c: CostStep | null, sheetsPerBox: number): number | null {
  if (!c || c.paperBox == null || !(sheetsPerBox > 0)) return null;
  return c.paperBox / sheetsPerBox;
}
