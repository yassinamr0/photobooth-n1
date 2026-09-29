import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * The app's page frame: a dark rounded panel floating on the pastel gradient
 * (the gradient itself is on <body>, see app/layout.tsx). The outer padding is
 * what keeps the gradient visible around the panel — don't remove it.
 *
 * - `dashboard`: desktop-first, with an optional icon-only sidebar rail.
 * - `mobile`: staff shift flow — single centered column, roomy spacing, no chrome.
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
    // Safe-area padding: when installed to an iPhone home screen the page runs full-screen
    // under the status bar / notch / home indicator, so never let the panel go beneath them.
    <div className="min-h-dvh p-3 pt-[max(0.75rem,env(safe-area-inset-top))] pb-[max(0.75rem,env(safe-area-inset-bottom))] pl-[max(0.75rem,env(safe-area-inset-left))] pr-[max(0.75rem,env(safe-area-inset-right))] md:p-6 lg:p-8">
      <div
        className={cn(
          "relative flex min-h-[calc(100dvh-1.5rem)] overflow-hidden bg-canvas shadow-panel",
          "rounded-[20px] md:min-h-[calc(100dvh-3rem)] md:rounded-panel lg:min-h-[calc(100dvh-4rem)]",
          className,
        )}
      >
        {/* faint top glow for depth */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-64 bg-[radial-gradient(ellipse_60%_100%_at_50%_0%,rgb(124_58_237/0.12),transparent)]"
        />
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
    </div>
  );
}
