import { addDays, dayKey, daysBetween, parseDay, startOfDay } from "@/lib/admin/range";
import type { RawDashboard } from "@/lib/admin/scope";

/*
 * The days an event (booth) actually runs, as local midnights: [from, until) — until is
 * exclusive (the day AFTER its last day). Used to:
 *   - stop monthly expenses tied to an event counting before it opened or after it ended;
 *   - split a "whole event" expense evenly over the event's days;
 *   - count break-even only over the days the booth was open.
 * Start: the event's startDate; older events without one fall back to the day of their first
 * shift (or the day they were created). End: endDate (inclusive); null = ongoing.
 */
export type EventSpan = {
  from: Date | null;
  until: Date | null;
  /** Start came from the first shift / creation day, not a saved start date. */
  startGuessed: boolean;
  startDate: string | null;
  endDate: string | null;
};

const OPEN: EventSpan = { from: null, until: null, startGuessed: false, startDate: null, endDate: null };

export function eventSpan(raw: Pick<RawDashboard, "events" | "shifts">, eventId: string): EventSpan {
  const ev = raw.events.find((e) => e.id === eventId);
  if (!ev) return OPEN;
  let startDate = ev.startDate ?? null;
  let startGuessed = false;
  if (!startDate) {
    const firstShift = raw.shifts
      .filter((s) => s.eventId === eventId)
      .map((s) => new Date(s.startTime).getTime())
      .filter((t) => !Number.isNaN(t))
      .reduce((m, t) => Math.min(m, t), Infinity);
    const t = Number.isFinite(firstShift) ? firstShift : ev.createdAtMs ?? null;
    if (t != null) {
      startDate = dayKey(new Date(t));
      startGuessed = true;
    }
  }
  const endDate = ev.endDate ?? null;
  return {
    from: startDate ? parseDay(startDate) : null,
    until: endDate ? addDays(parseDay(endDate), 1) : null,
    startGuessed,
    startDate,
    endDate,
  };
}

/** Intersect [from, until) with the span. null bounds = unbounded. */
export function clampToSpan(from: Date, until: Date, span: EventSpan): { from: Date; until: Date } {
  const f = span.from && span.from > from ? span.from : from;
  const u = span.until && span.until < until ? span.until : until;
  return { from: f, until: u };
}

/** Whole days the event runs (needs both ends), e.g. 28 Sep – 5 Oct = 8. */
export function spanDays(span: EventSpan): number | null {
  return span.from && span.until ? Math.max(1, daysBetween(span.from, span.until)) : null;
}

/** Whole days of overlap between [from, until) and the span. */
export function overlapDays(from: Date, until: Date, span: EventSpan): number {
  const c = clampToSpan(startOfDay(from), startOfDay(until), span);
  return c.until > c.from ? daysBetween(c.from, c.until) : 0;
}
