/**
 * Chart color tokens — single source for anything drawn in SVG / chart libraries.
 * Brand/neutral entries follow the active theme via CSS vars; data colours are fixed.
 * Mirrored as CSS vars (--color-chart-*) in app/globals.css; keep the two in sync.
 */
export const chartSeries = [
  "var(--color-accent)", // theme accent
  "#ffc93c", // gold
  "#ff4d8d", // pink (hadr)
  "#4ade80", // green (cash)
  "#5b9cff", // blue (visa)
  "var(--color-ink-muted)", // neutral
] as const;

export const chartColors = {
  track: "var(--color-surface-2)",
  grid: "var(--color-line)",
  axisText: "var(--color-ink-faint)",
  hatchBase: "var(--color-accent-dim)",
  hatchStroke: "var(--color-accent)",
} as const;

/** Stops for the primary violet → magenta → pink gradient. */
export const chartGradientStops = [
  // Solid theme accent (stops kept so existing references resolve; no visible gradient).
  { offset: "0%", color: "var(--color-accent)" },
  { offset: "100%", color: "var(--color-accent)" },
] as const;

/** Element ids rendered by <ChartDefs />; reference with fill={`url(#${id})`}. */
export const chartIds = {
  gradient: "bl-accent-gradient",
  gradientHorizontal: "bl-accent-gradient-h",
  hatch: "bl-accent-hatch",
} as const;
