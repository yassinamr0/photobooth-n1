"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useChartTooltip } from "./ChartTooltip";

export type BarSeries = { key: string; label: string; fill: string };
export type BarDatum = { key: string; label: string; values: Record<string, number>; tip: ReactNode };

/**
 * Vertical bars over time, optionally stacked (2px surface gap between segments, 4px rounded
 * top). One y-axis only. Hover/focus a bar for its exact numbers.
 */
export function Bars({
  data,
  series,
  format,
  testid,
  ariaLabel,
}: {
  data: BarDatum[];
  series: BarSeries[];
  format: (n: number) => string;
  testid: string;
  ariaLabel: string;
}) {
  const { ref, tooltip, show, hide } = useChartTooltip();
  // Draw at the container's real width with a fixed height, so text stays readable and the
  // chart doesn't grow huge on wide screens or tiny on phones.
  const [W, setW] = useState(640);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(Math.max(280, Math.round(e.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);
  const H = 220;
  const pad = { l: 56, r: 8, t: 12, b: 28 };
  const totals = data.map((d) => series.reduce((s, x) => s + (d.values[x.key] || 0), 0));
  const max = Math.max(1, ...totals);
  const niceTop = niceCeil(max);
  const innerW = W - pad.l - pad.r;
  const innerH = H - pad.t - pad.b;
  const colW = innerW / Math.max(1, data.length);
  const barW = Math.max(6, Math.min(44, colW * 0.62));
  const y = (v: number) => pad.t + innerH * (1 - v / niceTop);
  const ticks = [0, niceTop / 2, niceTop];
  const labelEvery = Math.ceil(data.length / 12);

  return (
    <div ref={ref} className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} className="block max-w-full" role="img" aria-label={ariaLabel} data-testid={testid}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={pad.l} x2={W - pad.r} y1={y(t)} y2={y(t)} stroke="var(--color-chart-grid)" />
            <text x={pad.l - 8} y={y(t) + 4} textAnchor="end" fontSize="11" fill="var(--color-ink-faint)">{format(t)}</text>
          </g>
        ))}
        {data.map((d, i) => {
          const cx = pad.l + colW * i + colW / 2;
          let acc = 0;
          const total = totals[i];
          return (
            <g
              key={d.key}
              data-testid={`${testid}-bar`}
              data-total={total}
              tabIndex={total ? 0 : -1}
              className="outline-none"
              onMouseEnter={(e) => show(e, d.tip)}
              onFocus={(e) => show(e, d.tip)}
              onMouseLeave={hide}
              onBlur={hide}
            >
              {/* generous hit target */}
              <rect x={cx - colW / 2} y={pad.t} width={colW} height={innerH} fill="transparent" />
              <g className="bar-grow">
              {series.map((s, si) => {
                const v = d.values[s.key] || 0;
                if (v <= 0) return null;
                const top = y(acc + v);
                const h = y(acc) - top - (acc > 0 ? 2 : 0); // 2px surface gap between stacked segments
                acc += v;
                const isTop = series.slice(si + 1).every((x) => !(d.values[x.key] > 0));
                return (
                  <path key={s.key} d={barPath(cx - barW / 2, top, barW, Math.max(1, h), isTop ? 4 : 0)} fill={s.fill} />
                );
              })}
              </g>
              <text x={cx} y={H - 8} textAnchor="middle" fontSize="11" fill="var(--color-ink-faint)">
                {i % labelEvery === 0 ? d.label : ""}
              </text>
            </g>
          );
        })}
      </svg>
      {tooltip}
      <div className="sr-only">
        <table>
          <caption>{ariaLabel}</caption>
          <tbody>
            {data.map((d) => (
              <tr key={d.key}>
                <th scope="row">{d.label}</th>
                {series.map((s) => <td key={s.key}>{`${s.label}: ${format(d.values[s.key] || 0)}`}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/** Revenue is money → gold (fixed meaning). Solid, no gradient. */
export const accentFill = "var(--color-gold)";

/** Rect with only the top corners rounded (data end), flat on the baseline. */
function barPath(x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.min(r, w / 2, h);
  return `M${x},${y + h}V${y + rr}Q${x},${y} ${x + rr},${y}H${x + w - rr}Q${x + w},${y} ${x + w},${y + rr}V${y + h}Z`;
}

function niceCeil(v: number) {
  const p = Math.pow(10, Math.floor(Math.log10(v)));
  const n = v / p;
  const step = n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10;
  return step * p;
}
