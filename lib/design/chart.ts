/**
 * Chart color tokens — single source for anything drawn in SVG / chart libraries.
 * Mirrored as CSS vars (--color-chart-*) in app/globals.css; keep the two in sync.
 */
export const chartSeries = [
  "#8b5cf6", // violet
  "#d946ef", // magenta
  "#ff4d8d", // pink
  "#ffc93c", // gold
  "#5b9cff", // blue
  "#2dd4bf", // teal
] as const;

export const chartColors = {
  track: "#262136",
  grid: "#221e30",
  axisText: "#6e6886",
  hatchBase: "#2a1838",
  hatchStroke: "#d946ef",
} as const;

/** Stops for the primary violet → magenta → pink gradient. */
export const chartGradientStops = [
  { offset: "0%", color: "#7c3aed" },
  { offset: "55%", color: "#d946ef" },
  { offset: "100%", color: "#ff4d8d" },
] as const;

/** Element ids rendered by <ChartDefs />; reference with fill={`url(#${id})`}. */
export const chartIds = {
  gradient: "bl-accent-gradient",
  gradientHorizontal: "bl-accent-gradient-h",
  hatch: "bl-accent-hatch",
} as const;
