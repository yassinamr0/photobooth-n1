import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * The app's page frame: full-screen dark canvas, edge to edge.
 * (The original pastel-gradient border around a floating panel was removed at the owner's
 * request.)
 *
 * - `dashboard`: desktop-first, with the labelled sidebar rail on the left.
 * - `mobile`: staff shift flow — single centered column, roomy spacing, no chrome.
 *
 * Safe-area padding: when installed to an iPhone home screen the page runs full-screen under
 * the status bar / notch / home indicator, so content never goes beneath them.
 */
export function PanelFrame({
  variant = "dashboard",
  sidebar,
  children,
  className,
}: {
  variant?: "dashboard" | "mobile";
  sidebar?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "relative flex min-h-dvh bg-canvas",
        "pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)]",
        className,
      )}
    >
      {/* Owner's request: a small maroon wash at the top of the page, fading into the noir. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-72 bg-[linear-gradient(to_bottom,rgb(106_27_58/0.55),transparent)]"
      />
      {/* Full-height strip behind the sticky sidebar so its tint runs to the page bottom. */}
      {variant === "dashboard" && sidebar && (
        <div aria-hidden className="pointer-events-none absolute inset-y-0 left-0 hidden w-[92px] border-r border-maroon/50 bg-[#2a2024] md:block" />
      )}
      {variant === "dashboard" && sidebar}
      <main
        className={cn(
          "relative min-w-0 flex-1",
          variant === "dashboard" ? "p-5 md:p-8" : "mx-auto w-full max-w-[480px] px-5 py-6",
        )}
      >
        {children}
      </main>
    </div>
  );
}
