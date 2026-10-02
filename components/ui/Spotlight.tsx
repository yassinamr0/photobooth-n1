"use client";

import { useEffect, useState } from "react";
import { SPOTLIGHT_EVENT, spotlightEnabled } from "@/lib/design/themes";

/**
 * Pointer spotlight for card plates (taste: "Spotlight Border Card"). One passive
 * window listener writes --mx/--my on the card under a mouse pointer; the light itself is
 * a background layer of the `plate` utility. Decorative only — never touches events,
 * skipped for touch and reduced motion. Renders nothing.
 */
export function Spotlight() {
  // Can be switched off per device in the theme menu.
  const [on, setOn] = useState(spotlightEnabled);
  useEffect(() => {
    const sync = () => setOn(spotlightEnabled());
    window.addEventListener(SPOTLIGHT_EVENT, sync);
    return () => window.removeEventListener(SPOTLIGHT_EVENT, sync);
  }, []);
  useEffect(() => {
    if (!on || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let current: HTMLElement | null = null;
    let raf = 0;
    let lastEvent: PointerEvent | null = null;
    const clear = () => {
      current?.style.removeProperty("--mx");
      current?.style.removeProperty("--my");
      current = null;
    };
    const apply = () => {
      raf = 0;
      const e = lastEvent;
      if (!e) return;
      const el = (e.target as Element | null)?.closest?.<HTMLElement>(".plate") ?? null;
      if (el !== current) clear();
      if (!el) return;
      const r = el.getBoundingClientRect();
      el.style.setProperty("--mx", `${Math.round(e.clientX - r.left)}px`);
      el.style.setProperty("--my", `${Math.round(e.clientY - r.top)}px`);
      current = el;
    };
    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      lastEvent = e;
      if (!raf) raf = requestAnimationFrame(apply);
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    document.documentElement.addEventListener("pointerleave", clear);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("pointermove", onMove);
      document.documentElement.removeEventListener("pointerleave", clear);
      clear();
    };
  }, [on]);
  return null;
}
