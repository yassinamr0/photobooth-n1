import { describe, expect, it } from "vitest";
import { customRange } from "@/lib/admin/range";
import { scopeDashboard, type RawDashboard } from "@/lib/admin/scope";
import type { Entry, Shift } from "@/lib/shift/types";
import { breakEven } from "./breakeven";
import { paperPerSheet, type CostStep } from "./costs";
import { describeFee, feeOn, saleFee, withFeeFrom, type FeeStep } from "./fees";
import { pnlBreakEven, pnlByLocation, pnlProducts, pnlSummary, pnlTrend, type PnlInputs } from "./pnl";
import { cartridgesPerSheet, productBreakdown } from "./products";

const pct = (percent: number, from = "2026-01-01"): FeeStep => ({ from, mode: "percent", percent, fixed: 0 });
const pf = (percent: number, fixed: number, from = "2026-01-01"): FeeStep => ({ from, mode: "percentPlusFixed", percent, fixed });

describe("card fees", () => {
  it("percent only / percent + fixed per card sale", () => {
    expect(saleFee(pct(2.5), 1000)).toBe(25);
    expect(saleFee(pf(2, 3), 1000)).toBe(23);
    expect(saleFee(pf(2, 3), 0)).toBe(0); // cash-only sale: no fee, not even the fixed part
    expect(saleFee(null, 1000)).toBe(0);
  });
  it("a change applies from its day; earlier days keep the old fee", () => {
    const steps = withFeeFrom([pct(2.5)], pf(2, 3, "2026-10-03"));
    expect(feeOn(steps, "2026-10-02")).toMatchObject({ mode: "percent", percent: 2.5 });
    expect(feeOn(steps, "2026-10-03")).toMatchObject({ mode: "percentPlusFixed", fixed: 3 });
    expect(feeOn(steps, "2025-12-31")).toBeNull();
  });
  it("describes the fee", () => {
    expect(describeFee(pct(2.5))).toBe("2.5% of card sales");
    expect(describeFee(pf(2, 3))).toBe("2% + 3 EGP per card sale");
    expect(describeFee(null)).toBe("No fee");
  });
});

describe("costs", () => {
  it("paper per sheet uses the BOX price ÷ sheets per box", () => {
    const c: CostStep = { from: "2026-01-01", paperBox: 1080, inkCartridge: null, acrylic: null, magnetic: null };
    expect(paperPerSheet(c, 108)).toBe(10);
    expect(paperPerSheet({ ...c, paperBox: null }, 108)).toBeNull();
  });
});

// ---- dataset --------------------------------------------------------------------------------
const shift = (id: string, eventId: string | null, day: string, ink = 0): Shift => ({
  id, uid: "u", staffName: "U", eventId, startTime: new Date(`${day}T12:00:00`).toISOString(), endTime: null,
  startPaperCount: null, paperChanges: 0, inkChanges: ink, endPaperCount: null,
});
let n = 0;
const sale = (shiftId: string, o: { sheets?: number; a?: number; m?: number; custom?: number; total: number; visa?: number }): Entry => ({
  id: `s${++n}`, uid: "u", staffName: "U", shiftId, time: "", type: "sale", sheets: o.sheets ?? 0,
  frames: { Acrylic: o.a ?? 0, Magnetic: o.m ?? 0 }, custom: o.custom ? [{ id: "c", name: "Keychain", price: o.custom }] : [],
  desc: "", total: o.total, cash: o.total - (o.visa ?? 0), visa: o.visa ?? 0,
});
const waste = (shiftId: string, hadr: number): Entry => ({ id: `w${++n}`, uid: "u", staffName: "U", shiftId, time: "", type: "waste", hadr, desc: "", total: 0, cash: 0, visa: 0 });

const raw: RawDashboard = {
  users: [], sheetsPerPack: 18, events: [{ id: "A", name: "City Stars" }, { id: "B", name: "Mall of Egypt" }],
  shifts: [shift("a", "A", "2026-09-10", 1), shift("b", "B", "2026-09-11"), shift("x", null, "2026-09-12")],
  entries: [
    sale("a", { sheets: 1, a: 1, total: 800, visa: 800 }), // 2 prints (400) + acrylic (400), full card
    sale("a", { sheets: 1, a: 1, total: 700 }), // 100 discount → lands on prints (300)
    sale("a", { m: 1, total: 150 }), // magnetic-only sale paid 150 → frame 200, adjustment −50
    waste("a", 1),
    sale("b", { sheets: 0.5, custom: 100, total: 300, visa: 300 }),
    sale("x", { sheets: 0.5, total: 200, visa: 200 }),
  ],
};
const costs: CostStep[] = [{ from: "2026-01-01", paperBox: 1080, inkCartridge: 900, acrylic: 120, magnetic: 60 }];
const now = new Date(2026, 8, 30, 12);
const range = customRange("range", "2026-09-10", "2026-09-16");

