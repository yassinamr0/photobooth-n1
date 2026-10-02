import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/cn";

export type ActionTone = "accent" | "gold" | "neutral" | "danger";

type ActionButtonProps = ComponentProps<"button"> & {
  tone?: ActionTone;
  icon?: ReactNode;
  /** Secondary line under the label, e.g. "18 sheets". */
  sublabel?: ReactNode;
};

const tones: Record<ActionTone, string> = {
  accent: "bg-primary text-on-primary",
  gold: "bg-gold text-[#1a1406]",
  neutral: "bg-surface-2 text-ink border border-line-strong",
  danger: "bg-danger-dim text-danger border border-danger/50",
};

const iconWells: Record<ActionTone, string> = {
  accent: "bg-white/20",
  gold: "bg-black/10",
  neutral: "bg-canvas/60",
  danger: "bg-danger/15",
};

/**
 * Large, one-handed, full-width pill for the staff mobile flow.
 * Min height 64px — well above the 44px touch-target floor.
 */
export function ActionButton({
  tone = "accent",
  icon,
  sublabel,
  className,
  children,
  type = "button",
  ...props
}: ActionButtonProps) {
  return (
    <button
      type={type}
      className={cn(
        "flex min-h-16 w-full items-center gap-4 rounded-inner px-3 pr-6 text-left",
        "transition-[transform,filter,opacity] duration-150 active:scale-[0.98] hover:brightness-105",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-magenta/60",
        "focus-visible:ring-offset-2 focus-visible:ring-offset-canvas",
        "disabled:pointer-events-none disabled:opacity-45",
        tones[tone],
        !icon && "pl-6",
        className,
      )}
      {...props}
    >
      {icon && (
        <span
          className={cn(
            "grid size-11 shrink-0 place-items-center rounded-inner [&_svg]:size-5",
            iconWells[tone],
          )}
        >
          {icon}
        </span>
      )}
      <span className="flex flex-col leading-tight">
        <span className="font-display text-lg font-bold">{children}</span>
        {sublabel && <span className="text-sm opacity-75">{sublabel}</span>}
      </span>
    </button>
  );
}
