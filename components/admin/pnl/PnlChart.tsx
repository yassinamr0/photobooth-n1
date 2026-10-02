"use client";

import { useEffect, useState } from "react";
import { formatEGP } from "@/lib/format";
import type { PnlPoint } from "@/lib/pnl/pnl";
import { useChartTooltip } from "../stats/ChartTooltip";

/*
 * Revenue vs expenses per period (paired bars, 2px gap) + the profit line on the SAME EGP
 * axis (one axis — all three are money). Profit can go below zero, so the axis does too.
 * Colours validated with the dataviz palette checker on the dark surface:
 *   revenue = gold (money in) · expenses = red (money out) · profit = paper-white line.
 *   Fixed meanings are owner-binding; the pair separates for colour-blind readers and the
 *   chart also carries a legend and labels, so colour is never the only cue.
 */
export const PNL_COLORS = { revenue: "#ffc93c", expenses: "#ff5c6c", profit: "var(--color-ink)" };

const compact = (n: number) => {
  const a = Math.abs(n);
  const s = a >= 1000 ? `${Math.round(a / 100) / 10}k` : String(Math.round(a));
  return n < 0 ? `−${s}` : s;
};

export function PnlChart({ points }: { points: PnlPoint[] }) {
  const { ref, tooltip, show, hide } = useChartTooltip();
  const [W, setW] = useState(640);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(Math.max(280, Math.round(e.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);

  const H = 240;
  const pad = { l: 56, r: 8, t: 12, b: 28 };
  const hi = Math.max(1, ...points.flatMap((p) => [p.revenue, p.expenses, p.profit]));
  const lo = Math.min(0, ...points.map((p) => p.profit));
  const top = nice(hi);
  const bottom = lo < 0 ? -nice(-lo) : 0;
  const innerW = W - pad.l - pad.r;
  const innerH = H - pad.t - pad.b;
  const y = (v: number) => pad.t + innerH * ((top - v) / (top - bottom));
  const colW = innerW / Math.max(1, points.length);
  const barW = Math.max(3, Math.min(22, colW * 0.3));
  const cx = (i: number) => pad.l + colW * i + colW / 2;
  const ticks = bottom < 0 ? [bottom, 0, top / 2, top] : [0, top / 2, top];
  const labelEvery = Math.ceil(points.length / 12);
  const line = points.map((p, i) => `${i ? "L" : "M"}${cx(i).toFixed(1)},${y(p.profit).toFixed(1)}`).join("");

  const tip = (p: PnlPoint) => (
    <>
      <b className="text-ink">{p.label}</b>
      <span className="ml-2 text-ink-muted">
        Revenue {formatEGP(Math.round(p.revenue))} · Expenses {formatEGP(Math.round(p.expenses))} ·{" "}
        <b className="text-ink">{p.profit >= 0 ? "Profit" : "Loss"} {formatEGP(Math.round(Math.abs(p.profit)))}</b>
      </span>
    </>
  );

  return (
    <div>
      <div className="mb-2 flex flex-wrap gap-4 text-xs text-ink-muted" data-testid="pnl-legend">
        <Key swatch={<span className="size-3 rounded-[3px]" style={{ background: PNL_COLORS.revenue }} />} label="Revenue" />
        <Key swatch={<span className="size-3 rounded-[3px]" style={{ background: PNL_COLORS.expenses }} />} label="Expenses" />
        <Key swatch={<span className="h-0.5 w-4 rounded-inner bg-ink" />} label="Profit" />
      </div>
      <div ref={ref} className="relative">
        <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} className="block max-w-full" role="img"
          aria-label="Revenue, expenses and profit by period" data-testid="pnl-chart">
          {ticks.map((t) => (
            <g key={t}>
              <line x1={pad.l} x2={W - pad.r} y1={y(t)} y2={y(t)} stroke={t === 0 ? "var(--color-ink-faint)" : "var(--color-chart-grid)"} />
              <text x={pad.l - 8} y={y(t) + 4} textAnchor="end" fontSize="11" fill="var(--color-ink-faint)">{compact(t)}</text>
            </g>
          ))}
          {points.map((p, i) => (
            <g key={p.key} data-testid="pnl-bar" tabIndex={p.revenue || p.expenses ? 0 : -1} className="outline-none"
              onMouseEnter={(e) => show(e, tip(p))} onFocus={(e) => show(e, tip(p))} onMouseLeave={hide} onBlur={hide}>
              <rect x={cx(i) - colW / 2} y={pad.t} width={colW} height={innerH} fill="transparent" />
              {p.revenue > 0 && <path d={bar(cx(i) - barW - 1, y(p.revenue), barW, y(0) - y(p.revenue))} fill={PNL_COLORS.revenue} className="bar-grow" />}
              {p.expenses > 0 && <path d={bar(cx(i) + 1, y(p.expenses), barW, y(0) - y(p.expenses))} fill={PNL_COLORS.expenses} className="bar-grow" />}
              <text x={cx(i)} y={H - 8} textAnchor="middle" fontSize="11" fill="var(--color-ink-faint)">
                {i % labelEvery === 0 ? p.label : ""}
              </text>
            </g>
          ))}
          {points.length > 1 && <path d={line} fill="none" stroke={PNL_COLORS.profit} strokeWidth="2" strokeLinejoin="round" pointerEvents="none" />}
          {points.map((p, i) => (
            <circle key={p.key} cx={cx(i)} cy={y(p.profit)} r="4" fill={PNL_COLORS.profit} stroke="var(--color-surface)" strokeWidth="2" pointerEvents="none" />
          ))}
        </svg>
        {tooltip}
        <div className="sr-only">
          <table>
            <caption>Revenue, expenses and profit by period</caption>
            <tbody>
              {points.map((p) => (
                <tr key={p.key}>
                  <th scope="row">{p.label}</th>
                  <td>Revenue {formatEGP(Math.round(p.revenue))}</td>
                  <td>Expenses {formatEGP(Math.round(p.expenses))}</td>
                  <td>Profit {formatEGP(Math.round(p.profit))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function Key({ swatch, label }: { swatch: React.ReactNode; label: string }) {
  return <span className="flex items-center gap-1.5">{swatch}{label}</span>;
}

/** Bar with 4px rounded top, flat on the baseline. */
function bar(x: number, yTop: number, w: number, h: number) {
  const r = Math.min(4, w / 2, h);
  return `M${x},${yTop + h}V${yTop + r}Q${x},${yTop} ${x + r},${yTop}H${x + w - r}Q${x + w},${yTop} ${x + w},${yTop + r}V${yTop + h}Z`;
}

function nice(v: number) {
  const p = Math.pow(10, Math.floor(Math.log10(v)));
  const n = v / p;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * p;
}
