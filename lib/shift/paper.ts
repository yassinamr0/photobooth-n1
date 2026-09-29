/*
 * Paper units — TWO separate settings, never interchanged (CLAUDE.md):
 *   PACK = settings/paper.sheetsPerPack (default 18)  → staff "+ Paper change", reconciliation
 *   BOX  = settings/paper.sheetsPerBox  (default 108) → admin inventory restocks ONLY
 */
export const DEFAULT_SHEETS_PER_PACK = 18;
export const DEFAULT_SHEETS_PER_BOX = 108;

export type PaperSettings = { sheetsPerPack: number; sheetsPerBox: number };

export function parsePaperSettings(data: Record<string, unknown> | undefined): PaperSettings {
  const pos = (v: unknown, d: number) => (typeof v === "number" && v > 0 ? v : d);
  return {
    sheetsPerPack: pos(data?.sheetsPerPack, DEFAULT_SHEETS_PER_PACK),
    sheetsPerBox: pos(data?.sheetsPerBox, DEFAULT_SHEETS_PER_BOX),
  };
}

/**
 * Paper reconciliation (used by the admin view in Phase 4). Uses PACKS, never boxes.
 *   expectedUsed = startPaperCount + (paperChanges × sheetsPerPack) − endPaperCount
 * Returns null unless BOTH start and end counts exist.
 */
export function expectedPaperUsed(
  shift: { startPaperCount: number | null; paperChanges: number; endPaperCount: number | null },
  sheetsPerPack: number,
): number | null {
  if (shift.startPaperCount == null || shift.endPaperCount == null) return null;
  return shift.startPaperCount + (shift.paperChanges || 0) * sheetsPerPack - shift.endPaperCount;
}

/** Pack size for a shift: its own snapshot if recorded, else the current setting (legacy shifts). */
export function packSizeFor(shift: { sheetsPerPack?: number | null }, currentSheetsPerPack: number) {
  return typeof shift.sheetsPerPack === "number" && shift.sheetsPerPack > 0
    ? shift.sheetsPerPack
    : currentSheetsPerPack;
}

export type Reconciliation = {
  packSize: number;
  addedSheets: number; // paperChanges × packSize
  expectedUsed: number;
  actualUsed: number; // sheets sold + hadr wasted, from this shift's own entries
  diff: number; // actual − expected
  mismatch: boolean;
  /** Mismatch that an admin hasn't checked off yet → drives every warning icon/count. */
  warn: boolean;
};

type ReconcilableShift = {
  startPaperCount: number | null;
  paperChanges: number;
  endPaperCount: number | null;
  sheetsPerPack?: number | null;
  paperVerified?: boolean;
};

/**
 * Per-shift paper reconciliation (PACKS, never boxes). null unless the shift has BOTH a start
 * and an end paper count (open shifts and pre-feature legacy shifts are never flagged).
 */
export function reconcileShift(
  shift: ReconcilableShift,
  totals: { sheets: number; hadr: number },
  currentSheetsPerPack: number,
): Reconciliation | null {
  const packSize = packSizeFor(shift, currentSheetsPerPack);
  const expectedUsed = expectedPaperUsed(shift, packSize);
  if (expectedUsed === null) return null;
  // Sheets are in 0.5 steps; round to 1 decimal to keep float noise out of the comparison.
  const actualUsed = Math.round((totals.sheets + totals.hadr) * 10) / 10;
  const diff = Math.round((actualUsed - expectedUsed) * 10) / 10;
  const mismatch = diff !== 0;
  return {
    packSize,
    addedSheets: (shift.paperChanges || 0) * packSize,
    expectedUsed,
    actualUsed,
    diff,
    mismatch,
    warn: mismatch && shift.paperVerified !== true,
  };
}

/** Plain-language breakdown lines for the admin's expanded shift view. */
export function describeReconciliation(shift: ReconcilableShift, r: Reconciliation) {
  return {
    printer: `Printer: started with ${shift.startPaperCount}, refilled ${shift.paperChanges || 0}× (+${r.addedSheets} sheets), ${shift.endPaperCount} left over → expected ${r.expectedUsed} used`,
    logged: `Logged as sold + wasted: ${r.actualUsed}`,
    status: !r.mismatch
      ? "Matches ✓"
      : `Off by ${Math.abs(r.diff)} (${r.diff > 0 ? "more" : "less"} sold/wasted than the paper accounts for)`,
  };
}
