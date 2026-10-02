"use client";

import { useChartTooltip } from "../stats/ChartTooltip";

export type Slice = { key: string; label: string; value: number; color: string };

/**
 * Donut chart (part-to-whole). Each slice has a 2px surface gap; hover/focus a slice for
 * its exact share. Values are also listed beside it, so colour is never the only cue.
 */
export function ExpenseDonut({ slices, total, centerLabel }: { slices: Slice[]; total: number; centerLabel: string }) {
  const { ref, tooltip, show, hide } = useChartTooltip();
  const R = 80;
  const r = 52;
  const C = 90;
  const sweeps = slices.map((s) => (total > 0 ? (s.value / total) * Math.PI * 2 : 0));
  const starts = sweeps.map((_, i) => -Math.PI / 2 + sweeps.slice(0, i).reduce((x, y) => x + y, 0));
  const arcs = slices.map((s, i) => ({
    ...s,
    d: sweeps[i] >= Math.PI * 2 - 1e-6 ? ring() : arc(starts[i], starts[i] + sweeps[i]),
  }));
  function arc(s: number, e: number) {
    const large = e - s > Math.PI ? 1 : 0;
    const p = (rad: number, a: number) => `${(C + rad * Math.cos(a)).toFixed(2)},${(C + rad * Math.sin(a)).toFixed(2)}`;
    return `M${p(R, s)}A${R},${R} 0 ${large} 1 ${p(R, e)}L${p(r, e)}A${r},${r} 0 ${large} 0 ${p(r, s)}Z`;
  }
  function ring() {
    return `M${C - R},${C}a${R},${R} 0 1 0 ${R * 2},0a${R},${R} 0 1 0 ${-R * 2},0ZM${C - r},${C}a${r},${r} 0 1 1 ${r * 2},0a${r},${r} 0 1 1 ${-r * 2},0Z`;
  }
  return (
    <div ref={ref} className="relative shrink-0">
      <svg viewBox="0 0 180 180" width={180} height={180} role="img" aria-label="Expenses by category" data-testid="pnl-donut">
        {arcs.map((s) => (
          <path key={s.key} d={s.d} fill={s.color} fillRule="evenodd" stroke="var(--color-surface)" strokeWidth={2} tabIndex={0}
            className="cursor-default outline-none transition-opacity hover:opacity-85"
            onMouseEnter={(e) => show(e, <><b className="text-ink">{s.label}</b> <span className="ml-1 text-ink-muted">{Math.round((s.value / total) * 1000) / 10}%</span></>)}
            onFocus={(e) => show(e, <><b className="text-ink">{s.label}</b> <span className="ml-1 text-ink-muted">{Math.round((s.value / total) * 1000) / 10}%</span></>)}
            onMouseLeave={hide} onBlur={hide} />
        ))}
        <text x={C} y={C - 4} textAnchor="middle" fontSize="11" fill="var(--color-ink-faint)">Total</text>
        <text x={C} y={C + 15} textAnchor="middle" fontSize="16" fontWeight="700" fill="var(--color-ink)" style={{ fontFamily: "var(--font-display)" }}>
          {centerLabel}
        </text>
      </svg>
      {tooltip}
    </div>
  );
}
