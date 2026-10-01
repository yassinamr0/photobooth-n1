/**
 * Chart color tokens — single source for anything drawn in SVG / chart libraries.
 * Mirrored as CSS vars (--color-chart-*) in app/globals.css; keep the two in sync.
 */
export const chartSeries = [
  "#a64d79", // velvet crimson (brand)
  "#ffc93c", // gold
  "#ff4d8d", // pink (hadr)
  "#4ade80", // green (cash)
  "#5b9cff", // blue (visa)
  "#b5ad9f", // paper grey
] as const;

export const chartColors = {
  track: "#2a2723",
  grid: "#26231f",
  axisText: "#7f786c",
  hatchBase: "#2a1420",
  hatchStroke: "#a64d79",
} as const;

/** Stops for the primary violet → magenta → pink gradient. */
export const chartGradientStops = [
  // Solid velvet crimson (stops kept so existing references resolve; no visible gradient).
  { offset: "0%", color: "#a64d79" },
  { offset: "100%", color: "#a64d79" },
] as const;

/** Element ids rendered by <ChartDefs />; reference with fill={`url(#${id})`}. */
export const chartIds = {
  gradient: "bl-accent-gradient",
  gradientHorizontal: "bl-accent-gradient-h",
  hatch: "bl-accent-hatch",
} as const;
