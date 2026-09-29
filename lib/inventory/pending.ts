import type { Shift } from "@/lib/shift/types";
import type { StockDoc } from "./types";

/**
 * Ended shifts whose paper hasn't been deducted yet — only for shifts tagged with an event
 * (their OWN snapshot eventId) that ended after that event's inventory tracking started.
 * Shown to admins with "Apply now".
 */
export function pendingDeductions(shifts: Shift[], paperByEvent: Map<string, StockDoc | null>): Shift[] {
  return shifts.filter((s) => {
    // stockExempt = tagged with an event by an admin after the fact; never touches stock.
    if (!s.endTime || !s.eventId || s.stockDeduction || s.stockExempt) return false;
    const paper = paperByEvent.get(s.eventId);
    if (!paper) return false; // event has no inventory tracking (yet)
    const since = paper.trackingSinceMs;
    return since == null || new Date(s.endTime).getTime() >= since;
  });
}

/** Ended shifts with no event — never auto-deducted from any location (we don't guess). */
export function unattributedShifts(shifts: Shift[]): Shift[] {
  return shifts.filter((s) => !!s.endTime && !s.eventId);
}
