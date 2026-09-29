"use client";

import { AlertTriangle, Droplet, FileStack, Info } from "lucide-react";
import { Card, CardHeader } from "@/components/ui/Card";
import { Tag } from "@/components/ui/Tag";
import { cn } from "@/lib/cn";
import { burnRows, RUNS_OUT_SOON_DAYS, type BurnRow } from "@/lib/stats/burn";
import type { InventoryRow } from "@/lib/inventory/scope";

const days = (d: number | null) => (d == null ? "—" : `≈ ${d} day${d === 1 ? "" : "s"}`);

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
          <table data-testid="burn-table" className="w-full min-w-[620px] text-left text-sm">
            <thead className="text-xs text-ink-faint uppercase">
              <tr>
                <th className="py-2 font-medium">Location</th>
                <th className="py-2 text-right font-medium">Paper left</th>
                <th className="py-2 text-right font-medium">Sheets / day</th>
                <th className="py-2 text-right font-medium">Paper runs out</th>
                <th className="py-2 text-right font-medium">Ink left</th>
                <th className="py-2 text-right font-medium">Ink runs out</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {burn.map((b) => <BurnTableRow key={b.row.event.id} b={b} />)}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          <Tile icon={<FileStack className="size-5" />} label="Paper" unit="sheets" left={burn[0].row.inv.paper?.currentQuantity ?? 0}
            perDay={burn[0].row.forecast?.avgPerDay ?? 0} daysLeft={burn[0].paperDays} low={burn[0].row.paperLow} testid="burn-paper" />
          <Tile icon={<Droplet className="size-5" />} label="Ink" unit="cartridges" left={burn[0].row.inv.ink?.currentQuantity ?? 0}
            perDay={burn[0].row.inkForecast?.avgPerDay ?? 0} daysLeft={burn[0].inkDays} low={burn[0].row.inkLow} testid="burn-ink" />
        </div>
      )}
      <p className="mt-4 flex items-start gap-2 text-xs text-ink-faint">
        <Info className="mt-px size-3.5 shrink-0" />
        Based on the last 14 days of shift consumption, from now — the date range above doesn&apos;t apply. Same figure as the Inventory screen.
      </p>
    </Card>
  );
}

function soon(d: number | null) {
  return d != null && d <= RUNS_OUT_SOON_DAYS;
}

function BurnTableRow({ b }: { b: BurnRow }) {
  const r = b.row;
  return (
    <tr data-testid="burn-row" data-warn={b.warn || undefined}>
      <td className="py-3">
        <span className="font-semibold text-ink">{r.event.name}</span>
        {b.warn && <Tag tone="warning" icon={<AlertTriangle />} className="ml-2">{r.paperLow || r.inkLow ? "Low stock" : "Runs out soon"}</Tag>}
      </td>
      <td className={cn("py-3 text-right tabular-nums", r.paperLow ? "text-warning" : "text-ink")}>{r.inv.paper?.currentQuantity ?? "—"}</td>
      <td className="py-3 text-right tabular-nums text-ink-muted">{r.forecast?.avgPerDay || "—"}</td>
      <td data-testid="burn-paper-days" className={cn("py-3 text-right font-semibold", soon(b.paperDays) ? "text-warning" : "text-ink")}>{days(b.paperDays)}</td>
      <td className={cn("py-3 text-right tabular-nums", r.inkLow ? "text-warning" : "text-ink")}>{r.inv.ink?.currentQuantity ?? "—"}</td>
      <td className={cn("py-3 text-right font-semibold", soon(b.inkDays) ? "text-warning" : "text-ink")}>{days(b.inkDays)}</td>
    </tr>
  );
}

function Tile({ icon, label, unit, left, perDay, daysLeft, low, testid }: {
  icon: React.ReactNode; label: string; unit: string; left: number; perDay: number; daysLeft: number | null; low: boolean; testid: string;
}) {
  const warn = low || soon(daysLeft);
  return (
    <div data-testid={testid} className={cn("rounded-inner border p-4", warn ? "border-warning/40 bg-warning-dim/40" : "border-line bg-surface-2/40")}>
      <div className="flex items-center gap-2 text-ink-muted">
        {icon}<span className="font-semibold text-ink">{label}</span>
        {warn && <Tag tone="warning" icon={<AlertTriangle />} className="ml-auto">{low ? "Low stock" : "Runs out soon"}</Tag>}
      </div>
      <div className="mt-3 font-display text-4xl font-extrabold tabular-nums text-ink" data-testid={`${testid}-days`}>
        {daysLeft == null ? "—" : `≈ ${daysLeft}`}<span className="ml-1.5 text-base font-semibold text-ink-muted">{daysLeft == null ? "" : "days left"}</span>
      </div>
      <p className="mt-1 text-sm text-ink-muted">
        {left} {unit} left · {perDay ? `~${perDay} ${unit}/day` : "no recent usage"}
      </p>
    </div>
  );
}
