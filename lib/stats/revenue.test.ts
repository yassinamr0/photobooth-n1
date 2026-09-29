import { describe, expect, it } from "vitest";
import { scopeDashboard, type RawDashboard } from "@/lib/admin/scope";
import { comparisonWindows, locationComparison, moneyTrend, revenueComparison } from "./revenue";
import type { Entry, Shift } from "@/lib/shift/types";

const L = (y: number, m: number, d: number, h = 12) => new Date(y, m - 1, d, h);
// "now" = Wed Sep 30 2026 12:00 → this week started Mon Sep 28; last week Mon Sep 21.
const now = L(2026, 9, 30, 12);

const shift = (id: string, eventId: string | null, start: Date, hours = 4): Shift => ({
  id, uid: "u", staffName: "U", eventId, startTime: start.toISOString(),
  endTime: new Date(start.getTime() + hours * 3600e3).toISOString(),
  startPaperCount: null, paperChanges: 0, inkChanges: 0, endPaperCount: null,
});
let n = 0;
const sale = (shiftId: string, total: number, cash: number, time: Date, sheets = 1): Entry => ({
  id: `e${++n}`, uid: "u", staffName: "U", shiftId, time: time.toISOString(), type: "sale",
  sheets, frames: { Acrylic: 0, Magnetic: 0 }, custom: [], desc: "", total, cash, visa: total - cash,
});
const waste = (shiftId: string, hadr: number, time: Date): Entry => ({
  id: `e${++n}`, uid: "u", staffName: "U", shiftId, time: time.toISOString(), type: "waste", hadr, desc: "", total: 0, cash: 0, visa: 0,
});

const raw: RawDashboard = {
  users: [], sheetsPerPack: 18,
  events: [{ id: "A", name: "City Stars" }, { id: "B", name: "Mall of Egypt" }],
  shifts: [
    shift("a-this", "A", L(2026, 9, 28, 10)), // this week Mon
    shift("b-this", "B", L(2026, 9, 29, 10)), // this week Tue
    shift("a-last-early", "A", L(2026, 9, 21, 10)), // last week Mon (within same elapsed)
    shift("a-last-late", "A", L(2026, 9, 25, 10)), // last week Fri (after same point → excluded)
    shift("none", null, L(2026, 9, 29, 15), 2), // no event, this week
  ],
  entries: [
    sale("a-this", 1000, 1000, L(2026, 9, 28, 11), 2.5),
    sale("a-this", 400, 0, L(2026, 9, 28, 12)),
    waste("a-this", 0.5, L(2026, 9, 28, 13)),
    sale("b-this", 800, 300, L(2026, 9, 29, 11), 2),
    sale("a-last-early", 500, 500, L(2026, 9, 21, 11)),
    sale("a-last-late", 9999, 9999, L(2026, 9, 25, 11)),
    sale("none", 200, 200, L(2026, 9, 29, 16)),
    sale("deleted-shift", 50, 50, L(2026, 9, 29, 17)), // orphan
  ],
};

describe("comparisonWindows — like for like", () => {
  it("this week so far vs last week over the same elapsed time", () => {
    const w = comparisonWindows("week", now)!;
    expect(w.current.from.getDate()).toBe(28);
    expect(w.previous.from.getDate()).toBe(21);
    expect(w.previous.until.getTime()).toBe(L(2026, 9, 23, 12).getTime()); // Wed 12:00 last week
  });
  it("this month vs last month, clipped to last month's length", () => {
    const w = comparisonWindows("month", L(2026, 3, 31, 12))!; // Mar 31 → Feb (28 days)
    expect(w.previous.from.getMonth()).toBe(1);
    expect(w.previous.until.getTime()).toBe(L(2026, 3, 1, 0).getTime()); // capped at Feb's end
  });
  it("all time has no comparison", () => expect(comparisonWindows("all", now)).toBeNull());
});

describe("revenueComparison", () => {
  it("City Stars: 1400 this week vs 500 at the same point last week (+180%); later-week shift excluded", () => {
    const c = revenueComparison(raw, "A", "week", now)!;
    expect(c).toMatchObject({ current: 1400, previous: 500 });
    expect(c.change).toBeCloseTo(1.8);
  });
  it("current figure equals the Overview total for the same scope", () => {
    for (const scope of ["global", "A", "B"]) {
      expect(revenueComparison(raw, scope, "week", now)!.current).toBe(scopeDashboard(raw, scope, "week", now).overview.total);
    }
  });
  it("nothing last period → change null (no fake percentage)", () => {
    expect(revenueComparison(raw, "B", "week", now)!.change).toBeNull();
  });
});

describe("moneyTrend", () => {
  it("daily buckets this week; totals add up to Overview; cash/visa split kept", () => {
    const scoped = scopeDashboard(raw, "global", "week", now);
    const t = moneyTrend(scoped, "week", now);
    expect(t.map((p) => p.totals.total)).toEqual([1400, 1050, 0]); // Mon, Tue (800+200+orphan 50), Wed
    expect(t.reduce((s, p) => s + p.totals.total, 0)).toBe(scoped.overview.total);
    expect(t[0]).toMatchObject({ sales: 2, totals: { cash: 1000, visa: 400 } });
  });
  it("scoped to one event", () => {
    const t = moneyTrend(scopeDashboard(raw, "B", "week", now), "week", now);
    expect(t.map((p) => p.totals.total)).toEqual([0, 800, 0]);
  });
});

describe("locationComparison", () => {
  const rows = locationComparison(raw, "week", now);
  it("one row per event + No event, sorted by revenue; each equals that event's Overview", () => {
    expect(rows.map((r) => r.name)).toEqual(["City Stars", "Mall of Egypt", "No event"]);
    for (const r of rows.filter((x) => x.id)) expect(r.revenue).toBe(scopeDashboard(raw, r.id!, "week", now).overview.total);
  });
  it("derived columns", () => {
    const a = rows[0];
    expect(a).toMatchObject({ revenue: 1400, sales: 2, avgSale: 700, sheets: 3.5, shifts: 1, hours: 4, revenuePerHour: 350 });
    expect(a.waste.rate).toBeCloseTo(0.5 / 4);
    expect(rows[2]).toMatchObject({ revenue: 200, hours: 2 }); // orphan 50 NOT in No event
  });
});
