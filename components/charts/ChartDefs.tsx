import { chartColors, chartIds } from "@/lib/design/chart";

/**
 * Mount once per page (e.g. at the top of a dashboard) so every chart <svg> on the page
 * can reference the shared ids. Zero-size rather than display:none, which would break
 * pattern references in some browsers.
 */
export function ChartDefsHost() {
  return (
    <svg aria-hidden width="0" height="0" className="absolute">
      <ChartDefs />
    </svg>
  );
}

/**
 * Shared SVG <defs>: the diagonal hatch (texture for colour-blind / print readers).
 * No gradients — fills are solid brand colours.
 */
export function ChartDefs() {
  return (
    <defs>
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
