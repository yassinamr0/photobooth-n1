import { aggregate, type ShiftTotals } from "@/lib/shift/summary";
import { reconcileShift, type Reconciliation } from "@/lib/shift/paper";
import type { Entry, Shift } from "@/lib/shift/types";
import type { UserProfile } from "@/lib/users";

/*
 * THE event-scope switcher, as a pure function.
 *
 * Every admin section (Overview, Staff, Shifts, Staff history) renders ONLY what this returns —
 * never raw Firestore data — so no section can ignore the selected scope. Pending approvals is
 * the one exception (always global) and reads raw users directly.
 *
 * Rules:
 * - A shift is in scope if its startTime is in the date range AND (Global OR shift.eventId ==
 *   the selected event). eventId is the one-time snapshot stamped at shift creation.
 * - Entries carry no eventId: an entry belongs to whatever its shift belongs to, and counts
 *   toward the date range its SHIFT started in (so every section adds up the same).
 * - Orphan entries (shift deleted, e.g. by old tooling) only appear under Global, by own time.
 */

export type Scope = "global" | string; // event id
import { rangeWindow, type DateRange } from "./range";
export { rangeStart, startOfMonth, startOfWeek } from "./range";
export type { DateRange } from "./range";

import type { EventRecord } from "@/lib/inventory/types";

export type EventDoc = { id: string; name: string } & Partial<EventRecord>;

export type RawDashboard = {
  users: UserProfile[];
  shifts: Shift[];
  entries: Entry[];
  events: EventDoc[];
  sheetsPerPack: number; // current setting — fallback for shifts without a snapshot
};

export type ScopedShift = {
  shift: Shift;
  entries: Entry[];
  totals: ShiftTotals;
  recon: Reconciliation | null;
  staffName: string;
  eventName: string | null; // null = no event
};

export type DateGroup = {
  key: string; // YYYY-MM-DD (local)
  shifts: ScopedShift[];
  totals: ShiftTotals;
  hasMismatch: boolean; // any unverified mismatch inside → bubbles up to the heading
};

export type StaffRow = {
  uid: string;
  name: string;
  email: string;
  role: "staff" | "admin" | null; // null = no profile any more (removed)
  assignedEventId: string | null;
  removed: boolean;
  shiftCount: number;
  totals: ShiftTotals;
};

export type ScopedDashboard = {
  shifts: ScopedShift[]; // newest first
  entries: Entry[];
  overview: ShiftTotals;
  mismatchCount: number;
  staffRows: StaffRow[];
  dateGroups: DateGroup[];
};

export function localDateKey(iso: string) {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function eventLabel(events: EventDoc[], eventId: string | null): string | null {
  if (!eventId) return null;
  return events.find((e) => e.id === eventId)?.name ?? "Unknown event";
}

export function scopeDashboard(raw: RawDashboard, scope: Scope, range: DateRange, now = new Date()): ScopedDashboard {
  const w = rangeWindow(range, now);
  return scopeWindow(raw, scope, w.from, w.until);
}

/**
 * Same scoping rules as scopeDashboard, over an explicit time window [from, until)
 * (null = unbounded). Used for "vs previous period" comparisons so both periods are
 * computed by exactly the same rules.
 */
export function scopeWindow(raw: RawDashboard, scope: Scope, from: Date | null, until: Date | null): ScopedDashboard {
  const inRange = (iso: string | null | undefined) => {
    if (!from && !until) return true;
    if (!iso) return false;
    const t = new Date(iso).getTime();
    return (!from || t >= from.getTime()) && (!until || t < until.getTime());
  };
  const inScope = (s: Shift) => scope === "global" || s.eventId === scope;

  const usersById = new Map(raw.users.map((u) => [u.uid, u]));
  const entriesByShift = new Map<string, Entry[]>();
  for (const e of raw.entries) {
    const list = entriesByShift.get(e.shiftId);
    if (list) list.push(e);
    else entriesByShift.set(e.shiftId, [e]);
  }

  const shifts: ScopedShift[] = raw.shifts
    .filter((s) => inRange(s.startTime) && inScope(s))
    .sort((a, b) => (b.startTime ?? "").localeCompare(a.startTime ?? ""))
    .map((shift) => {
      const entries = entriesByShift.get(shift.id) ?? [];
      const totals = aggregate(entries);
      return {
        shift,
        entries,
        totals,
        recon: reconcileShift(shift, totals, raw.sheetsPerPack),
        staffName: usersById.get(shift.uid)?.name || shift.staffName || "Unknown",
        eventName: eventLabel(raw.events, shift.eventId),
      };
    });

  const shiftIds = new Set(raw.shifts.map((s) => s.id));
  const scopedEntries = shifts.flatMap((s) => s.entries);
  if (scope === "global") {
    // Orphans have no shift → no event; only Global can own them.
    scopedEntries.push(...raw.entries.filter((e) => !shiftIds.has(e.shiftId) && inRange(e.time)));
  }

  // Date groups (Shifts accordion)
  const groups = new Map<string, ScopedShift[]>();
  for (const s of shifts) {
    const key = localDateKey(s.shift.startTime);
    const g = groups.get(key);
    if (g) g.push(s);
    else groups.set(key, [s]);
  }
  const dateGroups: DateGroup[] = [...groups.entries()]
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([key, list]) => {
      const inDay = list.slice().sort((a, b) => a.shift.startTime.localeCompare(b.shift.startTime));
      return {
        key,
        shifts: inDay,
        totals: aggregate(inDay.flatMap((s) => s.entries)),
        hasMismatch: inDay.some((s) => s.recon?.warn),
      };
    });

  // Staff rows
  const byUid = new Map<string, ScopedShift[]>();
  for (const s of shifts) {
    const list = byUid.get(s.shift.uid);
    if (list) list.push(s);
    else byUid.set(s.shift.uid, [s]);
  }
  const orphanByUid = new Map<string, Entry[]>();
  if (scope === "global") {
    for (const e of scopedEntries) {
      if (shiftIds.has(e.shiftId)) continue;
      const list = orphanByUid.get(e.uid);
      if (list) list.push(e);
      else orphanByUid.set(e.uid, [e]);
    }
  }

  const uids = new Set<string>(byUid.keys());
  if (scope === "global") {
    // Global: every approved staff member, even with no shifts in range.
    raw.users.filter((u) => u.approved && u.role === "staff").forEach((u) => uids.add(u.uid));
    orphanByUid.forEach((_, uid) => uids.add(uid));
  }

  const staffRows: StaffRow[] = [...uids]
    .map((uid) => {
      const u = usersById.get(uid);
      const theirShifts = byUid.get(uid) ?? [];
      const entries = [...theirShifts.flatMap((s) => s.entries), ...(orphanByUid.get(uid) ?? [])];
      return {
        uid,
        name: u?.name || theirShifts[0]?.shift.staffName || entries[0]?.staffName || "Removed staff",
        email: u?.email ?? "",
        role: u ? u.role : null,
        assignedEventId: u?.assignedEventId ?? null,
        removed: !u,
        shiftCount: theirShifts.length,
        totals: aggregate(entries),
      };
    })
    .sort((a, b) => b.totals.total - a.totals.total || a.name.localeCompare(b.name));

  return {
    shifts,
    entries: scopedEntries,
    overview: aggregate(scopedEntries),
    mismatchCount: shifts.filter((s) => s.recon?.warn).length,
    staffRows,
    dateGroups,
  };
}
