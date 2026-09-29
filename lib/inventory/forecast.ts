import type { StockLog } from "./types";

export const FORECAST_WINDOW_DAYS = 14;
const DAY_MS = 24 * 60 * 60 * 1000;

export type Forecast = {
  avgPerDay: number; // sheets/day over the window (0 = no usage)
  windowDays: number; // days actually averaged over
  daysLeft: number | null; // null = not enough data / no consumption
};

/**
 * Rolling average daily PAPER consumption from shift deductions (minus reversals) over the
 * last 14 days, or since tracking started if that's more recent (at least 1 day).
 * → "at this rate, stock runs out in ≈ daysLeft days".
 */
export function forecastPaper(
  logs: StockLog[],
  currentSheets: number,
  trackingSinceMs: number | null,
  nowMs: number,
): Forecast {
  const windowStart = nowMs - FORECAST_WINDOW_DAYS * DAY_MS;
  const since = trackingSinceMs ?? nowMs;
  const windowDays = Math.max(1, Math.min(FORECAST_WINDOW_DAYS, (nowMs - Math.max(since, windowStart)) / DAY_MS));
  let consumed = 0;
  for (const l of logs) {
    if (l.stockType !== "paper" || l.createdAtMs == null || l.createdAtMs < windowStart) continue;
    if (l.kind === "shift") consumed += -l.delta;
    else if (l.kind === "shiftReversal") consumed -= l.delta;
  }
  const avgPerDay = Math.max(0, consumed) / windowDays;
  const daysLeft = avgPerDay > 0 ? Math.max(0, Math.floor(currentSheets / avgPerDay)) : null;
  return { avgPerDay: Math.round(avgPerDay * 10) / 10, windowDays: Math.round(windowDays * 10) / 10, daysLeft };
}
