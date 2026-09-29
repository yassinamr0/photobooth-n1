"use client";

import { useState } from "react";
import { ChartDefsHost } from "@/components/charts/ChartDefs";
import { useDashboardRaw, useDashboardScope, useScopedDashboard, useScopedInventory } from "../DashboardData";
import { BusiestHours } from "./BusiestHours";
import { WasteRate } from "./WasteRate";
import { BurnRate } from "./BurnRate";
import { LocationComparison, PaymentSplit, RevenueTrend } from "./RevenueCards";

const RANGE_WORDS = { week: "this week", month: "this month", all: "all time" } as const;

/**
 * Statistics. SPEC Phase 6's three stats (Busiest hours, Waste rate, Burn rate) plus three
 * owner-approved additions (Revenue trend + vs last period, Locations compared, Cash vs Visa).
 * Every card respects the event switcher:
 *  - most render the event + date-range scoped data (useScopedDashboard);
 *  - "vs last period" and "Locations compared" need data outside the range, so they use
 *    useDashboardRaw but go through the same scoping functions (scopeWindow/scopeDashboard);
 *  - burn rate uses the event-scoped inventory rows (same figure as the Inventory screen).
 */
export function StatisticsSection() {
  const d = useScopedDashboard();
  const inv = useScopedInventory();
  const { raw } = useDashboardRaw();
  const { scope, scopeName, range } = useDashboardScope();
  const [now] = useState(() => new Date());
  const label = `${scopeName} · ${RANGE_WORDS[range]}`;
  return (
    <div className="flex flex-col gap-5" data-testid="section-statistics">
      <ChartDefsHost />
      <RevenueTrend scoped={d} raw={raw} scope={scope} range={range} scopeLabel={label} now={now} />
      <LocationComparison raw={raw} scope={scope} range={range} now={now} rangeLabel={RANGE_WORDS[range]} />
      <BusiestHours entries={d.entries} scopeLabel={label} />
      <div className="grid gap-5 xl:grid-cols-2">
        <PaymentSplit scoped={d} range={range} scopeLabel={label} now={now} />
        <WasteRate shifts={d.shifts} range={range} scopeLabel={label} now={now} />
      </div>
      <BurnRate rows={inv.rows} global={scope === "global"} />
    </div>
  );
}
