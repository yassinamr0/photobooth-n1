"use client";

import { Clock } from "lucide-react";
import { Card, CardHeader } from "@/components/ui/Card";
import { fmtNum, formatEGP } from "@/lib/format";
import { busiestHours, hourLabel, WEEKDAYS, type Cell } from "@/lib/stats/busiest";
import type { Entry } from "@/lib/shift/types";
import { useChartTooltip } from "./ChartTooltip";

/*
 * Sequential single-hue ramp (magenta). Dark surface → low values sit near the surface,
 * high values are bright. Quantised into 5 steps; zero = the chart track color.
 */
const STEPS = [22, 38, 56, 76, 100];
const cellColor = (sales: number, max: number) =>
  sales === 0 || max === 0
    ? "var(--color-chart-track)"
    : `color-mix(in srgb, var(--color-magenta) ${STEPS[Math.min(STEPS.length - 1, Math.floor(((sales - 1) / Math.max(1, max)) * STEPS.length))]}%, var(--color-surface))`;

const tipText = (label: string, c: Cell) => (
  <>
    <b className="text-ink">{label}</b>
    <span className="ml-2 text-ink-muted">{fmtNum(c.sales)} sale{c.sales === 1 ? "" : "s"} · {formatEGP(c.egp)}</span>
  </>
);

/** Stat 1 — Busiest hours (scoped sale entries, bucketed by each entry's own timestamp). */
export function BusiestHours({ entries, scopeLabel }: { entries: Entry[]; scopeLabel: string }) {
  const b = busiestHours(entries);
  const { ref, tooltip, show, hide } = useChartTooltip();
  const maxHour = Math.max(1, ...b.byHour.map((c) => c.sales));

  return (
    <Card padding="lg" data-testid="stat-busiest">
      <CardHeader title="Busiest hours" subtitle={`Sales by hour of day and day of week · ${scopeLabel}`} />
      {b.total.sales === 0 ? (
        <p className="rounded-inner border border-dashed border-line px-4 py-8 text-center text-sm text-ink-faint">No sales in this range.</p>
      ) : (
        <>
          {b.peak && (
            <p data-testid="busiest-peak" className="mb-4 flex items-center gap-2 text-sm text-ink-muted">
              <Clock className="size-4 text-magenta" />
              Busiest:{" "}
              <b className="text-ink">
                {WEEKDAYS[b.peak.weekday]} {hourLabel(b.peak.hour)}–{hourLabel((b.peak.hour + 1) % 24)}
              </b>
              ({fmtNum(b.peak.cell.sales)} sale{b.peak.cell.sales === 1 ? "" : "s"}, {formatEGP(b.peak.cell.egp)})
              <span className="ml-auto text-xs text-ink-faint" data-testid="busiest-total">{fmtNum(b.total.sales)} sales total</span>
            </p>
          )}
          <div className="-mx-2 overflow-x-auto px-2 pb-1">
            <div ref={ref} className="relative min-w-[680px]">
              {/* Heatmap: 7 weekday rows × 24 hour columns, 2px surface gaps between cells */}
              <div className="grid gap-[2px]" style={{ gridTemplateColumns: "36px repeat(24, minmax(0, 1fr)) 44px" }}>
                {WEEKDAYS.map((d, w) => (
                  <Row key={d}>
                    <span className="self-center text-[11px] text-ink-faint">{d}</span>
                    {b.grid[w].map((c, h) => (
                      <button
                        key={h}
                        type="button"
                        tabIndex={c.sales ? 0 : -1}
                        data-testid={c.sales ? `heat-${w}-${h}` : undefined}
                        data-sales={c.sales}
                        aria-label={`${d} ${hourLabel(h)}: ${c.sales} sales`}
                        className="h-7 rounded-[4px] outline-none focus-visible:ring-2 focus-visible:ring-ink"
                        style={{ background: cellColor(c.sales, b.max) }}
                        onMouseEnter={(e) => show(e, tipText(`${d} ${hourLabel(h)}`, c))}
                        onFocus={(e) => show(e, tipText(`${d} ${hourLabel(h)}`, c))}
                        onMouseLeave={hide}
                        onBlur={hide}
                      />
                    ))}
                    <span className="self-center text-right text-[11px] text-ink-muted tabular-nums">{fmtNum(b.byWeekday[w].sales)}</span>
                  </Row>
                ))}
                {/* per-hour totals as a bar strip */}
                <span />
                {b.byHour.map((c, h) => (
                  <div key={h} className="flex h-10 items-end">
                    <div
                      className="w-full rounded-t-[4px] bg-violet"
                      style={{ height: `${c.sales ? Math.max(8, (c.sales / maxHour) * 100) : 0}%` }}
                      onMouseEnter={(e) => show(e, tipText(`${hourLabel(h)} (all days)`, c))}
                      onMouseLeave={hide}
                    />
                  </div>
                ))}
                <span />
                <span />
                {b.byHour.map((_, h) => (
                  <span key={h} className="text-center text-[10px] text-ink-faint tabular-nums">{h % 3 === 0 ? String(h).padStart(2, "0") : ""}</span>
                ))}
                <span />
              </div>
              {tooltip}
            </div>
          </div>
          <div className="mt-3 flex items-center gap-2 text-[11px] text-ink-faint">
            Fewer
            {[0, ...STEPS].map((s, i) => (
              <span key={i} className="size-3 rounded-[3px]"
                style={{ background: s === 0 ? "var(--color-chart-track)" : `color-mix(in srgb, var(--color-magenta) ${s}%, var(--color-surface))` }} />
            ))}
            More sales
          </div>
          {/* Table view for screen readers */}
          <table className="sr-only">
            <caption>Sales count by weekday and hour</caption>
            <tbody>
              {WEEKDAYS.map((d, w) => (
                <tr key={d}>
                  <th scope="row">{d}</th>
                  {b.grid[w].map((c, h) => (c.sales ? <td key={h}>{`${hourLabel(h)}: ${c.sales}`}</td> : null))}
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </Card>
  );
}

function Row({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
