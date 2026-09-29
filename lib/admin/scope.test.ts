import { describe, expect, it } from "vitest";
import { scopeDashboard, startOfWeek, type RawDashboard } from "./scope";
import { describeReconciliation, reconcileShift } from "@/lib/shift/paper";
import type { Entry, Shift } from "@/lib/shift/types";
import type { UserProfile } from "@/lib/users";

// "now" = Wednesday 2026-09-30 12:00 local. Week starts Mon 2026-09-28.
const now = new Date(2026, 8, 30, 12, 0);
const at = (d: number, h: number, month = 8) => new Date(2026, month, d, h, 0).toISOString();

const user = (uid: string, extra: Partial<UserProfile> = {}): UserProfile => ({
  uid, name: uid.toUpperCase(), email: `${uid}@x`, role: "staff", approved: true,
  assignedEventId: null, createdAt: null, ...extra,
});
const shift = (id: string, uid: string, eventId: string | null, startTime: string, extra: Partial<Shift> = {}): Shift => ({
  id, uid, staffName: uid.toUpperCase(), eventId, startTime, endTime: null,
  startPaperCount: null, paperChanges: 0, endPaperCount: null, ...extra,
});
const sale = (id: string, shiftId: string, uid: string, total: number, sheets = 1, time = at(29, 13)): Entry => ({
  id, uid, staffName: uid, shiftId, time, type: "sale", sheets, frames: { Acrylic: 0, Magnetic: 0 },
  custom: [], desc: "", total, cash: total, visa: 0,
});
const waste = (id: string, shiftId: string, uid: string, hadr: number): Entry => ({
  id, uid, staffName: uid, shiftId, time: at(29, 14), type: "waste", hadr, desc: "", total: 0, cash: 0, visa: 0,
});

const raw: RawDashboard = {
  users: [
    user("amr", { assignedEventId: "B" }), // reassigned A → B; still owns past A shifts
    user("nour", { assignedEventId: "B" }),
    user("idle"), // approved, no shifts
    user("boss", { role: "admin" }),
    user("pend", { approved: false }),
  ],
  events: [{ id: "A", name: "City Stars" }, { id: "B", name: "Mall of Egypt" }],
  sheetsPerPack: 18,
  shifts: [
    // A, this week, MISMATCH: 40 + 2×18 − 5 = 71 expected; logged 64.5 + 0.5 = 65
    shift("s1", "amr", "A", at(29, 10), { endTime: at(29, 18), startPaperCount: 40, paperChanges: 2, endPaperCount: 5 }),
    // B, this week, matches: 20 + 0 − 18 = 2 expected; logged 2
    shift("s2", "nour", "B", at(30, 9), { endTime: at(30, 11), startPaperCount: 20, paperChanges: 0, endPaperCount: 18 }),
    // A, last month
    shift("s3", "amr", "A", at(10, 10, 7)),
    // no event (legacy), this week, still open
    shift("s4", "nour", null, at(28, 9)),
    // removed user, A, this week
    shift("s5", "gone", "A", at(28, 15)),
  ],
  entries: [
    sale("e1", "s1", "amr", 1000, 64.5),
    waste("e2", "s1", "amr", 0.5),
    sale("e3", "s2", "nour", 800, 2),
    sale("e4", "s3", "amr", 400, 1, at(10, 11, 7)),
    sale("e5", "s4", "nour", 200, 0.5),
    sale("e6", "s5", "gone", 300, 0.5),
    sale("orphan", "deleted-shift", "nour", 50, 0, at(29, 12)),
  ],
};

