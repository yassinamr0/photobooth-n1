import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { formatEGP } from "@/lib/format";

type Size = "md" | "lg" | "xl";

const sizes: Record<Size, string> = {
  md: "text-xl",
  lg: "text-3xl",
  xl: "text-4xl md:text-5xl",
};

/**
 * Big number display. `money` renders in gold with the EGP suffix;
 * otherwise renders `value` as-is in ink.
 */
export function StatValue({
  label,
  value,
  money,
  size = "lg",
  hint,
  className,
}: {
  label?: ReactNode;
  value: number | string;
  money?: boolean;
  size?: Size;
  hint?: ReactNode;
  className?: string;
}) {
  const display = money && typeof value === "number" ? formatEGP(value) : value;
  return (
    <div className={cn("flex flex-col gap-1", className)}>
      {label && (
        <span className="text-xs font-medium tracking-wide text-ink-faint uppercase">{label}</span>
      )}
      <span
        className={cn(
          "font-display font-bold tracking-tight tabular-nums",
          money ? "text-gold" : "text-ink",
          sizes[size],
        )}
      >
        {display}
      </span>
      {hint && <span className="text-xs text-ink-muted">{hint}</span>}
    </div>
  );
}
