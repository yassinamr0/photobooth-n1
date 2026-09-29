"use client";

import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { Card, CardHeader } from "@/components/ui/Card";
import { cn } from "@/lib/cn";
import { fmtNum, formatEGP } from "@/lib/format";
import type { DateRange, RawDashboard, Scope, ScopedDashboard } from "@/lib/admin/scope";
import { granularityFor, pct } from "@/lib/stats/waste";
import { locationComparison, moneyTrend, revenueComparison } from "@/lib/stats/revenue";
import { accentFill, Bars } from "./Bars";

const GRAN = { day: "daily", week: "weekly", month: "monthly" } as const;
const compactEGP = (n: number) => (n >= 1000 ? `${Math.round(n / 100) / 10}k` : String(Math.round(n)));

/* ───────────── Revenue trend + vs same point last period ───────────── */
export function RevenueTrend({ scoped, raw, scope, range, scopeLabel, now }: {
  scoped: ScopedDashboard; raw: RawDashboard; scope: Scope; range: DateRange; scopeLabel: string; now: Date;
}) {
  const trend = moneyTrend(scoped, range, now);
  const cmp = revenueComparison(raw, scope, range, now);
  const salesCount = trend.reduce((s, p) => s + p.sales, 0);
  return (
    <Card padding="lg" data-testid="stat-revenue">
      <CardHeader title="Revenue" subtitle={`Sales income over time · ${scopeLabel}`} />
      <div className="mb-4 flex flex-wrap items-end gap-x-6 gap-y-2">
        <div>
          <div data-testid="revenue-total" className="font-display text-5xl font-extrabold tabular-nums text-gold lg:text-4xl">{formatEGP(scoped.overview.total)}</div>
          <p className="mt-1 text-sm text-ink-muted">
            {fmtNum(salesCount)} sale{salesCount === 1 ? "" : "s"}
            {salesCount ? ` · average ${formatEGP(Math.round(scoped.overview.total / salesCount))}` : ""}
          </p>
        </div>
        {cmp && <ComparisonChip c={cmp} />}
      </div>
      {scoped.overview.total === 0 ? (
        <p className="rounded-inner border border-dashed border-line px-4 py-8 text-center text-sm text-ink-faint">No sales in this range.</p>
      ) : (
        <>
          <h4 className="mb-1 text-xs font-medium tracking-wide text-ink-faint uppercase">{GRAN[granularityFor(range)]} revenue</h4>
          <Bars
            testid="revenue-chart"
            ariaLabel="Revenue by period"
            series={[{ key: "total", label: "Revenue", fill: accentFill }]}
            format={compactEGP}
            data={trend.map((p) => ({
              key: p.key,
              label: p.label,
              values: { total: p.totals.total },
              tip: (
                <>
                  <b className="text-ink">{p.label}</b>
                  <span className="ml-2 text-ink-muted">{formatEGP(p.totals.total)} · {fmtNum(p.sales)} sale{p.sales === 1 ? "" : "s"}</span>
                </>
              ),
            }))}
          />
        </>
      )}
    </Card>
  );
}

function ComparisonChip({ c }: { c: NonNullable<ReturnType<typeof revenueComparison>> }) {
  if (c.change == null) {
    return (
      <p data-testid="revenue-change" className="pb-2 text-sm text-ink-muted">
        No sales at the {c.previousLabel} to compare with
      </p>
    );
  }
  const up = c.change > 0.0005;
  const down = c.change < -0.0005;
  const Icon = up ? ArrowUpRight : down ? ArrowDownRight : Minus;
  return (
    <p data-testid="revenue-change" className="flex items-center gap-2 pb-2 text-sm text-ink-muted">
      <span className={cn("inline-flex items-center gap-1 rounded-full border px-2.5 py-1 font-semibold",
        up ? "border-success/40 bg-success-dim text-success" : down ? "border-danger/40 bg-danger-dim text-danger" : "border-line bg-surface-2 text-ink")}>
        <Icon className="size-4" />
        {up ? "+" : ""}{pct(c.change)}
      </span>
      vs {c.previousLabel} ({formatEGP(c.previous)})
    </p>
  );
}

/* ───────────── Cash vs Visa trend ───────────── */
export function PaymentSplit({ scoped, range, scopeLabel, now }: { scoped: ScopedDashboard; range: DateRange; scopeLabel: string; now: Date }) {
  const trend = moneyTrend(scoped, range, now);
  const { cash, visa } = scoped.overview;
  const paid = cash + visa;
  return (
    <Card padding="lg" data-testid="stat-payment">
      <CardHeader title="Cash vs Visa" subtitle={`How customers paid · ${scopeLabel}`} />
      {paid === 0 ? (
        <p className="rounded-inner border border-dashed border-line px-4 py-8 text-center text-sm text-ink-faint">No payments in this range.</p>
      ) : (
        <>
          <div className="mb-3 flex flex-wrap gap-6" data-testid="payment-split">
            <Legend swatch="bg-success" label="Cash" value={cash} share={cash / paid} />
            <Legend swatch="bg-info" label="Visa" value={visa} share={visa / paid} />
          </div>
          {/* share bar */}
          <div className="mb-5 flex h-2 gap-[2px] overflow-hidden rounded-full">
            {cash > 0 && <div className="bg-success" style={{ width: `${(cash / paid) * 100}%` }} />}
            {visa > 0 && <div className="bg-info" style={{ width: `${(visa / paid) * 100}%` }} />}
          </div>
          <h4 className="mb-1 text-xs font-medium tracking-wide text-ink-faint uppercase">{GRAN[granularityFor(range)]} split</h4>
          <Bars
            testid="payment-chart"
            ariaLabel="Cash and visa by period"
            series={[
              { key: "cash", label: "Cash", fill: "var(--color-success)" },
              { key: "visa", label: "Visa", fill: "var(--color-info)" },
            ]}
            format={compactEGP}
            data={trend.map((p) => ({
              key: p.key,
              label: p.label,
              values: { cash: p.totals.cash, visa: p.totals.visa },
              tip: (
                <>
                  <b className="text-ink">{p.label}</b>
                  <span className="ml-2 text-ink-muted">
                    Cash {formatEGP(p.totals.cash)} · Visa {formatEGP(p.totals.visa)}
                    {p.totals.cash + p.totals.visa > 0 && ` · ${pct(p.totals.cash / (p.totals.cash + p.totals.visa))} cash`}
                  </span>
                </>
              ),
            }))}
          />
        </>
      )}
    </Card>
  );
}

