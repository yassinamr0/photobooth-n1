import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/cn";

type Padding = "none" | "sm" | "md" | "lg";

const paddings: Record<Padding, string> = {
  none: "",
  sm: "p-4",
  md: "p-5",
  lg: "p-6 md:p-7",
};

export function Card({
  padding = "md",
  className,
  ...props
}: ComponentProps<"div"> & { padding?: Padding }) {
  return (
    <div
      className={cn(
        "plate rounded-card border border-white/[0.07]",
        paddings[padding],
        className,
      )}
      {...props}
    />
  );
}

export function CardHeader({
  title,
  subtitle,
  action,
  className,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mb-4 flex items-start justify-between gap-3", className)}>
      <div className="min-w-0">
        <h3 className="font-display text-[1.15rem] leading-tight font-semibold tracking-[0.03em] text-ink uppercase">{title}</h3>
        {subtitle && <p className="mt-0.5 text-sm text-ink-muted">{subtitle}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

export function CardBody({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("text-sm text-ink-muted", className)} {...props} />;
}
