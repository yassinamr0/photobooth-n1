import { describe, expect, it } from "vitest";
import { customRange, parseDay } from "@/lib/admin/range";
import type { RawDashboard } from "@/lib/admin/scope";
import type { Entry, Shift } from "@/lib/shift/types";
import { amountFor, recurringShare, withAmountFrom } from "./recurring";
import { expenseTotals, pnlByLocation, pnlSummary, pnlTrend, type PnlInputs } from "./pnl";
import type { Expense, RecurringExpense } from "./types";

const rec = (o: Partial<RecurringExpense>): RecurringExpense => ({
  id: "r", eventId: "A", category: "rent", note: "", startMonth: "2026-01", endMonth: null,
  amounts: [{ from: "2026-01", amount: 3000 }], createdBy: "a", ...o,
});
const day = (k: string) => parseDay(k);

describe("recurring — spread across the days of each month", () => {
  it("3,000 in a 30-day September = 100/day", () => {
    expect(recurringShare(rec({}), day("2026-09-01"), day("2026-10-01"))).toBeCloseTo(3000);
    expect(recurringShare(rec({}), day("2026-09-10"), day("2026-09-17"))).toBeCloseTo(700); // 7 days
    expect(recurringShare(rec({}), day("2026-09-29"), day("2026-09-30"))).toBeCloseTo(100); // one day
  });
  it("uses each month's own length (Feb 28 days, Jan 31)", () => {
    expect(recurringShare(rec({}), day("2026-02-01"), day("2026-02-02"))).toBeCloseTo(3000 / 28);
    // Jan 31 + Feb 1 → one day of each month
    expect(recurringShare(rec({}), day("2026-01-31"), day("2026-02-02"))).toBeCloseTo(3000 / 31 + 3000 / 28);
  });
  it("only between start and end month", () => {
    const r = rec({ startMonth: "2026-03", endMonth: "2026-04" });
    expect(recurringShare(r, day("2026-01-01"), day("2027-01-01"))).toBeCloseTo(6000);
    expect(recurringShare(r, day("2026-02-01"), day("2026-03-01"))).toBe(0);
  });
  it("amount change applies from its month; earlier months keep the old amount", () => {
    const steps = withAmountFrom([{ from: "2026-01", amount: 3000 }], "2026-06", 3600);
    expect(amountFor(steps, "2026-05")).toBe(3000);
    expect(amountFor(steps, "2026-06")).toBe(3600);
    const r = rec({ amounts: steps });
    expect(recurringShare(r, day("2026-05-01"), day("2026-07-01"))).toBeCloseTo(6600);
  });
});

// ---- P&L over a small dataset -------------------------------------------------------------
const shift = (id: string, eventId: string | null, start: string): Shift => ({
  id, uid: "u", staffName: "U", eventId, startTime: new Date(`${start}T12:00:00`).toISOString(), endTime: null,
  startPaperCount: null, paperChanges: 0, inkChanges: 0, endPaperCount: null,
});
const sale = (shiftId: string, total: number): Entry => ({
  id: `${shiftId}-${total}`, uid: "u", staffName: "U", shiftId, time: "", type: "sale", sheets: 1,
  frames: { Acrylic: 0, Magnetic: 0 }, custom: [], desc: "", total, cash: total, visa: 0,
});
const exp = (id: string, eventId: string | null, date: string, amount: number, category: Expense["category"] = "other"): Expense =>
  ({ id, eventId, date, amount, category, note: "", createdBy: "a" });

const raw: RawDashboard = {
  users: [], sheetsPerPack: 18,
  events: [{ id: "A", name: "City Stars" }, { id: "B", name: "Mall of Egypt" }],
  shifts: [shift("a1", "A", "2026-09-10"), shift("b1", "B", "2026-09-12"), shift("n1", null, "2026-09-12"), shift("a0", "A", "2026-09-05")],
  entries: [sale("a1", 5000), sale("b1", 2000), sale("n1", 400), sale("a0", 1000)],
};
const inp: PnlInputs = {
  raw,
  expenses: [exp("e1", "A", "2026-09-11", 500, "transport"), exp("e2", "B", "2026-09-16", 300, "stock"), exp("g", null, "2026-09-13", 700, "marketing"), exp("out", "A", "2026-09-20", 999)],
  recurring: [rec({ eventId: "A", amounts: [{ from: "2026-01", amount: 3000 }] })],
};
const now = new Date(2026, 8, 30, 15); // Sep 30 2026
const range = customRange("range", "2026-09-10", "2026-09-16");

