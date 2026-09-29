import { describe, expect, it } from "vitest";
import { aggregate, buildShiftSummaryText } from "./summary";
import { expectedPaperUsed, parsePaperSettings } from "./paper";
import type { Entry } from "./types";

const base = { uid: "u", staffName: "Nour", shiftId: "s" };
const entries: Entry[] = [
  { ...base, id: "1", type: "sale", time: "2026-09-29T15:00:00.000Z", sheets: 1.5,
    frames: { Acrylic: 1, Magnetic: 0 }, custom: [], desc: "Sheets (1.5), Acrylic x1", total: 1000, cash: 1000, visa: 0 },
  { ...base, id: "2", type: "sale", time: "2026-09-29T16:00:00.000Z", sheets: 1,
    frames: { Acrylic: 0, Magnetic: 2 }, custom: [], desc: "Sheets (1), Magnetic x2", total: 800, cash: 300, visa: 500 },
  { ...base, id: "3", type: "waste", time: "2026-09-29T17:00:00.000Z", hadr: 0.5,
    desc: "Hadr waste (0.5)", total: 50, cash: 0, visa: 0 },
];

describe("aggregate", () => {
  it("money/items from sales only, hadr from waste; waste cost not revenue", () => {
    expect(aggregate(entries)).toEqual({
      total: 1800, cash: 1300, visa: 500, sheets: 2.5, hadr: 0.5, acrylic: 1, magnetic: 2,
    });
  });
});

describe("buildShiftSummaryText", () => {
  it("matches the legacy format", () => {
    const txt = buildShiftSummaryText(
      "Nour Hassan",
      { startTime: "x" },
      entries,
      (i) => i!.slice(11, 16),
      () => "Sep 29, 18:00",
    );
    expect(txt).toBe(
      "SHIFT SUMMARY — Nour Hassan\nStarted: Sep 29, 18:00\n------------------------------\n" +
        "Total: 1800 EGP  (Cash 1300 / Visa 500)\nSheets sold: 2.5\nHadr wasted: 0.5\n" +
        "Acrylic frames: 1\nMagnetic frames: 2\n------------------------------\n" +
        "15:00  Sheets (1.5), Acrylic x1  —  1000 EGP  [Cash 1000]\n" +
        "16:00  Sheets (1), Magnetic x2  —  800 EGP  [Cash 300 + Visa 500]\n" +
        "17:00  Hadr waste (0.5)  —  50 EGP  [WASTE]\n",
    );
  });
});

describe("paper — packs, not boxes", () => {
  it("defaults: pack 18, box 108 (separate settings)", () => {
    expect(parsePaperSettings(undefined)).toEqual({ sheetsPerPack: 18, sheetsPerBox: 108 });
    expect(parsePaperSettings({ sheetsPerPack: 20 })).toEqual({ sheetsPerPack: 20, sheetsPerBox: 108 });
  });
  it("expectedUsed = start + changes × sheetsPerPack − end", () => {
    expect(expectedPaperUsed({ startPaperCount: 50, paperChanges: 1, endPaperCount: 20 }, 18)).toBe(48);
  });
  it("null unless both start and end exist", () => {
    expect(expectedPaperUsed({ startPaperCount: 50, paperChanges: 1, endPaperCount: null }, 18)).toBeNull();
    expect(expectedPaperUsed({ startPaperCount: null, paperChanges: 1, endPaperCount: 3 }, 18)).toBeNull();
  });
});
