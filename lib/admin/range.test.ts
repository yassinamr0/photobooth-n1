import { describe, expect, it } from "vitest";
import { customRange, dayKey, parseStoredRange, rangeLabel, rangeWindow, shiftCustom } from "./range";
import { scopeDashboard, type RawDashboard } from "./scope";
import { comparisonWindows } from "@/lib/stats/revenue";
import { granularityFor, trendBuckets } from "@/lib/stats/waste";
import type { Entry, Shift } from "@/lib/shift/types";

const local = (y: number, m: number, d: number, h = 0, min = 0) => new Date(y, m - 1, d, h, min);

describe("custom ranges", () => {
  it("day / week (Mon–Sun) / range (swapped if backwards)", () => {
    expect(customRange("day", "2026-09-29")).toMatchObject({ from: "2026-09-29", to: "2026-09-29" });
    expect(customRange("week", "2026-10-01")).toMatchObject({ from: "2026-09-28", to: "2026-10-04" }); // Thu → Mon..Sun
    expect(customRange("week", "2026-10-04")).toMatchObject({ from: "2026-09-28", to: "2026-10-04" }); // Sunday belongs to the week before
    expect(customRange("range", "2026-09-16", "2026-09-10")).toMatchObject({ from: "2026-09-10", to: "2026-09-16" });
  });
  it("window ends at midnight after the last day (inclusive last day)", () => {
    const w = rangeWindow(customRange("range", "2026-09-10", "2026-09-16"), new Date());
    expect(w.from!.getTime()).toBe(local(2026, 9, 10).getTime());
    expect(w.until!.getTime()).toBe(local(2026, 9, 17).getTime());
  });
  it("stepping a week / a day", () => {
    expect(shiftCustom(customRange("week", "2026-09-29"), 1)).toMatchObject({ from: "2026-10-05", to: "2026-10-11" });
    expect(shiftCustom(customRange("day", "2026-03-01"), -1)).toMatchObject({ from: "2026-02-28", to: "2026-02-28" });
  });
  it("labels", () => {
    expect(rangeLabel("week")).toBe("this week");
    expect(rangeLabel(customRange("range", "2026-09-10", "2026-09-16"))).toBe("Sep 10 – Sep 16, 2026");
    expect(rangeLabel(customRange("day", "2026-09-29"))).toBe("Tue, Sep 29, 2026");
  });
  it("stored value validation", () => {
    expect(parseStoredRange("month")).toBe("month");
    expect(parseStoredRange({ kind: "custom", mode: "day", from: "2026-09-29", to: "2026-09-29" })).toMatchObject({ from: "2026-09-29" });
    expect(parseStoredRange({ kind: "custom", mode: "range", from: "2026-09-20", to: "2026-09-10" })).toBeNull();
    expect(parseStoredRange({ kind: "custom", mode: "day", from: "bad", to: "bad" })).toBeNull();
    expect(parseStoredRange("year")).toBeNull();
  });
});

describe("custom range scoping — by shift START day", () => {
  const shift = (id: string, start: Date): Shift => ({
    id, uid: "u", staffName: "U", eventId: "A", startTime: start.toISOString(), endTime: null,
    startPaperCount: null, paperChanges: 0, inkChanges: 0, endPaperCount: null,
  });
  const sale = (shiftId: string, total: number): Entry => ({
    id: shiftId + "e", uid: "u", staffName: "U", shiftId, time: new Date().toISOString(), type: "sale", sheets: 1,
    frames: { Acrylic: 0, Magnetic: 0 }, custom: [], desc: "", total, cash: total, visa: 0,
  });
  const raw: RawDashboard = {
    users: [], events: [{ id: "A", name: "A" }], sheetsPerPack: 18,
    shifts: [shift("before", local(2026, 9, 9, 23, 59)), shift("first", local(2026, 9, 10, 0, 0)), shift("last", local(2026, 9, 16, 23, 59)), shift("after", local(2026, 9, 17, 0, 0))],
    entries: [sale("before", 100), sale("first", 200), sale("last", 400), sale("after", 800)],
  };
  it("includes 00:00 on the first day and 23:59 on the last day, nothing outside", () => {
    const d = scopeDashboard(raw, "global", customRange("range", "2026-09-10", "2026-09-16"));
    expect(d.shifts.map((s) => s.shift.id).sort()).toEqual(["first", "last"]);
    expect(d.overview.total).toBe(600);
  });
  it("single day", () => {
    expect(scopeDashboard(raw, "A", customRange("day", "2026-09-17")).overview.total).toBe(800);
  });
});

describe("custom range comparison + trend", () => {
  it("previous period = same number of days just before", () => {
    const w = comparisonWindows(customRange("range", "2026-09-10", "2026-09-16"), new Date())!;
    expect(dayKey(w.previous.from)).toBe("2026-09-03");
    expect(w.previous.until.getTime()).toBe(local(2026, 9, 10).getTime());
    expect(w.previousLabel).toBe("the 7 days before");
    expect(comparisonWindows(customRange("day", "2026-09-29"), new Date())!.previousLabel).toBe("the day before");
    expect(comparisonWindows(customRange("week", "2026-09-29"), new Date())!.previousLabel).toBe("the week before");
  });
  it("granularity: ≤31 days daily, ≤~6 months weekly, longer monthly", () => {
    expect(granularityFor(customRange("range", "2026-09-01", "2026-10-01"))).toBe("day");
    expect(granularityFor(customRange("range", "2026-01-01", "2026-05-01"))).toBe("week");
    expect(granularityFor(customRange("range", "2025-01-01", "2026-05-01"))).toBe("month");
  });
  it("buckets cover exactly the picked days", () => {
    const b = trendBuckets(customRange("week", "2026-09-29"), new Date(), null);
    expect(b.map((x) => dayKey(x.start))).toEqual(["2026-09-28", "2026-09-29", "2026-09-30", "2026-10-01", "2026-10-02", "2026-10-03", "2026-10-04"]);
    const w = trendBuckets(customRange("range", "2026-09-10", "2026-11-05"), new Date(), null);
    expect(dayKey(w[0].start)).toBe("2026-09-10");
    expect(dayKey(w[1].start)).toBe("2026-09-14"); // then each Monday
  });
});
