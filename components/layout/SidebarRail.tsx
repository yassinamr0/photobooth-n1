import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export type RailItem = {
  label: string;
  /** Short text shown under the icon (defaults to label). */
  caption?: string;
  icon: ReactNode;
  href?: string;
  /** In-app navigation (renders a button instead of a link). */
  onClick?: () => void;
  active?: boolean;
};

/**
 * Left navigation for the admin dashboard: icon + short visible caption for every section
 * (icon-only proved hard to find things in). Sticky, full height. Hidden below md.
 */
export function SidebarRail({
  logo,
  items,
  footer,
}: {
  logo?: ReactNode;
  items: RailItem[];
  footer?: ReactNode;
}) {
  return (
    <nav
      aria-label="Main"
      className="sticky top-0 z-10 hidden h-dvh w-[92px] shrink-0 flex-col items-center gap-1 overflow-y-auto border-r border-line bg-canvas py-5 md:flex"
    >
      {logo && <div className="mb-4">{logo}</div>}
      {items.map((item) => {
        const className = cn(
          "group flex w-[76px] flex-col items-center gap-1 rounded-inner px-1 py-2 text-center transition-colors",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-magenta/60",
          item.active ? "text-ink" : "text-ink-faint hover:bg-surface-2 hover:text-ink",
        );
        const common = {
          "aria-label": item.label,
          title: item.label,
          "aria-current": item.active ? ("page" as const) : undefined,
          className,
        };
        const content = (
          <>
            <span
              className={cn(
                "grid size-10 place-items-center rounded-inner [&_svg]:size-5",
                item.active && "frame bg-maroon text-white",
              )}
            >
              {item.icon}
            </span>
            <span className="text-[11px] leading-tight font-semibold">{item.caption ?? item.label}</span>
          </>
        );
        return item.onClick ? (
          <button key={item.label} type="button" onClick={item.onClick} {...common}>
            {content}
          </button>
        ) : (
          <a key={item.label} href={item.href ?? "#"} {...common}>
            {content}
          </a>
        );
      })}
      {footer && <div className="mt-auto">{footer}</div>}
    </nav>
  );
}
