import { addDays, customRange, dayKey, parseDay, startOfDay } from "@/lib/admin/range";
import { scopeDashboard, type RawDashboard } from "@/lib/admin/scope";
import { scopeInventory } from "@/lib/inventory/scope";
import type { EventInventory, EventRecord } from "@/lib/inventory/types";
import { STOCK_INFO } from "@/lib/inventory/types";
import { pnlBreakEven, pnlByLocation, pnlSummary, type PnlInputs } from "@/lib/pnl/pnl";

/*
 * The daily summary email's content — pure, so the numbers are computed by EXACTLY the same
 * code as the dashboard (scopeDashboard / pnl) and can be unit-tested.
 * `now` is the moment it's sent (9:00 Cairo); it reports on the previous day.
 * Ended events (status "inactive") never produce alerts or break-even lines.
 */

export type SummaryLocation = { name: string; revenue: number; expenses: number; profit: number };
export type SummaryShift = { staff: string; location: string; start: string; end: string | null; hours: number; total: number };
export type SummaryMonthRow = { name: string; revenue: number; profit: number; needPerDay: number | null; avgPerDay: number; covered: boolean | null };

export type DailySummary = {
  day: string; // YYYY-MM-DD (yesterday)
  dayLabel: string;
  totals: { revenue: number; expenses: number; profit: number };
  previous: { revenue: number; profit: number } | null; // the day before
  locations: SummaryLocation[];
  shifts: SummaryShift[];
  month: { label: string; revenue: number; profit: number; rows: SummaryMonthRow[] };
  alerts: string[];
};

const hm = (iso: string) => new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });

export function buildDailySummary(
  inp: PnlInputs & { raw: RawDashboard },
  events: EventRecord[],
  inventories: Map<string, EventInventory>,
  pendingSignups: number,
  now: Date,
): DailySummary {
  const yesterday = addDays(startOfDay(now), -1);
  const day = dayKey(yesterday);
  const range = customRange("day", day);
  const ended = new Set(events.filter((e) => e.status === "inactive").map((e) => e.id));
  const name = (id: string | null) => (id ? events.find((e) => e.id === id)?.name ?? "Deleted event" : "No event");

  const s = pnlSummary(inp, "global", range, now);
  const locations = pnlByLocation(inp, range, now)
    .filter((r) => Math.abs(r.revenue) > 0.004 || Math.abs(r.expenses) > 0.004)
    .map((r) => ({ name: r.name, revenue: r.revenue, expenses: r.expenses, profit: r.profit }));

  const d = scopeDashboard(inp.raw, "global", range, now);
  const shifts = [...d.shifts]
    .sort((a, b) => a.shift.startTime.localeCompare(b.shift.startTime))
    .map((x) => {
      const end = x.shift.endTime;
      const hours = ((end ? new Date(end).getTime() : now.getTime()) - new Date(x.shift.startTime).getTime()) / 3_600_000;
      return { staff: x.staffName, location: name(x.shift.eventId), start: hm(x.shift.startTime), end: end ? hm(end) : null, hours: Math.round(hours * 10) / 10, total: x.totals.total };
    });

  // Month so far = the month containing yesterday, up to yesterday.
  const monthRange = customRange("range", dayKey(new Date(yesterday.getFullYear(), yesterday.getMonth(), 1)), day);
  const m = pnlSummary(inp, "global", monthRange, now);
  const monthRows = events
    .filter((ev) => !ended.has(ev.id))
    .map((ev) => {
      const ps = pnlSummary(inp, ev.id, monthRange, now);
      const { be } = pnlBreakEven(inp, ev.id, monthRange, now);
      return { name: ev.name, revenue: ps.revenue, profit: ps.profit, needPerDay: be.breakEvenPerDay, avgPerDay: be.avgPerDay, covered: be.covered };
    })
    .filter((r) => r.revenue !== 0 || r.profit !== 0);

  // Alerts: low stock (unread, active events only), yesterday's unchecked paper mismatches,
  // shifts not yet deducted, pending signups.
  const inv = scopeInventory(events, inventories, inp.raw.shifts, "global", now.getTime());
  const alerts: string[] = inv.alerts.map((a) => `Low stock — ${a.event.name}: ${STOCK_INFO[a.type].label} ${a.quantity} left (warns below ${a.threshold})`);
  const mismatches = d.shifts.filter((x) => x.recon?.warn);
  for (const x of mismatches) alerts.push(`Paper count mismatch — ${x.staffName} at ${name(x.shift.eventId)} (${hm(x.shift.startTime)})`);
  const pending = inv.pending.filter((p) => !ended.has(p.eventId ?? ""));
  if (pending.length) alerts.push(`${pending.length} ended shift${pending.length === 1 ? "" : "s"} not yet deducted from stock — "Apply now" in Inventory`);
  if (pendingSignups) alerts.push(`${pendingSignups} signup${pendingSignups === 1 ? "" : "s"} waiting for approval`);

  return {
    day,
    dayLabel: parseDay(day).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" }),
    totals: { revenue: s.revenue, expenses: s.expenses.total, profit: s.profit },
    previous: s.previous ? { revenue: s.previous.revenue, profit: s.previous.profit } : null,
    locations,
    shifts,
    month: {
      label: yesterday.toLocaleDateString("en-US", { month: "long", year: "numeric" }) + ` (to ${parseDay(day).getDate()}${ordinal(parseDay(day).getDate())})`,
      revenue: m.revenue,
      profit: m.profit,
      rows: monthRows,
    },
    alerts,
  };
}

function ordinal(n: number) {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return s[(v - 20) % 10] || s[v] || s[0];
}
