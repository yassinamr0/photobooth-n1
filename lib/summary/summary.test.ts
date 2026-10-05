import { describe, expect, it } from "vitest";
import type { RawDashboard } from "@/lib/admin/scope";
import type { EventInventory, EventRecord, StockDoc } from "@/lib/inventory/types";
import type { Entry, Shift } from "@/lib/shift/types";
import { buildDailySummary } from "./build";
import { renderSummaryEmail } from "./email";

const ev = (id: string, name: string, status: "active" | "inactive" = "active"): EventRecord => ({ id, name, notes: "", status, createdAtMs: 0, createdBy: null, startDate: null, endDate: null });
const shift = (id: string, eventId: string, start: Date, hours: number, extra: Partial<Shift> = {}): Shift => ({
  id, uid: "u", staffName: "Nour Hassan", eventId, startTime: start.toISOString(), endTime: new Date(start.getTime() + hours * 3600e3).toISOString(),
  startPaperCount: null, paperChanges: 0, inkChanges: 0, endPaperCount: null, ...extra,
});
const sale = (shiftId: string, total: number, visa = 0): Entry => ({
  id: `${shiftId}-${total}`, uid: "u", staffName: "Nour", shiftId, time: "", type: "sale", sheets: 1,
  frames: { Acrylic: 0, Magnetic: 0 }, custom: [], desc: "", total, cash: total - visa, visa,
});
const st = (q: number, th: number, dismissed = false): StockDoc => ({ type: "paper", currentQuantity: q, lowStockThreshold: th, trackingSinceMs: 0, updatedAtMs: 0, alertDismissed: dismissed });
const inv = (paper: StockDoc): EventInventory => ({ paper, ink: null, acrylic: null, magnetic: null, logs: [] });

describe("daily summary", () => {
  const now = new Date(2026, 8, 30, 9, 0); // Sep 30, 09:00 → reports Sep 29
  const events = [ev("A", "City Stars"), ev("D5", "District 5", "inactive")];
  const raw: RawDashboard = {
    users: [], sheetsPerPack: 18, events,
    shifts: [
      shift("y1", "A", new Date(2026, 8, 29, 10), 8, { startPaperCount: 50, endPaperCount: 10, paperChanges: 0 }), // mismatch: expected 40 used vs 1
      shift("d0", "A", new Date(2026, 8, 28, 10), 8),
      shift("old", "A", new Date(2026, 8, 5, 10), 8),
    ],
    entries: [sale("y1", 1200, 1000), sale("d0", 800), sale("old", 5000)],
  };
  const s = buildDailySummary(
    { raw, expenses: [{ id: "e", eventId: "A", date: "2026-09-29", amount: 200, category: "transport", note: "", createdBy: "" }], recurring: [],
      fees: [{ from: "2026-01-01", mode: "percent", percent: 2, fixed: 0 }] },
    events,
    new Map([["A", inv(st(50, 108))], ["D5", inv(st(0, 108))]]),
    1,
    now,
  );
  it("reports yesterday, with card fees in expenses and vs the day before", () => {
    expect(s.day).toBe("2026-09-29");
    expect(s.totals.revenue).toBe(1200);
    expect(s.totals.expenses).toBeCloseTo(200 + 20);
    expect(s.previous).toMatchObject({ revenue: 800 });
    expect(s.locations).toEqual([{ name: "City Stars", revenue: 1200, expenses: 220, profit: 980 }]);
  });
  it("shifts of yesterday only", () => {
    expect(s.shifts).toHaveLength(1);
    expect(s.shifts[0]).toMatchObject({ staff: "Nour Hassan", location: "City Stars", hours: 8, total: 1200 });
  });
  it("month so far = Sep 1–29, ended events left out", () => {
    expect(s.month.revenue).toBe(1200 + 800 + 5000);
    expect(s.month.rows.map((r) => r.name)).toEqual(["City Stars"]);
  });
  it("alerts: low stock for active events only, mismatches, signups", () => {
    expect(s.alerts.some((a) => a.includes("City Stars") && a.startsWith("Low stock"))).toBe(true);
    expect(s.alerts.some((a) => a.includes("District 5"))).toBe(false);
    expect(s.alerts.some((a) => a.startsWith("Paper count mismatch"))).toBe(true);
    expect(s.alerts).toContain("1 signup waiting for approval");
  });
  it("renders HTML + text with commas and escaping", () => {
    const e = renderSummaryEmail({ ...s, shifts: [{ ...s.shifts[0], staff: "<b>x</b>" }] }, "https://booth.example");
    expect(e.subject).toContain("1,200 EGP revenue");
    expect(e.html).toContain("&lt;b&gt;x&lt;/b&gt;");
    expect(e.html).toContain("https://booth.example");
    expect(e.text).toContain("MONTH SO FAR");
  });
});