describe("P&L", () => {
  it("event scope: revenue = Overview; one-offs on their date + 7 days of rent", () => {
    const p = pnlSummary(inp, "A", range, now);
    expect(p.revenue).toBe(5000);
    expect(p.expenses.total).toBeCloseTo(500 + 700); // transport + 7/30 of 3,000
    expect(p.expenses.byCategory.rent).toBeCloseTo(700);
    expect(p.profit).toBeCloseTo(3800);
    expect(p.margin).toBeCloseTo(0.76);
  });
  it("General expenses only under Global", () => {
    expect(pnlSummary(inp, "B", range, now).expenses.total).toBe(300);
    const g = pnlSummary(inp, "global", range, now);
    expect(g.revenue).toBe(7400);
    expect(g.expenses.total).toBeCloseTo(500 + 700 + 300 + 700);
  });
  it("per-location rows (+ No event, + General) add up to Global", () => {
    const rows = pnlByLocation(inp, range, now);
    const g = pnlSummary(inp, "global", range, now);
    expect(rows.reduce((s, r) => s + r.revenue, 0)).toBeCloseTo(g.revenue);
    expect(rows.reduce((s, r) => s + r.expenses, 0)).toBeCloseTo(g.expenses.total);
    expect(rows.find((r) => r.name === "General")).toMatchObject({ revenue: 0, expenses: 700 });
    expect(rows.find((r) => r.name === "No event")).toMatchObject({ revenue: 400, expenses: 0 });
  });
  it("comparison: the same 7 days just before", () => {
    const p = pnlSummary(inp, "A", range, now);
    expect(p.previous).toMatchObject({ revenue: 1000, label: "the 7 days before" });
    // rent Sep 5–9 only: event A (no saved start date) starts on its first shift, Sep 5
    expect(p.previous!.expenses).toBeCloseTo(500);
  });
  it("to date: nothing after today counts (future expense / rest of the month)", () => {
    const early = new Date(2026, 8, 12, 9); // Sep 12
    const t = expenseTotals(inp, (id) => id === "A", day("2026-09-01"), null, early);
    expect(t.total).toBeCloseTo(800 + 500); // rent Sep 5–12 (from A's first shift) + e1; not e999 on Sep 20
  });
  it("trend buckets sum to the headline", () => {
    const pts = pnlTrend(inp, "global", range, now);
    const g = pnlSummary(inp, "global", range, now);
    expect(pts.length).toBe(7);
    expect(pts.reduce((s, p) => s + p.revenue, 0)).toBeCloseTo(g.revenue);
    expect(pts.reduce((s, p) => s + p.expenses, 0)).toBeCloseTo(g.expenses.total);
  });
});

// ---- Event dates: monthly expenses only while the event runs, whole-event split, break-even days
import { pnlBreakEven } from "./pnl";
import { eventPeriodRange, eventSpan } from "./eventSpan";

