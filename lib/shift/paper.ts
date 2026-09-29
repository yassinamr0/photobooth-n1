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
