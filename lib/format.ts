const egp = new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 });

/** Formats an amount in Egyptian Pounds, e.g. 1200 → "1,200 EGP". Display only. */
export function formatEGP(amount: number): string {
  return `${egp.format(amount)} EGP`;
}