describe("event dates", () => {
  const ev = (o: object) => ({ id: "E", name: "Pop-up", status: "active" as const, notes: "", createdAtMs: null, createdBy: null, startDate: null, endDate: null, ...o });
  const base = (events: object[], extra: Partial<PnlInputs> = {}): PnlInputs => ({
    raw: { users: [], sheetsPerPack: 18, events: events as never, shifts: [], entries: [] },
    expenses: [], recurring: [], ...extra,
  });
  const oct31 = new Date(2026, 9, 31, 12);

  it("monthly rent tied to an event counts only from its start date (rent paid every 12th)", () => {
    const inp = base([ev({ startDate: "2026-10-12" })], { recurring: [rec({ eventId: "E", startMonth: "2026-10", amounts: [{ from: "2026-10", amount: 3100 }] })] });
    const t = expenseTotals(inp, (id) => id === "E", day("2026-10-01"), day("2026-11-01"), oct31);
    expect(t.total).toBeCloseTo(2000); // Oct 12–31 = 20 days × 100
  });

  it("monthly rent stops on the event's end date", () => {
    const inp = base([ev({ startDate: "2026-10-01", endDate: "2026-10-10" })], { recurring: [rec({ eventId: "E", startMonth: "2026-10", amounts: [{ from: "2026-10", amount: 3100 }] })] });
    expect(expenseTotals(inp, (id) => id === "E", day("2026-10-01"), day("2026-11-01"), oct31).total).toBeCloseTo(1000);
  });

  it("whole-event expense splits evenly over the event's days, across months", () => {
    const e: Expense = { id: "w", eventId: "E", date: "2026-09-28", amount: 8000, category: "rent", note: "", createdBy: "a", spread: "event" };
    const inp = base([ev({ startDate: "2026-09-28", endDate: "2026-10-05" })], { expenses: [e] }); // 8 days → 1,000/day
    const f = (a: string, b: string) => expenseTotals(inp, () => true, day(a), day(b), oct31).total;
    expect(f("2026-10-01", "2026-11-01")).toBeCloseTo(5000); // Oct 1–5
    expect(f("2026-09-01", "2026-10-01")).toBeCloseTo(3000); // Sep 28–30
    expect(f("2026-09-01", "2026-11-01")).toBeCloseTo(8000);
    expect(f("2026-10-10", "2026-10-20")).toBe(0);
  });

  it("All time includes every event day even if the event's start moved earlier after adding it", () => {
    // Added when the event started Oct 1; event later changed to 28 Sep – 8 Oct (11 days).
    const e: Expense = { id: "w", eventId: "E", date: "2026-10-01", amount: 11000, category: "rent", note: "", createdBy: "a", spread: "event" };
    const inp = base([ev({ startDate: "2026-09-28", endDate: "2026-10-08" })], { expenses: [e] });
    expect(expenseTotals(inp, () => true, null, null, new Date(2026, 9, 5, 12)).total).toBeCloseTo(8000); // Sep 28 – Oct 5
  });

  it("whole-event expense on an ongoing event counts in full on its date", () => {
    const e: Expense = { id: "w", eventId: "E", date: "2026-10-12", amount: 6000, category: "rent", note: "", createdBy: "a", spread: "event" };
    const inp = base([ev({ startDate: "2026-10-12" })], { expenses: [e] });
    expect(expenseTotals(inp, () => true, day("2026-10-01"), day("2026-11-01"), oct31).total).toBe(6000);
  });

  it("whole-event share is capped at today (to-date P&L)", () => {
    const e: Expense = { id: "w", eventId: "E", date: "2026-09-28", amount: 8000, category: "rent", note: "", createdBy: "a", spread: "event" };
    const inp = base([ev({ startDate: "2026-09-28", endDate: "2026-10-05" })], { expenses: [e] });
    expect(expenseTotals(inp, () => true, day("2026-09-01"), null, new Date(2026, 8, 29, 12)).total).toBeCloseTo(2000); // Sep 28–29
  });

  it("start date falls back to the first shift, then the creation day", () => {
    const raw = { events: [ev({ createdAtMs: new Date(2026, 9, 3, 9).getTime() })] as never, shifts: [] };
    expect(eventSpan(raw, "E")).toMatchObject({ startDate: "2026-10-03", startGuessed: true, endDate: null });
    const withShift = { ...raw, shifts: [shift("s", "E", "2026-10-07")] };
    expect(eventSpan(withShift, "E").startDate).toBe("2026-10-07");
  });

  it("an event marked as ended before end dates existed ends on its last shift's day", () => {
    const raw = { events: [ev({ status: "inactive", startDate: "2026-09-15" })] as never, shifts: [shift("a", "E", "2026-09-20"), shift("b", "E", "2026-09-28")] };
    expect(eventSpan(raw, "E")).toMatchObject({ endDate: "2026-09-28", endGuessed: true });
    const inp = base([ev({ status: "inactive", startDate: "2026-09-15" })], {
      recurring: [rec({ eventId: "E", startMonth: "2026-09", amounts: [{ from: "2026-09", amount: 3000 }] })],
    });
    inp.raw.shifts = raw.shifts;
    // rent stops after Sep 28: Sep 15–28 = 14 days × 100, nothing in October
    expect(expenseTotals(inp, () => true, day("2026-09-01"), day("2026-11-01"), oct31).total).toBeCloseTo(1400);
  });

  it("event-period range = the event's own dates (ongoing → up to today)", () => {
    const rawOngoing = { events: [ev({ startDate: "2026-10-01" })] as never, shifts: [] };
    expect(eventPeriodRange(rawOngoing, "E", new Date(2026, 9, 11, 12))).toEqual({ kind: "custom", mode: "range", from: "2026-10-01", to: "2026-10-11" });
    const rawEnded = { events: [ev({ startDate: "2026-09-28", endDate: "2026-10-08" })] as never, shifts: [] };
    expect(eventPeriodRange(rawEnded, "E", new Date(2026, 9, 11, 12))).toEqual({ kind: "custom", mode: "range", from: "2026-09-28", to: "2026-10-08" });
    const rawNoStart = { events: [{ id: "E", name: "X", status: "active", notes: "", createdAtMs: null, createdBy: null, startDate: null, endDate: null }] as never, shifts: [] };
    expect(eventPeriodRange(rawNoStart, "E", new Date(2026, 9, 11, 12))).toBe("all");
  });

  it("break-even counts only the days the booth was open", () => {
    const inp = base([ev({ startDate: "2026-10-12" })], { recurring: [rec({ eventId: "E", startMonth: "2026-10", amounts: [{ from: "2026-10", amount: 3100 }] })] });
    const r = pnlBreakEven(inp, "E", "month", new Date(2026, 9, 21, 12)); // Oct 12–21 = 10 days
    expect(r.be.days).toBe(10);
    expect(r.be.fixedPerDay).toBeCloseTo(100);
    expect(r.notOpen).toBe(false);
    const before = pnlBreakEven(inp, "E", customRange("range", "2026-10-01", "2026-10-05"), oct31);
    expect(before.notOpen).toBe(true);
  });
});

