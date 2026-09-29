const egp = new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 });

/** Formats an amount in Egyptian Pounds, e.g. 1200 → "1,200 EGP". Display only. */
export function formatEGP(amount: number): string {
  return `${egp.format(amount)} EGP`;
}

const grouped = new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 });

/** Any displayed count/amount with thousands separators, up to 1 decimal: 14400 → "14,400", 1234.5 → "1,234.5". */
export function fmtNum(n: number): string {
  return grouped.format(n);
}
