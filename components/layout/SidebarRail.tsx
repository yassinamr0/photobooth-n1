import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export type RailItem = {
  label: string;
  icon: ReactNode;
  href?: string;
  active?: boolean;
};

/**
 * Minimal icon-only left navigation for the admin dashboard.
 * Labels are exposed via aria-label + title (tooltip). Hidden below md.
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
      className="relative hidden w-[72px] shrink-0 flex-col items-center gap-2 border-r border-line py-5 md:flex"
    >
      {logo && <div className="mb-4">{logo}</div>}
      {items.map((item) => (
        <a
          key={item.label}
          href={item.href ?? "#"}
          aria-label={item.label}
          title={item.label}
          aria-current={item.active ? "page" : undefined}
          className={cn(
            "grid size-11 place-items-center rounded-full transition-colors [&_svg]:size-5",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-magenta/60",
            item.active
              ? "bg-accent-gradient text-white shadow-[0_8px_20px_-8px_rgb(217_70_239/0.8)]"
              : "text-ink-faint hover:bg-surface-2 hover:text-ink",
          )}
        >
          {item.icon}
        </a>
      ))}
      {footer && <div className="mt-auto">{footer}</div>}
    </nav>
  );
}
