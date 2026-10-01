import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/cn";

export type TagTone = "neutral" | "accent" | "gold" | "success" | "warning" | "danger" | "info";

const tones: Record<TagTone, string> = {
  neutral: "bg-surface-2 text-ink-muted border-line",
  accent: "bg-accent-dim text-ink border-magenta/35",
  gold: "bg-gold-dim text-ink border-crimson/35",
  success: "bg-success-dim text-success border-success/35",
  warning: "bg-warning-dim text-ink border-warning/35",
  danger: "bg-danger-dim text-danger border-danger/40",
  info: "bg-info-dim text-ink border-info/35",
};

type TagProps = ComponentProps<"span"> & {
  tone?: TagTone;
  /** Leading status dot. */
  dot?: boolean;
  icon?: ReactNode;
};

/** Small rounded status/category label — roles, event status, warnings. */
export function Tag({ tone = "neutral", dot, icon, className, children, ...props }: TagProps) {
  return (
    <span
      className={cn(
        "inline-flex h-6 items-center gap-1.5 rounded-inner border px-2.5 text-xs font-semibold",
        "whitespace-nowrap [&_svg]:size-3.5",
        tones[tone],
        className,
      )}
      {...props}
    >
      {dot && <span aria-hidden className="size-1.5 rounded-full bg-current" />}
      {icon}
      {children}
    </span>
  );
}
