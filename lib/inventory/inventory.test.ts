import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { boxesToSheets, isLow, sheetsToBoxes, shiftActualUsed } from "./units";
import { forecastPaper } from "./forecast";
import { pendingDeductions, unattributedShifts } from "./pending";
import { reconcileShift } from "@/lib/shift/paper";
import type { Entry, Shift } from "@/lib/shift/types";
import type { StockDoc, StockLog } from "./types";

const DAY = 86_400_000;

describe("units — BOXES for inventory", () => {
  it("3 boxes × 108 = 324 sheets", () => expect(boxesToSheets(3, 108)).toBe(324));
  it("uses whatever sheetsPerBox is configured (not hardcoded)", () => expect(boxesToSheets(2, 100)).toBe(200));
  it("box equivalent", () => {
    expect(sheetsToBoxes(346, 108)).toBe(3.2);
    expect(sheetsToBoxes(0, 108)).toBe(0);
  });
  it("low stock = strictly below threshold", () => {
    const s = (q: number): StockDoc => ({ type: "paper", currentQuantity: q, lowStockThreshold: 108, trackingSinceMs: 0, updatedAtMs: 0 });
    expect(isLow(s(107))).toBe(true);
    expect(isLow(s(108))).toBe(false);
  });
});

describe("shiftActualUsed — sold + hadr, NOT the expected reconciliation figure", () => {
  const entries: Entry[] = [
    { id: "1", uid: "u", staffName: "", shiftId: "s", time: "", type: "sale", sheets: 1.5, frames: { Acrylic: 0, Magnetic: 0 }, custom: [], desc: "", total: 600, cash: 600, visa: 0 },
    { id: "2", uid: "u", staffName: "", shiftId: "s", time: "", type: "waste", hadr: 0.5, desc: "", total: 0, cash: 0, visa: 0 },
  ];
  it("1.5 sold + 0.5 wasted = 2", () => expect(shiftActualUsed(entries)).toBe(2));
  it("differs from the (mismatched) expected figure", () => {
    const r = reconcileShift({ startPaperCount: 40, paperChanges: 2, endPaperCount: 5 }, { sheets: 1.5, hadr: 0.5 }, 18)!;
    expect(r.expectedUsed).toBe(71);
    expect(shiftActualUsed(entries)).toBe(2);
  });
});

describe("pendingDeductions", () => {
  const now = Date.UTC(2026, 9, 1);
  const shift = (id: string, o: Partial<Shift>): Shift => ({
    id, uid: "u", staffName: "", eventId: "A", startTime: new Date(now - DAY).toISOString(),
    endTime: new Date(now - 1000).toISOString(), startPaperCount: 1, paperChanges: 0, inkChanges: 0, endPaperCount: 1, ...o,
  });
  const paper: StockDoc = { type: "paper", currentQuantity: 0, lowStockThreshold: 0, trackingSinceMs: now - 2 * DAY, updatedAtMs: 0 };
  const map = new Map<string, StockDoc | null>([["A", paper]]);
  it("only ended, event-tagged, undeducted shifts after tracking started", () => {
    const got = pendingDeductions(
      [
        shift("ok", {}),
        shift("open", { endTime: null }),
        shift("noEvent", { eventId: null }),
        shift("done", { stockDeduction: { eventId: "A", sheets: 2, cartridges: 0 } }),
        shift("before", { endTime: new Date(now - 3 * DAY).toISOString() }),
        shift("untracked", { eventId: "B" }),
      ],
      map,
    );
    expect(got.map((s) => s.id)).toEqual(["ok"]);
  });
  it("unattributed = ended with no event", () => {
    expect(unattributedShifts([shift("a", { eventId: null }), shift("b", {}), shift("c", { eventId: null, endTime: null })]).map((s) => s.id)).toEqual(["a"]);
  });
});

describe("forecastPaper — 14-day rolling average", () => {
  const now = Date.UTC(2026, 9, 1);
  const log = (daysAgo: number, delta: number, kind: StockLog["kind"] = "shift"): StockLog => ({
    id: String(Math.random()), stockType: "paper", delta, reason: "", kind, byUid: "", byName: "", createdAtMs: now - daysAgo * DAY,
  });
  it("140 sheets over 14 days → 10/day → 216 left lasts 21 days", () => {
    const logs = Array.from({ length: 14 }, (_, i) => log(i + 0.5, -10));
    expect(forecastPaper(logs, 216, now - 30 * DAY, now)).toEqual({ avgPerDay: 10, windowDays: 14, daysLeft: 21 });
  });
  it("ignores restocks/corrections and logs older than 14 days; subtracts reversals", () => {
    const logs = [log(1, -30), log(2, 10, "shiftReversal"), log(3, 500, "restock"), log(4, -50, "correction"), log(20, -999)];
    expect(forecastPaper(logs, 100, now - 30 * DAY, now).avgPerDay).toBe(round1(20 / 14));
  });
  it("uses days since tracking started when that's shorter than 14", () => {
    expect(forecastPaper([log(1, -20)], 100, now - 2 * DAY, now)).toMatchObject({ avgPerDay: 10, windowDays: 2, daysLeft: 10 });
  });
  it("no consumption → no forecast", () => expect(forecastPaper([], 100, now - 30 * DAY, now).daysLeft).toBeNull());
});