describe("scopeDashboard — event switcher", () => {
  it("Global/week: everything this week + orphans; every approved staff member listed", () => {
    const d = scopeDashboard(raw, "global", "week", now);
    expect(d.shifts.map((s) => s.shift.id)).toEqual(["s2", "s1", "s5", "s4"]);
    expect(d.overview.total).toBe(1000 + 800 + 200 + 300 + 50);
    expect(d.staffRows.map((r) => r.uid).sort()).toEqual(["amr", "gone", "idle", "nour"]);
    expect(d.staffRows.find((r) => r.uid === "gone")?.removed).toBe(true);
    expect(d.staffRows.find((r) => r.uid === "nour")?.totals.total).toBe(800 + 200 + 50);
    expect(d.shifts.find((s) => s.shift.id === "s4")?.eventName).toBeNull();
    expect(d.shifts.find((s) => s.shift.id === "s1")?.eventName).toBe("City Stars");
  });

  it("Event A/week: only A shifts; entries follow their shift; no orphans", () => {
    const d = scopeDashboard(raw, "A", "week", now);
    expect(d.shifts.map((s) => s.shift.id).sort()).toEqual(["s1", "s5"]);
    expect(d.overview.total).toBe(1300);
    expect(d.entries.some((e) => e.id === "orphan")).toBe(false);
  });

  it("Event A: staff = only people with A shifts in range (incl. reassigned + removed), A totals only", () => {
    const d = scopeDashboard(raw, "A", "week", now);
    expect(d.staffRows.map((r) => r.uid).sort()).toEqual(["amr", "gone"]);
    expect(d.staffRows.find((r) => r.uid === "amr")?.assignedEventId).toBe("B"); // reassigned, still listed
    expect(d.staffRows.find((r) => r.uid === "amr")?.totals.total).toBe(1000);
  });

  it("Event B: different numbers, no A data", () => {
    const d = scopeDashboard(raw, "B", "week", now);
    expect(d.shifts.map((s) => s.shift.id)).toEqual(["s2"]);
    expect(d.overview.total).toBe(800);
    expect(d.staffRows.map((r) => r.uid)).toEqual(["nour"]);
    expect(d.mismatchCount).toBe(0);
  });

  it("range by SHIFT start: month/all include older shifts", () => {
    expect(scopeDashboard(raw, "A", "month", now).shifts.map((s) => s.shift.id).sort()).toEqual(["s1", "s5"]);
    expect(scopeDashboard(raw, "A", "all", now).overview.total).toBe(1000 + 400 + 300);
  });

  it("an entry logged after the week boundary counts toward its shift's week", () => {
    const r2: RawDashboard = {
      ...raw,
      shifts: [shift("x", "amr", "A", new Date(2026, 8, 27, 22).toISOString())], // Sun 22:00
      entries: [sale("xe", "x", "amr", 999, 1, new Date(2026, 8, 28, 1).toISOString())], // Mon 01:00
    };
    expect(scopeDashboard(r2, "global", "week", now).overview.total).toBe(0); // shift began last week
    expect(scopeDashboard(r2, "global", "all", now).overview.total).toBe(999);
  });

  it("mismatch: counted, bubbles to date group, respects scope, cleared by paperVerified", () => {
    const g = scopeDashboard(raw, "global", "week", now);
    expect(g.mismatchCount).toBe(1);
    expect(g.dateGroups.find((x) => x.key === "2026-09-29")?.hasMismatch).toBe(true);
    expect(g.dateGroups.find((x) => x.key === "2026-09-30")?.hasMismatch).toBe(false);
    expect(scopeDashboard(raw, "B", "week", now).mismatchCount).toBe(0);
    const verified = { ...raw, shifts: raw.shifts.map((s) => (s.id === "s1" ? { ...s, paperVerified: true } : s)) };
    const v = scopeDashboard(verified, "global", "week", now);
    expect(v.mismatchCount).toBe(0);
    expect(v.dateGroups.every((x) => !x.hasMismatch)).toBe(true);
    expect(v.shifts.find((s) => s.shift.id === "s1")?.recon?.mismatch).toBe(true); // numbers still there
  });

  it("week starts Monday", () => {
    expect(startOfWeek(new Date(2026, 8, 27, 12)).getDate()).toBe(21); // Sunday → previous Monday
    expect(startOfWeek(now).getDate()).toBe(28);
  });
});

describe("reconcileShift — packs, not boxes", () => {
  const s = { startPaperCount: 40, paperChanges: 2, endPaperCount: 5 };
  it("spec example: expected 71, logged 65 → off by 6 (less)", () => {
    const r = reconcileShift(s, { sheets: 64.5, hadr: 0.5 }, 18)!;
    expect(r).toMatchObject({ expectedUsed: 71, actualUsed: 65, diff: -6, mismatch: true, warn: true, addedSheets: 36 });
    expect(describeReconciliation(s, r)).toEqual({
      printer: "Printer: started with 40, refilled 2× (+36 sheets), 5 left over → expected 71 used",
      logged: "Logged as sold + wasted: 65",
      status: "Off by 6 (less sold/wasted than the paper accounts for)",
    });
  });
  it("more sold than paper accounts for", () => {
    const r = reconcileShift(s, { sheets: 73, hadr: 0 }, 18)!;
    expect(describeReconciliation(s, r).status).toBe("Off by 2 (more sold/wasted than the paper accounts for)");
  });
  it("matches", () => {
    const r = reconcileShift(s, { sheets: 70.5, hadr: 0.5 }, 18)!;
    expect(r.mismatch).toBe(false);
    expect(describeReconciliation(s, r).status).toBe("Matches ✓");
  });
  it("uses the shift's own snapshotted pack size over the current setting", () => {
    const r = reconcileShift({ ...s, sheetsPerPack: 20 }, { sheets: 75, hadr: 0 }, 18)!;
    expect(r.expectedUsed).toBe(75);
    expect(r.mismatch).toBe(false);
  });
  it("verified mismatch: mismatch stays, warn clears", () => {
    const r = reconcileShift({ ...s, paperVerified: true }, { sheets: 1, hadr: 0 }, 18)!;
    expect(r.mismatch).toBe(true);
    expect(r.warn).toBe(false);
  });
  it("null without both counts", () => {
    expect(reconcileShift({ ...s, endPaperCount: null }, { sheets: 0, hadr: 0 }, 18)).toBeNull();
    expect(reconcileShift({ ...s, startPaperCount: null }, { sheets: 0, hadr: 0 }, 18)).toBeNull();
  });
});
