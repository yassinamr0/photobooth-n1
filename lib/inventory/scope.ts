import type { Shift } from "@/lib/shift/types";
import { forecastStock, type Forecast } from "./forecast";
import { pendingDeductions, unattributedShifts } from "./pending";
import { isLow } from "./units";
import type { EventInventory, EventRecord } from "./types";

export type InventoryRow = {
  event: EventRecord;
  inv: EventInventory;
  tracked: boolean; // stock docs exist
  paperLow: boolean;
  inkLow: boolean;
  forecast: Forecast | null; // paper
  inkForecast: Forecast | null;
  pending: Shift[];
};

export type ScopedInventory = {
  rows: InventoryRow[];
  lowRows: InventoryRow[]; // any location under its own threshold (paper or ink)
  pending: Shift[];
  unattributedCount: number;
};

const EMPTY: EventInventory = { paper: null, ink: null, logs: [] };

/**
 * Inventory under the event switcher: Global → every location (comparison table);
 * a specific event → just that location. Pure + unit-tested.
 */
export function scopeInventory(
  events: EventRecord[],
  inventories: Map<string, EventInventory>,
  shifts: Shift[],
  scope: "global" | string,
  nowMs: number,
): ScopedInventory {
  const paperByEvent = new Map(events.map((e) => [e.id, inventories.get(e.id)?.paper ?? null]));
  const allPending = pendingDeductions(shifts, paperByEvent);
  const rows = events
    .filter((e) => scope === "global" || e.id === scope)
    .map((event) => {
      const inv = inventories.get(event.id) ?? EMPTY;
      return {
        event,
        inv,
        tracked: !!inv.paper && !!inv.ink,
        paperLow: isLow(inv.paper),
        inkLow: isLow(inv.ink),
        forecast: inv.paper ? forecastStock(inv.logs, "paper", inv.paper.currentQuantity, inv.paper.trackingSinceMs, nowMs) : null,
        inkForecast: inv.ink ? forecastStock(inv.logs, "ink", inv.ink.currentQuantity, inv.ink.trackingSinceMs, nowMs) : null,
        pending: allPending.filter((s) => s.eventId === event.id),
      };
    });
  return {
    rows,
    lowRows: rows.filter((r) => r.paperLow || r.inkLow),
    pending: rows.flatMap((r) => r.pending),
    unattributedCount: unattributedShifts(shifts).length,
  };
}
