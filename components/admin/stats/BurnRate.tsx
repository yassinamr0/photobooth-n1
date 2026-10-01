"use client";

import { AlertTriangle, Info } from "lucide-react";
import { Card, CardHeader } from "@/components/ui/Card";
import { Tag } from "@/components/ui/Tag";
import { cn } from "@/lib/cn";
import { burnRows, runsOutSoon, type BurnRow } from "@/lib/stats/burn";
import { STOCK_INFO, STOCK_TYPES, type StockType } from "@/lib/inventory/types";
import { fmtNum } from "@/lib/format";
import { STOCK_ICON } from "../InventorySection";
import type { InventoryRow } from "@/lib/inventory/scope";

const days = (d: number | null) => (d == null ? "—" : `≈ ${fmtNum(d)} day${d === 1 ? "" : "s"}`);

/**
 * Stat 3 — Inventory burn-rate projection. Same figure as the Inventory screen (Phase 5,
 * 14-day rolling average). Per-location under an event; combined table under Global.
 */
export function BurnRate({ rows, global }: { rows: InventoryRow[]; global: boolean }) {
  const burn = burnRows(rows);
  return (
    <Card padding="lg" data-testid="stat-burn">
      <CardHeader
        title="Inventory burn rate"
        subtitle={global ? "Every location · soonest to run out first" : `${rows[0]?.event.name ?? ""} · projected from the last 14 days`}
      />
      {burn.length === 0 ? (
        <p className="rounded-inner border border-dashed border-line px-4 py-8 text-center text-sm text-ink-faint">No locations with inventory tracking yet.</p>
      ) : global ? (
        <div className="-mx-2 overflow-x-auto px-2">
          <table data-testid="burn-table" className="w-full min-w-[820px] text-left text-sm">
            <thead className="text-xs text-ink-faint uppercase">
              <tr>
                <th className="py-2 font-medium">Location</th>
                <th className="py-2 pl-4 text-right font-medium">Paper left</th>
                <th className="py-2 pl-4 text-right font-medium">Sheets / day</th>
                <th className="py-2 pl-4 text-right font-medium">Paper runs out</th>
                <th className="py-2 pl-4 text-right font-medium">Ink runs out</th>
                <th className="py-2 pl-4 text-right font-medium">Acrylic runs out</th>
                <th className="py-2 pl-4 text-right font-medium">Magnetic runs out</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {burn.map((b) => <BurnTableRow key={b.row.event.id} b={b} />)}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-4">
          {STOCK_TYPES.map((t) => (
            <Tile key={t} type={t} left={burn[0].row.inv[t]?.currentQuantity ?? 0} perDay={burn[0].row.forecasts[t]?.avgPerDay ?? 0}
              daysLeft={burn[0].days[t]} low={burn[0].row.low[t]} testid={`burn-${t}`} />
          ))}
        </div>
      )}
      <p className="mt-4 flex items-start gap-2 text-xs text-ink-faint">
        <Info className="mt-px size-3.5 shrink-0" />
        Based on the last 14 days of shift consumption, from now — the date range above doesn&apos;t apply. Same figure as the Inventory screen.
      </p>
    </Card>
  );
}

function BurnTableRow({ b }: { b: BurnRow }) {
  const r = b.row;
  const anyLow = STOCK_TYPES.some((t) => r.low[t]);
  const daysCell = (t: StockType, testid?: string) => (
    <td data-testid={testid} className={cn("py-3 pl-4 text-right font-semibold whitespace-nowrap", runsOutSoon(b.days[t]) || r.low[t] ? "text-ink" : "text-ink")}>
      {days(b.days[t])}
    </td>
  );
  return (
    <tr data-testid="burn-row" data-warn={b.warn || undefined}>
      <td className="py-3">
        <span className="font-semibold text-ink">{r.event.name}</span>
        {b.warn && <Tag tone="warning" icon={<AlertTriangle />} className="ml-2">{anyLow ? "Low stock" : "Runs out soon"}</Tag>}
      </td>
      <td className={cn("py-3 pl-4 text-right tabular-nums", r.low.paper ? "text-ink" : "text-ink")}>{r.inv.paper ? fmtNum(r.inv.paper.currentQuantity) : "—"}</td>
      <td className="py-3 pl-4 text-right tabular-nums text-ink-muted">{r.forecasts.paper?.avgPerDay ? fmtNum(r.forecasts.paper.avgPerDay) : "—"}</td>
      {daysCell("paper", "burn-paper-days")}
      {daysCell("ink")}
      {daysCell("acrylic", "burn-acrylic-days")}
      {daysCell("magnetic")}
    </tr>
  );
}

function Tile({ type, left, perDay, daysLeft, low, testid }: {
  type: StockType; left: number; perDay: number; daysLeft: number | null; low: boolean; testid: string;
}) {
  const warn = low || runsOutSoon(daysLeft);
  const Icon = STOCK_ICON[type];
  const { label, unit } = STOCK_INFO[type];
  return (
    <div data-testid={testid} className={cn("rounded-inner border p-4", warn ? "border-warning/40 bg-warning-dim/40" : "border-line bg-surface-2/40")}>
      <div className="flex items-center gap-2 text-ink-muted">
        <Icon className="size-5" /><span className="font-semibold text-ink">{label}</span>
        {warn && <Tag tone="warning" icon={<AlertTriangle />} className="ml-auto">{low ? "Low stock" : "Runs out soon"}</Tag>}
      </div>
      <div className="mt-3 font-display text-4xl font-extrabold tabular-nums text-ink lg:text-3xl" data-testid={`${testid}-days`}>
        {daysLeft == null ? "—" : `≈ ${fmtNum(daysLeft)}`}<span className="ml-1.5 text-base font-semibold text-ink-muted">{daysLeft == null ? "" : "days left"}</span>
      </div>
      <p className="mt-1 text-sm text-ink-muted">
        {fmtNum(left)} {unit} left · {perDay ? `~${fmtNum(perDay)} ${unit}/day` : "no recent usage"}
      </p>
    </div>
  );
}
