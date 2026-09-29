import type { Entry, Shift } from "./types";
import { fmtNum } from "@/lib/format";

export type ShiftTotals = {
  total: number;
  cash: number;
  visa: number;
  sheets: number;
  hadr: number;
  acrylic: number;
  magnetic: number;
};

/** Current-shift totals. Money + items come from SALES only; hadr from WASTE only. */
export function aggregate(entries: Entry[]): ShiftTotals {
  const t: ShiftTotals = { total: 0, cash: 0, visa: 0, sheets: 0, hadr: 0, acrylic: 0, magnetic: 0 };
  for (const e of entries) {
    if (e.type === "sale") {
      t.total += e.total || 0;
      t.cash += e.cash || 0;
      t.visa += e.visa || 0;
      t.sheets += e.sheets || 0;
      t.acrylic += e.frames?.Acrylic || 0;
      t.magnetic += e.frames?.Magnetic || 0;
    } else if (e.type === "waste") {
      t.hadr += e.hadr || 0;
    }
  }
  return t;
}

export function sortNewestFirst(entries: Entry[]) {
  return entries.slice().sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());
}

export function fmtTime(iso: string | null | undefined) {
  if (!iso) return "--:--";
  return new Date(iso).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}

export function fmtDateTime(iso: string | null | undefined) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Payment badge label for an entry, e.g. "Cash 400 + Visa 200", "WASTE". */
export function paymentTag(e: Entry) {
  if (e.type === "waste") return "WASTE";
  const bits: string[] = [];
  if (e.cash > 0) bits.push(`Cash ${fmtNum(e.cash)}`);
  if (e.visa > 0) bits.push(`Visa ${fmtNum(e.visa)}`);
  return bits.join(" + ") || "-";
}

/** Plain-text shift summary for the clipboard (same format as the legacy app). */
export function buildShiftSummaryText(
  staffName: string,
  shift: Pick<Shift, "startTime"> | null,
  entries: Entry[],
  formatTime = fmtTime,
  formatDateTime = fmtDateTime,
): string {
  const t = aggregate(entries);
  let txt = `SHIFT SUMMARY — ${staffName}\n`;
  txt += `Started: ${shift ? formatDateTime(shift.startTime) : "—"}\n`;
  txt += `------------------------------\n`;
  txt += `Total: ${fmtNum(t.total)} EGP  (Cash ${fmtNum(t.cash)} / Visa ${fmtNum(t.visa)})\n`;
  txt += `Sheets sold: ${fmtNum(t.sheets)}\n`;
  txt += `Hadr wasted: ${fmtNum(t.hadr)}\n`;
  txt += `Acrylic frames: ${fmtNum(t.acrylic)}\n`;
  txt += `Magnetic frames: ${fmtNum(t.magnetic)}\n`;
  txt += `------------------------------\n`;
  entries
    .slice()
    .sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime())
    .forEach((e) => {
      txt += `${formatTime(e.time)}  ${e.desc}  —  ${fmtNum(e.total)} EGP  [${paymentTag(e)}]\n`;
    });
  return txt;
}
