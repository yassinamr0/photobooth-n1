"use client";

import { useState } from "react";
import { useDashboardScope, useScopedDashboard, useScopedInventory } from "../DashboardData";
import { BusiestHours } from "./BusiestHours";
import { WasteRate } from "./WasteRate";
import { BurnRate } from "./BurnRate";

const RANGE_WORDS = { week: "this week", month: "this month", all: "all time" } as const;

/**
 * Statistics — exactly the three stats in SPEC Phase 6. Every card renders only SCOPED data:
 *  1 & 2 use the event + date-range scoped shifts/entries (useScopedDashboard);
 *  3 uses the event-scoped inventory rows (useScopedInventory — same figure as Inventory).
 */
export function StatisticsSection() {
  const d = useScopedDashboard();
  const inv = useScopedInventory();
  const { scope, scopeName, range } = useDashboardScope();
  const [now] = useState(() => new Date());
  const label = `${scopeName} · ${RANGE_WORDS[range]}`;
  return (
    <div className="flex flex-col gap-5" data-testid="section-statistics">
      <BusiestHours entries={d.entries} scopeLabel={label} />
      <WasteRate shifts={d.shifts} range={range} scopeLabel={label} now={now} />
      <BurnRate rows={inv.rows} global={scope === "global"} />
    </div>
  );
}