// ---- Running balance: carry the net from before the range into it ------------------------
describe("carried-over / running profit", () => {
  const rawCE: RawDashboard = {
    users: [], sheetsPerPack: 18,
    events: [{ id: "E", name: "E", startDate: "2026-10-10", endDate: "2026-10-14" } as never],
    shifts: [shift("d1", "E", "2026-10-10"), shift("d2", "E", "2026-10-11"), shift("d3", "E", "2026-10-12")],
    entries: [sale("d1", 100), sale("d2", 150), sale("d3", 150)],
  };
  // One 170 expense on day 2 (Oct 11).
  const inpCE: PnlInputs = { raw: rawCE, expenses: [exp("x", "E", "2026-10-11", 170)], recurring: [] };
  const nowCE = new Date(2026, 9, 12, 15); // Oct 12 (day 3)
  const today = customRange("day", "2026-10-12");

  it("event: today carries in the net from the event's earlier days", () => {
    const p = pnlSummary(inpCE, "E", today, nowCE);
    expect(p.revenue).toBe(150); // just today's sale
    expect(p.profit).toBeCloseTo(150); // today alone (no expense today)
    expect(p.carriedOver).toBeCloseTo(80); // (100 + 150) − 170 from Oct 10–11
    expect(p.runningProfit).toBeCloseTo(230); // 80 + 150 = everything through today
  });

  it("carried-over is 0 over the event period itself (range starts at day 1)", () => {
    const p = pnlSummary(inpCE, "E", customRange("range", "2026-10-10", "2026-10-14"), nowCE);
    expect(p.carriedOver).toBe(0);
    expect(p.runningProfit).toBeCloseTo(p.profit);
    expect(p.runningProfit).toBeCloseTo(230); // 400 sales − 170
  });

  it("carried-over is 0 over All time", () => {
    const p = pnlSummary(inpCE, "E", "all", nowCE);
    expect(p.carriedOver).toBe(0);
    expect(p.runningProfit).toBeCloseTo(p.profit);
  });

  it("carried-over can be negative (yesterday's shortfall shows as the opening balance)", () => {
    const inpLoss: PnlInputs = { raw: rawCE, expenses: [exp("big", "E", "2026-10-10", 500)], recurring: [] };
    const p = pnlSummary(inpLoss, "E", today, nowCE);
    expect(p.carriedOver).toBeCloseTo(100 + 150 - 500); // −250
    expect(p.runningProfit).toBeCloseTo(-250 + 150); // −100
  });

  it("running profit = carried-over + this range, always", () => {
    for (const r of ["all", "month", customRange("day", "2026-10-11"), customRange("range", "2026-10-11", "2026-10-12")] as const) {
      const p = pnlSummary(inpCE, "E", r, nowCE);
      expect(p.runningProfit).toBeCloseTo(p.carriedOver + p.profit);
    }
  });
});
