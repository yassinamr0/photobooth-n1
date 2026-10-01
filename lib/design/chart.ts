/**
 * Chart color tokens — single source for anything drawn in SVG.
 * Mirrored as CSS vars (--color-chart-*) in app/globals.css; keep the two in sync.
 * Memoire palette. The first two are the validated categorical pair (dataviz checker,
 * dark surface #313131: lightness band, chroma, CVD and normal-vision separation all pass).
 */
export const chartSeries = [
  "#cf6aa2", // light Velvet Crimson
  "#923d69", // deep Velvet Crimson
  "#edbbdb", // Pearl Pink
  "#a64d79", // Velvet Crimson
  "#6a1b3a", // Maroon
  "#ffffff", // white
] as const;

export const chartColors = {
  track: "#3d3d3d",
  grid: "#3a3a3a",
  axisText: "rgb(255 255 255 / 0.5)",
  hatchBase: "#3a1b2a",
  hatchStroke: "#cf6aa2",
} as const;

/** Element ids rendered by <ChartDefs />; reference with fill={`url(#${id})`}. */
export const chartIds = {
  hatch: "bl-accent-hatch",
} as const;
