import { chartColors, chartGradientStops, chartIds } from "@/lib/design/chart";

/**
 * Mount once per page (e.g. at the top of a dashboard) so every chart <svg> on the page
 * can reference the shared ids. Zero-size rather than display:none, which would break
 * gradient/pattern references in some browsers.
 */
export function ChartDefsHost() {
  return (
    <svg aria-hidden width="0" height="0" className="absolute">
      <ChartDefs />
    </svg>
  );
}

/**
 * Shared SVG <defs>: the accent gradient (vertical + horizontal) and the diagonal hatch.
 */
export function ChartDefs() {
  return (
    <defs>
      <linearGradient id={chartIds.gradient} x1="0" y1="1" x2="0" y2="0">
        {chartGradientStops.map((s) => (
          <stop key={s.offset} offset={s.offset} stopColor={s.color} />
        ))}
      </linearGradient>
      <linearGradient id={chartIds.gradientHorizontal} x1="0" y1="0" x2="1" y2="0">
        {chartGradientStops.map((s) => (
          <stop key={s.offset} offset={s.offset} stopColor={s.color} />
        ))}
      </linearGradient>
      <pattern
        id={chartIds.hatch}
        width="6"
        height="6"
        patternUnits="userSpaceOnUse"
        patternTransform="rotate(45)"
      >
        <rect width="6" height="6" fill={chartColors.hatchBase} />
        <rect width="2" height="6" fill={chartColors.hatchStroke} />
      </pattern>
    </defs>
  );
}