describe("unit guard — inventory code never uses the PACK size", () => {
  it("no sheetsPerPack in lib/inventory (except this test)", () => {
    const dir = join(__dirname);
    for (const f of readdirSync(dir)) {
      if (f.endsWith(".test.ts")) continue;
      expect(readFileSync(join(dir, f), "utf8"), f).not.toMatch(/sheetsPerPack/);
    }
  });
});

function round1(n: number) {
  return Math.round(n * 10) / 10;
}

import { scopeInventory } from "./scope";
import type { EventInventory, EventRecord } from "./types";

describe("scopeInventory — switcher scoping", () => {
  const now = Date.UTC(2026, 9, 1);
  const ev = (id: string): EventRecord => ({ id, name: id, notes: "", status: "active", createdAtMs: 0, createdBy: null });
  const stock = (type: "paper" | "ink", q: number, th: number): StockDoc => ({ type, currentQuantity: q, lowStockThreshold: th, trackingSinceMs: now - 5 * DAY, updatedAtMs: 0 });
  const inv = new Map<string, EventInventory>([
    ["A", { paper: stock("paper", 50, 108), ink: stock("ink", 3, 1), logs: [] }],
    ["B", { paper: stock("paper", 500, 108), ink: stock("ink", 0, 1), logs: [] }],
    ["C", { paper: stock("paper", 500, 108), ink: stock("ink", 5, 1), logs: [] }],
  ]);
  const ended = (id: string, eventId: string | null): Shift => ({
    id, uid: "u", staffName: "", eventId, startTime: new Date(now - DAY).toISOString(), endTime: new Date(now - 1).toISOString(),
    startPaperCount: 1, paperChanges: 0, inkChanges: 0, endPaperCount: 1,
  });
  const shifts = [ended("s1", "A"), ended("s2", "B"), ended("s3", null)];
  it("Global: every location; low banner if ANY location is low (paper or ink)", () => {
    const g = scopeInventory([ev("A"), ev("B"), ev("C")], inv, shifts, "global", now);
    expect(g.rows.map((r) => r.event.id)).toEqual(["A", "B", "C"]);
    expect(g.lowRows.map((r) => r.event.id)).toEqual(["A", "B"]);
    expect(g.pending.map((s) => s.id)).toEqual(["s1", "s2"]);
    expect(g.unattributedCount).toBe(1);
  });
  it("Event: only that location", () => {
    const a = scopeInventory([ev("A"), ev("B"), ev("C")], inv, shifts, "C", now);
    expect(a.rows.map((r) => r.event.id)).toEqual(["C"]);
    expect(a.lowRows).toEqual([]);
    expect(a.pending).toEqual([]);
  });
  it("untracked event (no stock docs) is not low and has no pending", () => {
    const u = scopeInventory([ev("Z")], new Map(), [ended("z", "Z")], "global", now);
    expect(u.rows[0]).toMatchObject({ tracked: false, paperLow: false, pending: [] });
  });
});

import { forecastStock } from "./forecast";

describe("forecastStock — ink uses its own logs only", () => {
  const now = Date.UTC(2026, 9, 1);
  const mk = (type: "paper" | "ink", daysAgo: number, delta: number): StockLog => ({
    id: String(Math.random()), stockType: type, delta, reason: "", kind: "shift", byUid: "", byName: "", createdAtMs: now - daysAgo * DAY,
  });
  it("7 cartridges over 14 days → 0.5/day → 3 left lasts 6 days; paper logs ignored", () => {
    const logs = [...Array.from({ length: 7 }, (_, i) => mk("ink", i * 2 + 1, -1)), mk("paper", 1, -500)];
    expect(forecastStock(logs, "ink", 3, now - 30 * DAY, now)).toEqual({ avgPerDay: 0.5, windowDays: 14, daysLeft: 6 });
  });
});