describe("profit per product (frames at full price; prints take the difference)", () => {
  const d = scopeDashboard(raw, "A", range, now);
  const ratio = cartridgesPerSheet(raw, "A"); // 1 cartridge / (2 sheets sold + 1 hadr) = 1/3
  const p = productBreakdown(d, [pct(2)], costs, 108, ratio);
  const row = (k: string) => p.rows.find((r) => r.key === k)!;
  it("revenue split", () => {
    expect(row("acrylic")).toMatchObject({ units: 2, revenue: 800 });
    expect(row("prints")).toMatchObject({ units: 4, revenue: 400 + 300 });
    expect(row("magnetic")).toMatchObject({ units: 1, revenue: 200 });
    expect(row("adjust").revenue).toBe(-50);
    expect(p.rows.reduce((s, r) => s + r.revenue, 0)).toBe(800 + 700 + 150); // = the sales total
  });
  it("materials: paper 10/sheet + ink 900 × 1/3 per sheet; frames at cost", () => {
    expect(ratio).toBeCloseTo(1 / 3);
    expect(row("prints").materials).toBeCloseTo(2 * (10 + 300)); // 2 sheets
    expect(row("acrylic").materials).toBe(240);
    expect(row("magnetic").materials).toBe(60);
  });
  it("card fee shared by revenue within the card sale (2% of 800 = 16 → 8 prints / 8 acrylic)", () => {
    expect(row("prints").fees).toBeCloseTo(8);
    expect(row("acrylic").fees).toBeCloseTo(8);
    expect(row("magnetic").fees).toBe(0);
  });
  it("waste cost = hadr × (paper + ink) per sheet", () => {
    expect(p.waste.sheets).toBe(1);
    expect(p.waste.cost).toBeCloseTo(310);
  });
  it("missing costs → null materials, flagged", () => {
    const q = productBreakdown(d, [], [{ ...costs[0], acrylic: null }], 108, ratio);
    expect(q.missingCosts).toBe(true);
    expect(q.rows.find((r) => r.key === "acrylic")!.materials).toBeNull();
    expect(q.materials).toBeNull();
  });
});

describe("card fees in the P&L", () => {
  const inp: PnlInputs = { raw, expenses: [], recurring: [], fees: [pf(2, 3)], costs, sheetsPerBox: 108 };
  it("headline includes fees; they show as their own category", () => {
    const s = pnlSummary(inp, "global", range, now);
    // card sales: 800 (A), 300 (B), 200 (no event) → 2% + 3 each
    const fees = 16 + 3 + 6 + 3 + 4 + 3;
    expect(s.expenses.cardFees).toBeCloseTo(fees);
    expect(s.expenses.byCategory.cardFees).toBeCloseTo(fees);
    expect(s.profit).toBeCloseTo(s.revenue - fees);
  });
  it("location rows (incl. No event fees) add up to Global; trend too", () => {
    const g = pnlSummary(inp, "global", range, now);
    const rows = pnlByLocation(inp, range, now);
    expect(rows.reduce((t, r) => t + r.expenses, 0)).toBeCloseTo(g.expenses.total);
    expect(rows.find((r) => r.name === "No event")!.expenses).toBeCloseTo(7);
    const pts = pnlTrend(inp, "global", range, now);
    expect(pts.reduce((t, x) => t + x.expenses, 0)).toBeCloseTo(g.expenses.total);
  });
  it("products are analysis only — headline profit doesn't subtract materials", () => {
    const s = pnlSummary(inp, "A", range, now);
    expect(s.profit).toBeCloseTo(1650 - 19);
    expect(pnlProducts(inp, "A", range, now).materials).toBeGreaterThan(0);
  });
});

describe("break-even", () => {
  it("fixed ÷ (1 − variable share)", () => {
    const b = breakEven({ revenue: 10000, fixed: 7000, variable: 3000, days: 7 });
    expect(b.fixedPerDay).toBe(1000);
    expect(b.variableShare).toBeCloseTo(0.3);
    expect(b.breakEvenPerDay).toBeCloseTo(1000 / 0.7);
    expect(b.avgPerDay).toBeCloseTo(10000 / 7);
    expect(b.covered).toBe(true);
    expect(b.printsPerDay).toBeCloseTo(1000 / 0.7 / 200);
  });
  it("no revenue: variable share unknown, break-even = fixed per day, not covered", () => {
    const b = breakEven({ revenue: 0, fixed: 700, variable: 0, days: 7 });
    expect(b.variableShare).toBeNull();
    expect(b.breakEvenPerDay).toBe(100);
    expect(b.covered).toBe(false);
  });
  it("variable ≥ 100% → can't break even", () => {
    expect(breakEven({ revenue: 100, fixed: 10, variable: 120, days: 1 }).breakEvenPerDay).toBeNull();
  });
  it("per location from the P&L: 7-day range, rent + materials + fees", () => {
    const inp: PnlInputs = {
      raw, fees: [pct(2)], costs, sheetsPerBox: 108,
      expenses: [{ id: "e", eventId: "A", date: "2026-09-12", amount: 700, category: "rent", note: "", createdBy: "" }], recurring: [],
    };
    const { be } = pnlBreakEven(inp, "A", range, now);
    expect(be.days).toBe(7);
    expect(be.fixedPerDay).toBeCloseTo(100);
    const variable = 620 + 240 + 60 + 16; // prints + acrylic + magnetic materials + fee
    expect(be.variableShare).toBeCloseTo(variable / 1650);
  });
});
