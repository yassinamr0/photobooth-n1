import type { ComponentProps } from "react";
import { cn } from "@/lib/cn";

/** Labelled text input in the Booth Log style (large, touch-friendly). */
export function Field({
  label,
  id,
  className,
  ...props
}: ComponentProps<"input"> & { label: string; id: string }) {
  return (
    <label htmlFor={id} className="flex flex-col gap-1.5">
      <span className="text-xs font-medium tracking-wide text-ink-faint uppercase">{label}</span>
      <input
        id={id}
        className={cn(
          "h-12 rounded-inner border border-white/[0.06] well px-4 text-base text-ink",
          "placeholder:text-ink-faint transition-colors outline-none",
          "hover:border-line-strong focus:border-magenta/70 focus:ring-2 focus:ring-magenta/25",
          className,
        )}
        {...props}
      />
    </label>
  );
}

export function FormError({ children }: { children?: string | null }) {
  if (!children) return null;
  return (
    <p role="alert" className="rounded-inner border border-danger/40 bg-danger-dim px-4 py-3 text-sm text-danger">
      {children}
    </p>
  );
}

export function FormNotice({ children }: { children?: string | null }) {
  if (!children) return null;
  return (
    <p role="status" className="rounded-inner border border-success/35 bg-success-dim px-4 py-3 text-sm text-success">
      {children}
    </p>
  );
}
