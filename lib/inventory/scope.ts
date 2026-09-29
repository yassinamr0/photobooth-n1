import type { Shift } from "@/lib/shift/types";
import { forecastStock, type Forecast } from "./forecast";
import { pendingDeductions, unattributedShifts } from "./pending";
import { isAlerting, isLow } from "./units";
import { emptyInventory, STOCK_TYPES, type EventInventory, type EventRecord, type StockType } from "./types";

export type InventoryRow = {
  event: EventRecord;
  inv: EventInventory;
  tracked: boolean; // all stock docs exist
  /** Below warning level, per type (whether or not the alert was marked as read). */
  low: Record<StockType, boolean>;
  /** Low AND not marked as read — what drives banners. */
  alerting: Record<StockType, boolean>;
  forecasts: Record<StockType, Forecast | null>;
  pending: Shift[];
};

/** One low-stock alert (a location + stock type). */
export type StockAlert = { event: EventRecord; type: StockType; quantity: number; threshold: number; dismissed: boolean };

export type ScopedInventory = {
  rows: InventoryRow[];
  /** Locations with at least one ACTIVE (unread) low-stock alert. */
  lowRows: InventoryRow[];
  alerts: StockAlert[]; // active (unread)
  readAlerts: StockAlert[]; // marked as read, still low
  pending: Shift[];
  unattributedCount: number;
};

const perType = <T,>(f: (t: StockType) => T) =>
  Object.fromEntries(STOCK_TYPES.map((t) => [t, f(t)])) as Record<StockType, T>;

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
  const rows: InventoryRow[] = events
    .filter((e) => scope === "global" || e.id === scope)
    .map((event) => {
      const inv = inventories.get(event.id) ?? emptyInventory();
      const forecasts = perType((t) => {
        const s = inv[t];
        return s ? forecastStock(inv.logs, t, s.currentQuantity, s.trackingSinceMs, nowMs) : null;
      });
      // An ENDED event (temporary location, status "inactive") raises no low-stock alerts.
      const ended = event.status === "inactive";
      const low = perType((t) => !ended && isLow(inv[t]));
      return {
        event,
        inv,
        tracked: STOCK_TYPES.every((t) => !!inv[t]),
        low,
        alerting: perType((t) => !ended && isAlerting(inv[t])),
        forecasts,
        pending: allPending.filter((s) => s.eventId === event.id),
      };
    });
  const alert = (r: InventoryRow, t: StockType): StockAlert => ({
    event: r.event, type: t, quantity: r.inv[t]!.currentQuantity, threshold: r.inv[t]!.lowStockThreshold, dismissed: !!r.inv[t]!.alertDismissed,
  });
  const allLow = rows.flatMap((r) => STOCK_TYPES.filter((t) => r.low[t]).map((t) => alert(r, t)));
  return {
    rows,
    lowRows: rows.filter((r) => STOCK_TYPES.some((t) => r.alerting[t])),
    alerts: allLow.filter((a) => !a.dismissed),
    readAlerts: allLow.filter((a) => a.dismissed),
    pending: rows.flatMap((r) => r.pending),
    unattributedCount: unattributedShifts(shifts).length,
  };
}
