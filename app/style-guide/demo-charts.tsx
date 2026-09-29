import { chartColors, chartIds, chartSeries } from "@/lib/design/chart";

/*
 * Static, hand-rolled SVG demos of the chart tokens. Sample data only —
 * Phase 6 replaces these with real charts fed from the same tokens.
 */

const week = [
  { day: "Mon", a: 2400, b: 1200 },
  { day: "Tue", a: 1800, b: 800 },
  { day: "Wed", a: 3200, b: 1600 },
  { day: "Thu", a: 2800, b: 2000 },
  { day: "Fri", a: 4400, b: 2400 },
  { day: "Sat", a: 5200, b: 2800 },
  { day: "Sun", a: 3600, b: 1400 },
];

export function DemoBarChart() {
  const w = 560;
  const h = 220;
  const pad = { t: 10, b: 28, l: 8, r: 8 };
  const max = 8000;
  const colW = (w - pad.l - pad.r) / week.length;
  const barW = Math.min(34, colW * 0.5);
  const y = (v: number) => ((h - pad.t - pad.b) * v) / max;

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-auto w-full" role="img" aria-label="Sample weekly sales, cash (solid) vs visa (hatched)">
      {[0.25, 0.5, 0.75, 1].map((f) => (
        <line
          key={f}
          x1={pad.l}
          x2={w - pad.r}
          y1={h - pad.b - (h - pad.t - pad.b) * f}
          y2={h - pad.b - (h - pad.t - pad.b) * f}
          stroke={chartColors.grid}
          strokeDasharray="3 5"
        />
      ))}
      {week.map((d, i) => {
        const x = pad.l + colW * i + (colW - barW) / 2;
        const ha = y(d.a);
        const hb = y(d.b);
        const base = h - pad.b;
        return (
          <g key={d.day}>
            {/* solid gradient segment (bottom) */}
            <rect x={x} y={base - ha} width={barW} height={ha} rx={8} fill={`url(#${chartIds.gradient})`} />
            {/* hatched segment stacked on top, 2px gap */}
            <rect x={x} y={base - ha - hb - 2} width={barW} height={hb} rx={8} fill={`url(#${chartIds.hatch})`} />
            <text x={x + barW / 2} y={h - 8} textAnchor="middle" fontSize="11" fill={chartColors.axisText}>
              {d.day}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

export function DemoProgressRing({ value = 0.68, label = "68%" }: { value?: number; label?: string }) {
  const r = 52;
  const c = 2 * Math.PI * r;
  return (
    <svg viewBox="0 0 140 140" className="size-36" role="img" aria-label={`Progress ${label}`}>
      <circle cx="70" cy="70" r={r} fill="none" stroke={chartColors.track} strokeWidth="14" />
      <circle
        cx="70"
        cy="70"
        r={r}
        fill="none"
        stroke={`url(#${chartIds.gradientHorizontal})`}
        strokeWidth="14"
        strokeLinecap="round"
        strokeDasharray={`${c * value} ${c}`}
        transform="rotate(-90 70 70)"
      />
      <text x="70" y="76" textAnchor="middle" fontSize="22" fontWeight="700" fill="#f4f1fa" className="font-display">
        {label}
      </text>
    </svg>
  );
}

const mix = [
  { label: "Sheets", value: 62, fill: `url(#${chartIds.gradientHorizontal})` },
  { label: "Acrylic", value: 18, fill: `url(#${chartIds.hatch})` },
  { label: "Magnetic", value: 12, fill: chartSeries[3] },
  { label: "Custom", value: 8, fill: chartSeries[4] },
];

export const demoDonutLegend = [
  { label: "Sheets", swatch: "bg-accent-gradient" },
  { label: "Acrylic", swatch: "bg-hatch" },
  { label: "Magnetic", swatch: "bg-chart-4" },
  { label: "Custom", swatch: "bg-chart-5" },
];

export function DemoDonut() {
  const r = 50;
  const c = 2 * Math.PI * r;
  const gap = 4;
  const segments = mix.map((m, i) => ({
    ...m,
    len: (c * m.value) / 100,
    offset: (c * mix.slice(0, i).reduce((sum, x) => sum + x.value, 0)) / 100,
  }));
  return (
    <svg viewBox="0 0 140 140" className="size-36" role="img" aria-label="Sample sales mix donut">
      <circle cx="70" cy="70" r={r} fill="none" stroke={chartColors.track} strokeWidth="18" />
      {segments.map((m) => (
        <circle
          key={m.label}
          cx="70"
          cy="70"
          r={r}
          fill="none"
          stroke={m.fill}
          strokeWidth="18"
          strokeDasharray={`${Math.max(m.len - gap, 0)} ${c}`}
          strokeDashoffset={-m.offset}
          transform="rotate(-90 70 70)"
        />
      ))}
    </svg>
  );
}

const trend = [12, 18, 14, 22, 19, 28, 26, 34, 30, 38, 42, 40];

export function DemoSparkline() {
  const w = 240;
  const h = 72;
  const max = Math.max(...trend);
  const pts = trend.map((v, i) => [(w * i) / (trend.length - 1), h - 6 - ((h - 12) * v) / max] as const);
  const line = pts.map(([x, yy], i) => `${i ? "L" : "M"}${x.toFixed(1)},${yy.toFixed(1)}`).join(" ");
  const area = `${line} L${w},${h} L0,${h} Z`;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-auto w-full" role="img" aria-label="Sample trend line">
      <defs>
        <linearGradient id="bl-spark-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={chartSeries[1]} stopOpacity="0.35" />
          <stop offset="100%" stopColor={chartSeries[1]} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill="url(#bl-spark-fill)" />
      <path d={line} fill="none" stroke={`url(#${chartIds.gradientHorizontal})`} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={pts[pts.length - 1][0] - 2} cy={pts[pts.length - 1][1]} r="4.5" fill={chartSeries[2]} stroke="#17141f" strokeWidth="2" />
    </svg>
  );
}
