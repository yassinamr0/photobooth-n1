"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Palette } from "lucide-react";
import { cn } from "@/lib/cn";
import { DEFAULT_THEME, THEMES, THEME_KEY, motionEnabled, setMotionEnabled, type ThemeId } from "@/lib/design/themes";

function readTheme(): ThemeId {
  if (typeof document === "undefined") return DEFAULT_THEME;
  return (document.documentElement.dataset.theme as ThemeId) || DEFAULT_THEME;
}

function applyTheme(id: ThemeId) {
  const root = document.documentElement;
  if (id === DEFAULT_THEME) delete root.dataset.theme;
  else root.dataset.theme = id;
  try {
    localStorage.setItem(THEME_KEY, id);
  } catch {
    /* private mode: theme still applies for this visit */
  }
  const bar = THEMES.find((t) => t.id === id)?.bar;
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", bar ?? "#0e111a");
  window.dispatchEvent(new Event("booth-theme"));
}

/**
 * Colour theme picker (per device). A small palette button; the popover lists every theme
 * with its swatches. `placement` decides where the popover opens from its trigger.
 */
export function ThemePicker({ placement = "below", compact }: { placement?: "below" | "side"; compact?: boolean }) {
  const [open, setOpen] = useState(false);
  // Nothing theme-dependent renders until the menu is opened, so reading on the client is safe.
  const [theme, setTheme] = useState<ThemeId>(readTheme);
  const [motion, setMotion] = useState(motionEnabled);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-label="Theme"
        aria-expanded={open}
        title="Theme"
        data-testid="theme-button"
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "flex items-center gap-2 rounded-inner text-sm font-semibold text-ink-muted hover:bg-surface-2 hover:text-ink",
          compact ? "size-10 justify-center" : "h-10 px-3",
        )}
      >
        <Palette className="size-4" />
        {!compact && <span>Theme</span>}
      </button>
      {open && (
        <div
          role="menu"
          aria-label="Choose a theme"
          className={cn(
            "absolute z-40 w-60 animate-pop rounded-card border border-white/[0.09] bg-surface/95 p-1.5 backdrop-blur-xl",
            "shadow-[inset_0_1px_0_rgb(255_255_255/0.06),0_0_0_5px_rgb(255_255_255/0.03),0_0_0_6px_rgb(255_255_255/0.07),0_30px_60px_-24px_rgb(0_0_0/0.9)]",
            placement === "side" ? "bottom-0 left-full ml-3 origin-bottom-left" : "top-full right-0 mt-2 origin-top-right",
          )}
        >
          {THEMES.map((t) => (
            <button
              key={t.id}
              type="button"
              role="menuitemradio"
              aria-checked={theme === t.id}
              data-testid={`theme-${t.id}`}
              onClick={() => {
                applyTheme(t.id);
                setTheme(t.id);
                setOpen(false);
              }}
              className={cn(
                "flex w-full items-center gap-3 rounded-inner px-2.5 py-2 text-left hover:bg-surface-2",
                theme === t.id && "bg-surface-2",
              )}
            >
              <span aria-hidden className="flex shrink-0 overflow-hidden rounded-full border border-white/15">
                {t.swatch.map((c) => <span key={c} className="h-5 w-2.5" style={{ background: c }} />)}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold text-ink">{t.name}</span>
                <span className="block truncate text-xs text-ink-faint">{t.note}</span>
              </span>
              {theme === t.id && <Check className="size-4 text-accent-text" />}
            </button>
          ))}
          {/* Background animation (the dot light that follows the mouse) — desktop only. */}
          <div className="mt-1 hidden border-t border-line pt-1 md:block">
            <button
              type="button"
              role="menuitemcheckbox"
              aria-checked={motion}
              data-testid="bg-motion-toggle"
              onClick={() => {
                setMotionEnabled(!motion);
                setMotion(!motion);
              }}
              className="flex w-full items-center gap-3 rounded-inner px-2.5 py-2 text-left hover:bg-surface-2"
            >
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold text-ink">Background animation</span>
                <span className="block truncate text-xs text-ink-faint">Dots that light up under the mouse</span>
              </span>
              <span aria-hidden className={cn("relative h-5 w-9 shrink-0 rounded-full transition-colors", motion ? "bg-primary" : "bg-line-strong")}>
                <span className={cn("absolute top-0.5 left-0.5 size-4 rounded-full bg-canvas transition-transform duration-200", motion && "translate-x-4")} />
              </span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