function Legend({ swatch, label, value, share }: { swatch: string; label: string; value: number; share: number }) {
  return (
    <div className="flex items-center gap-3">
      <span className={cn("size-3 rounded-[4px]", swatch)} />
      <div>
        <div className="text-sm text-ink-muted">{label}</div>
        <div className="font-display text-2xl font-bold tabular-nums text-ink">
          {pct(share)} <span className="text-sm font-semibold text-ink-muted">{formatEGP(value)}</span>
        </div>
      </div>
    </div>
  );
}

/* ───────────── Location comparison ───────────── */
export function LocationComparison({ raw, scope, range, now, rangeLabel }: {
  raw: RawDashboard; scope: Scope; range: DateRange; now: Date; rangeLabel: string;
}) {
  const rows = locationComparison(raw, range, now);
  const maxRev = Math.max(1, ...rows.map((r) => r.revenue));
  return (
    <Card padding="lg" data-testid="stat-locations">
      <CardHeader
        title="Locations compared"
        subtitle={`Every location side by side · ${rangeLabel}${scope !== "global" ? " · selected location highlighted" : ""}`}
      />
      {rows.length === 0 ? (
        <p className="rounded-inner border border-dashed border-line px-4 py-8 text-center text-sm text-ink-faint">Create events to compare locations.</p>
      ) : (
        <div className="-mx-2 overflow-x-auto px-2">
          <table data-testid="locations-table" className="w-full min-w-[760px] text-left text-sm">
            <thead className="text-xs text-ink-faint uppercase">
              <tr>
                <th className="py-2 font-medium">Location</th>
                <th className="py-2 font-medium">Revenue</th>
                <th className="py-2 pl-4 text-right font-medium whitespace-nowrap">Sales</th>
                <th className="py-2 pl-4 text-right font-medium whitespace-nowrap">Avg sale</th>
                <th className="py-2 pl-4 text-right font-medium whitespace-nowrap">Hours</th>
                <th className="py-2 pl-4 text-right font-medium whitespace-nowrap">EGP / hour</th>
                <th className="py-2 pl-4 text-right font-medium whitespace-nowrap">Sheets sold</th>
                <th className="py-2 pl-4 text-right font-medium whitespace-nowrap">Waste</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map((r) => {
                const selected = scope !== "global" && r.id === scope;
                return (
                  <tr key={r.id ?? "none"} data-testid="location-row" data-selected={selected || undefined}
                    className={cn(selected && "bg-accent-dim/60", !r.id && "text-ink-muted")}>
                    <td className="py-3 pr-3 font-semibold text-ink">
                      {r.name}
                      {!r.id && <span className="ml-1 text-xs font-normal text-ink-faint">(shifts with no event)</span>}
                    </td>
                    <td className="py-3 pr-4">
                      <div className="flex items-center gap-2">
                        <span data-testid="location-revenue" className="w-24 font-semibold tabular-nums text-gold">{formatEGP(r.revenue)}</span>
                        <div className="h-1.5 w-24 overflow-hidden rounded-full bg-chart-track">
                          <div className="h-full rounded-full bg-violet" style={{ width: `${(r.revenue / maxRev) * 100}%` }} />
                        </div>
                      </div>
                    </td>
                    <td className="py-3 pl-4 text-right tabular-nums">{fmtNum(r.sales)}</td>
                    <td className="py-3 pl-4 text-right tabular-nums">{r.avgSale == null ? "—" : formatEGP(Math.round(r.avgSale))}</td>
                    <td className="py-3 pl-4 text-right tabular-nums">{fmtNum(r.hours)}</td>
                    <td className="py-3 pl-4 text-right font-semibold tabular-nums">{r.revenuePerHour == null ? "—" : formatEGP(Math.round(r.revenuePerHour))}</td>
                    <td className="py-3 pl-4 text-right tabular-nums">{fmtNum(r.sheets)}</td>
                    <td className="py-3 pl-4 text-right tabular-nums">{pct(r.waste.rate)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <p className="mt-3 text-xs text-ink-faint">
        Hours = time staff were clocked in (open shifts count up to now). Each row matches that location&apos;s Overview for the same range.
      </p>
    </Card>
  );
}
