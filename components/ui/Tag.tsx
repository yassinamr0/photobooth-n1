import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/cn";

export type TagTone = "neutral" | "accent" | "gold" | "success" | "warning" | "danger" | "info";

// Refined chips: a ~7% wash of the tone colour, a matching hairline, a 3px radius.
const tones: Record<TagTone, string> = {
  neutral: "bg-white/[0.04] text-ink-muted border-white/[0.08]",
  accent: "bg-crimson/[0.12] text-pearl border-crimson/40",
  gold: "bg-gold/[0.08] text-gold border-gold/30",
  success: "bg-success/[0.08] text-success border-success/30",
  warning: "bg-crimson/[0.12] text-warning border-crimson/40",
  danger: "bg-danger/[0.08] text-danger border-danger/35",
  info: "bg-info/[0.08] text-info border-info/30",
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
        "inline-flex h-6 items-center gap-1.5 rounded-[3px] border px-2 text-xs font-semibold tracking-[0.01em]",
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
