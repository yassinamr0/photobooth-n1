"use client";

import { AlertTriangle, TrendingUp } from "lucide-react";
import { Card, CardHeader } from "@/components/ui/Card";
import { Tag } from "@/components/ui/Tag";
import type { DateRange, ScopedShift } from "@/lib/admin/scope";
import {
  granularityFor,
  isClimbing,
  pct,
  sumUsage,
  wasteTrend,
  type TrendPoint,
} from "@/lib/stats/waste";
import { fmtNum } from "@/lib/format";
import { useChartTooltip } from "./ChartTooltip";

const GRAN_LABEL = { day: "daily", week: "weekly", month: "monthly" } as const;

/** Stat 2 — Waste rate: hadr ÷ (sheets sold + hadr), scoped to event + date range. */
export function WasteRate({ shifts, range, scopeLabel, now }: { shifts: ScopedShift[]; range: DateRange; scopeLabel: string; now: Date }) {
  const overall = sumUsage(shifts);
  const trend = wasteTrend(shifts, range, now, overall);
  const climbing = isClimbing(trend);

  // No per-staff ranking (owner's call): shift timing differs too much — slow morning shifts
  // can be forced to waste paper between sales — so staff can't fairly be compared.
  return (
    <Card padding="lg" data-testid="stat-waste">
      <CardHeader title="Waste rate" subtitle={`Hadr wasted as a share of all sheets used (sold + wasted) · ${scopeLabel}`} />
      {overall.used === 0 ? (
        <p className="empty-state">No sheets sold or wasted in this range.</p>
      ) : (
        <div className="flex flex-col gap-4">
          <div>
            <div data-testid="waste-overall" className="font-display text-5xl font-extrabold tabular-nums text-ink lg:text-4xl">{pct(overall.rate)}</div>
            <p className="mt-1 text-sm text-ink-muted">
              {fmtNum(overall.hadr)} of {fmtNum(overall.used)} sheets wasted
            </p>
          </div>
          <div>
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <h4 className="text-xs font-medium tracking-wide text-ink-faint uppercase">
                Trend · {GRAN_LABEL[granularityFor(range)]} points
              </h4>
              {climbing && <Tag tone="warning" icon={<TrendingUp />}><span data-testid="waste-climbing">Waste rate climbing</span></Tag>}
            </div>
            <TrendChart points={trend} baseline={overall.rate} />
          </div>
        </div>
      )}
    </Card>
  );
}

function TrendChart({ points, baseline }: { points: TrendPoint[]; baseline: number | null }) {
  const { ref, tooltip, show, hide } = useChartTooltip();
  const W = 560;
  const H = 220;
  const pad = { l: 40, r: 12, t: 12, b: 28 };
  const rates = points.map((p) => p.usage.rate).filter((r): r is number => r != null);
  const top = Math.max(0.05, (Math.max(0, ...rates, baseline ?? 0) || 0) * 1.25);
  const x = (i: number) => pad.l + (points.length <= 1 ? (W - pad.l - pad.r) / 2 : (i * (W - pad.l - pad.r)) / (points.length - 1));
  const y = (r: number) => pad.t + (H - pad.t - pad.b) * (1 - r / top);
  const ticks = [0, top / 2, top];

  // Line segments break at empty buckets (gaps, never 0%).
  const segments: string[] = [];
  let cur = "";
  points.forEach((p, i) => {
    if (p.usage.rate == null) {
      if (cur) segments.push(cur);
      cur = "";
      return;
    }
    cur += `${cur ? "L" : "M"}${x(i).toFixed(1)},${y(p.usage.rate).toFixed(1)}`;
  });
  if (cur) segments.push(cur);

  return (
    <div ref={ref} className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" data-testid="waste-trend" role="img"
        aria-label={`Waste rate trend: ${points.map((p) => `${p.label} ${pct(p.usage.rate)}`).join(", ")}`}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={pad.l} x2={W - pad.r} y1={y(t)} y2={y(t)} stroke="var(--color-chart-grid)" />
            <text x={pad.l - 6} y={y(t) + 4} textAnchor="end" fontSize="11" fill="var(--color-ink-faint)">{Math.round(t * 100)}%</text>
          </g>
        ))}
        {baseline != null && (
          <g>
            <line x1={pad.l} x2={W - pad.r} y1={y(baseline)} y2={y(baseline)} stroke="var(--color-ink-faint)" strokeDasharray="4 4" />
            <text x={W - pad.r} y={y(baseline) - 5} textAnchor="end" fontSize="11" fill="var(--color-ink-muted)">avg {pct(baseline)}</text>
          </g>
        )}
        {segments.map((d, i) => (
          <path key={i} d={d} fill="none" stroke="var(--color-magenta)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        ))}
        {points.map((p, i) => (
          <g key={p.key}>
            <text x={x(i)} y={H - 8} textAnchor="middle" fontSize="11" fill="var(--color-ink-faint)">
              {points.length > 12 && i % Math.ceil(points.length / 12) !== 0 ? "" : p.label}
            </text>
            {p.usage.rate != null && (
              <g
                tabIndex={0}
                data-testid="trend-point"
                data-high={p.high || undefined}
                aria-label={`${p.label}: ${pct(p.usage.rate)}`}
                onMouseEnter={(e) => show(e, <TrendTip p={p} />)}
                onFocus={(e) => show(e, <TrendTip p={p} />)}
                onMouseLeave={hide}
                onBlur={hide}
                className="cursor-default outline-none"
              >
                <circle cx={x(i)} cy={y(p.usage.rate)} r="14" fill="transparent" />
                <circle cx={x(i)} cy={y(p.usage.rate)} r={p.high ? 6 : 5} stroke="var(--color-surface)" strokeWidth="2"
                  fill={p.high ? "var(--color-warning)" : "var(--color-magenta)"} />
              </g>
            )}
          </g>
        ))}
      </svg>
      {tooltip}
      {points.some((p) => p.high) && (
        <p className="mt-1 flex items-center gap-1.5 text-xs text-warning">
          <AlertTriangle className="size-3.5" /> Amber points are unusually high for this range
        </p>
      )}
      <div className="sr-only">
        <table>
          <caption>Waste rate by period</caption>
          <tbody>
            {points.map((p) => (
              <tr key={p.key}><th scope="row">{p.label}</th><td>{pct(p.usage.rate)}</td><td>{fmtNum(p.usage.hadr)} of {fmtNum(p.usage.used)} sheets</td></tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function TrendTip({ p }: { p: TrendPoint }) {
  return (
    <>
      <b className="text-ink">{p.label}</b>
      <span className="ml-2 text-ink-muted">{pct(p.usage.rate)} · {fmtNum(p.usage.hadr)} of {fmtNum(p.usage.used)} sheets</span>
      {p.high && <span className="ml-2 text-warning">High</span>}
    </>
  );
}
