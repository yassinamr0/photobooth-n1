import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/cn";

export type ButtonVariant = "primary" | "secondary" | "pill" | "danger" | "ghost";
export type ButtonSize = "sm" | "md" | "lg";

type ButtonProps = ComponentProps<"button"> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Only meaningful for the `pill` variant (filters / segmented toggles). */
  selected?: boolean;
  loading?: boolean;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
};

const base =
  "inline-flex items-center justify-center gap-2 rounded-inner font-semibold whitespace-nowrap " +
  "transition-[background,color,border-color,box-shadow,transform,opacity] duration-150 " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-edge/70 " +
  "focus-visible:ring-offset-2 focus-visible:ring-offset-canvas " +
  "active:scale-[0.97] disabled:pointer-events-none disabled:opacity-45";

const variants: Record<ButtonVariant, string> = {
  primary:
    "bg-maroon text-white hover:bg-crimson",
  secondary: "bg-surface-2 text-ink border border-line hover:border-line-strong hover:bg-[#2b2126]",
  // pill colors depend on `selected`; see pillStates
  pill: "border",
  danger: "bg-danger-dim text-danger border border-danger/40 hover:border-danger/70",
  ghost: "text-ink-muted hover:text-ink hover:bg-surface-2",
};

const pillStates = {
  on: "bg-ink text-canvas border-ink",
  off: "border-line text-ink-muted hover:text-ink hover:border-line-strong",
};

const sizes: Record<ButtonSize, string> = {
  sm: "h-8 px-3.5 text-xs",
  md: "h-10 px-5 text-sm",
  lg: "h-12 px-7 text-base",
};

export function Button({
  variant = "primary",
  size = "md",
  selected,
  loading,
  leftIcon,
  rightIcon,
  className,
  children,
  disabled,
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      aria-pressed={variant === "pill" ? !!selected : undefined}
      className={cn(
        base,
        variants[variant],
        variant === "pill" && (selected ? pillStates.on : pillStates.off),
        sizes[size],
        className,
      )}
      {...props}
    >
      {loading ? <Spinner /> : leftIcon}
      {children}
      {!loading && rightIcon}
    </button>
  );
}

export function Spinner({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "size-4 animate-spin rounded-full border-2 border-current border-r-transparent",
        className,
      )}
    />
  );
}
