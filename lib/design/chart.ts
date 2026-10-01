/**
 * Chart color tokens — single source for anything drawn in SVG / chart libraries.
 * Mirrored as CSS vars (--color-chart-*) in app/globals.css; keep the two in sync.
 */
export const chartSeries = [
  "#ff8a3d", // film edge
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
  hatchBase: "#2c1c10",
  hatchStroke: "#ff8a3d",
} as const;

/** Stops for the primary violet → magenta → pink gradient. */
export const chartGradientStops = [
  // Solid film-edge orange (stops kept so existing references resolve; no visible gradient).
  { offset: "0%", color: "#ff8a3d" },
  { offset: "100%", color: "#ff8a3d" },
] as const;

/** Element ids rendered by <ChartDefs />; reference with fill={`url(#${id})`}. */
export const chartIds = {
  gradient: "bl-accent-gradient",
  gradientHorizontal: "bl-accent-gradient-h",
  hatch: "bl-accent-hatch",
} as const;
