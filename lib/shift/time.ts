const DAY_MS = 24 * 60 * 60 * 1000;

/** "HH:MM" in device-local time. */
export function toHHMM(d: Date): string {
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function onDate(base: Date, hhmm: string): Date {
  const [h, m] = hhmm.split(":").map(Number);
  const d = new Date(base);
  d.setHours(h, m, 0, 0);
  return d;
}

/**
 * Resolve the actual start/end the staff member entered when ending a shift.
 * Both times are placed on the shift's start date (device local time).
 * Midnight rollover (CLAUDE.md): if the entered end time is EARLIER than the entered start
 * time, the shift crossed midnight → add 24h to the end instead of a negative duration.
 */
export function resolveShiftTimes(baseDateISO: string, startHHMM: string, endHHMM: string) {
  const base = new Date(baseDateISO);
  const start = onDate(base, startHHMM);
  let end = onDate(base, endHHMM);
  const crossesMidnight = end.getTime() < start.getTime();
  if (crossesMidnight) end = new Date(end.getTime() + DAY_MS);
  return { start, end, crossesMidnight, durationMs: end.getTime() - start.getTime() };
}

export function fmtDuration(ms: number) {
  const mins = Math.round(ms / 60000);
  return `${Math.floor(mins / 60)}h ${String(mins % 60).padStart(2, "0")}m`;
}

export const isHHMM = (s: string) => /^([01]\d|2[0-3]):[0-5]\d$/.test(s);
