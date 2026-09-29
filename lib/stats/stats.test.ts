import { describe, expect, it } from "vitest";
import { busiestHours, mondayIndex } from "./busiest";
import { burnRows } from "./burn";
import { isClimbing, isHigh, staffWaste, sumUsage, trendBuckets, usage, wasteTrend, type TrendPoint } from "./waste";
import type { ScopedShift } from "@/lib/admin/scope";
import type { Entry, Shift } from "@/lib/shift/types";
import type { InventoryRow } from "@/lib/inventory/scope";

const local = (y: number, m: number, d: number, h = 12, min = 0) => new Date(y, m - 1, d, h, min);
const sale = (time: Date, total = 400, sheets = 1): Entry => ({
  id: String(Math.random()), uid: "u", staffName: "", shiftId: "s", time: time.toISOString(), type: "sale",
  sheets, frames: { Acrylic: 0, Magnetic: 0 }, custom: [], desc: "", total, cash: total, visa: 0,
});
const waste = (time: Date, hadr: number): Entry => ({
  id: String(Math.random()), uid: "u", staffName: "", shiftId: "s", time: time.toISOString(), type: "waste", hadr, desc: "", total: 0, cash: 0, visa: 0,
});

describe("busiestHours", () => {
  it("Monday-first weekday index", () => {
    expect(mondayIndex(local(2026, 9, 28))).toBe(0); // Mon
    expect(mondayIndex(local(2026, 10, 4))).toBe(6); // Sun
  });
  it("buckets sales by local weekday × hour; ignores waste; finds the peak", () => {
    const fri18 = local(2026, 10, 2, 18, 30);
    const r = busiestHours([sale(fri18, 400), sale(local(2026, 10, 2, 18, 5), 800), sale(local(2026, 9, 28, 11)), waste(fri18, 5)]);
    expect(r.grid[4][18]).toEqual({ sales: 2, egp: 1200 });
    expect(r.grid[0][11].sales).toBe(1);
    expect(r.total).toEqual({ sales: 3, egp: 1600 });
    expect(r.byHour[18].sales).toBe(2);
    expect(r.byWeekday[4].sales).toBe(2);
    expect(r.max).toBe(2);
    expect(r.peak).toMatchObject({ weekday: 4, hour: 18 });
  });
  it("empty → no peak", () => expect(busiestHours([]).peak).toBeNull());
});

// ── waste ──
const ss = (uid: string, name: string, start: Date, sheets: number, hadr: number): ScopedShift => ({
  shift: { id: String(Math.random()), uid, staffName: name, eventId: "A", startTime: start.toISOString(), endTime: null,
    startPaperCount: null, paperChanges: 0, inkChanges: 0, endPaperCount: null } as Shift,
  entries: [],
  totals: { total: 0, cash: 0, visa: 0, sheets, hadr, acrylic: 0, magnetic: 0 },
  recon: null, staffName: name, eventName: "A",
});

describe("waste rate", () => {
  it("rate = hadr ÷ (sold + hadr); no usage → null (not 0%)", () => {
    expect(usage(9, 1).rate).toBeCloseTo(0.1);
    expect(usage(0, 0).rate).toBeNull();
  });
  it("high needs 1.5× baseline AND +2pp AND ≥10 sheets used", () => {
    expect(isHigh(usage(17, 3), 0.05)).toBe(true); // 15% vs 5%, 20 used
    expect(isHigh(usage(4, 1), 0.05)).toBe(false); // 20% but only 5 used
    expect(isHigh(usage(93, 7), 0.05)).toBe(false); // 7% < 1.5×5%
    expect(isHigh(usage(94, 6), 0.05)).toBe(false); // 6% — below 1.5× (7.5%)
    expect(isHigh(usage(99, 1), 0)).toBe(false); // 1% vs 0% — under +2pp
  });
  it("staff ranked highest waste first, flags the outlier, omits no-usage staff", () => {
    const shifts = [ss("a", "Amr", local(2026, 9, 29), 17, 3), ss("n", "Nour", local(2026, 9, 29), 49, 1), ss("n", "Nour", local(2026, 9, 30), 30, 0), ss("z", "Zero", local(2026, 9, 30), 0, 0)];
    const overall = sumUsage(shifts);
    const rows = staffWaste(shifts, overall);
    expect(rows.map((r) => r.name)).toEqual(["Amr", "Nour"]);
    expect(rows[0]).toMatchObject({ high: true });
    expect(rows[0].usage.rate).toBeCloseTo(0.15);
    expect(rows[1].usage).toMatchObject({ sold: 79, hadr: 1, used: 80 });
    expect(rows[1].high).toBe(false);
  });
});

describe("adaptive trend buckets", () => {
  const now = local(2026, 10, 1, 15); // Thu Oct 1 2026
  it("This week → one point per day Mon..today", () => {
    const b = trendBuckets("week", now, null);
    expect(b.length).toBe(4); // Mon 28, Tue 29, Wed 30, Thu 1
    expect(b[0].start.getDate()).toBe(28);
  });
  it("This month → weekly points, clipped to the month start", () => {
    const b = trendBuckets("month", local(2026, 9, 30, 12), null); // Sept 2026: Tue 1st … Wed 30th
    expect(b.map((x) => x.start.getDate())).toEqual([1, 7, 14, 21, 28]);
  });
  it("All time → monthly points from the first data month", () => {
    const b = trendBuckets("all", now, local(2026, 7, 15).getTime());
    expect(b.map((x) => x.start.getMonth() + 1)).toEqual([7, 8, 9, 10]);
  });
  it("shifts land in their start-date bucket; empty buckets are gaps", () => {
    const shifts = [ss("a", "A", local(2026, 9, 28, 10), 9, 1), ss("a", "A", local(2026, 9, 30, 23), 18, 2)];
    const t = wasteTrend(shifts, "week", now, sumUsage(shifts));
    expect(t.map((p) => p.usage.rate)).toEqual([0.1, null, 0.1, null]);
  });
});

describe("climbing", () => {
  const pt = (rate: number | null): TrendPoint => ({ key: "", label: "", start: new Date(), usage: { sold: 0, hadr: 0, used: rate == null ? 0 : 10, rate }, high: false });
  it("last 3 non-empty points strictly rising (gaps skipped)", () => {
    expect(isClimbing([pt(0.05), pt(0.02), null, pt(0.04), pt(0.06)].map((p) => p ?? pt(null)))).toBe(true);
    expect(isClimbing([pt(0.02), pt(0.04), pt(0.04)])).toBe(false);
    expect(isClimbing([pt(0.02), pt(0.04)])).toBe(false);
  });
});

describe("burn rows", () => {
  const row = (name: string, paperDays: number | null, inkDays: number | null, low = false): InventoryRow => ({
    event: { id: name, name, notes: "", status: "active", createdAtMs: 0, createdBy: null },
    inv: { paper: null, ink: null, logs: [] }, tracked: true, paperLow: low, inkLow: false,
    forecast: { avgPerDay: 1, windowDays: 14, daysLeft: paperDays }, inkForecast: { avgPerDay: 0, windowDays: 14, daysLeft: inkDays }, pending: [],
  });
  it("sorted soonest-to-run-out first; ≤7 days or below threshold warns", () => {
    const r = burnRows([row("Slow", 40, null), row("Soon", 5, 30), row("NoData", null, null), row("Low", 20, null, true)]);
    expect(r.map((x) => x.row.event.name)).toEqual(["Soon", "Low", "Slow", "NoData"]);
    expect(r.map((x) => x.warn)).toEqual([true, true, false, false]);
  });
});
