"use client";

import { useLayoutEffect, useRef, useState } from "react";

/**
 * Sliding thumb for an existing segmented control (emil: tab indicator; transform only).
 * Drop it as the first child of a `relative` tablist: it finds the sibling tab with
 * aria-selected="true" and glides under it. The tabs themselves are untouched — the thumb
 * is aria-hidden and ignores the pointer. Tabs need `relative z-[1]` to sit above it.
 */
export function SegThumb() {
  const ref = useRef<HTMLSpanElement>(null);
  const [box, setBox] = useState<{ x: number; w: number } | null>(null);
  const [ready, setReady] = useState(false);

  useLayoutEffect(() => {
    const el = ref.current;
    const track = el?.parentElement;
    if (!el || !track) return;
    const measure = () => {
      const sel = track.querySelector<HTMLElement>('[aria-selected="true"]');
      setBox(sel ? { x: sel.offsetLeft, w: sel.offsetWidth } : null);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(track);
    const mo = new MutationObserver(measure);
    mo.observe(track, { subtree: true, attributes: true, attributeFilter: ["aria-selected"] });
    // Only start animating after the first placement, so it never slides in from 0.
    const id = requestAnimationFrame(() => setReady(true));
    return () => {
      ro.disconnect();
      mo.disconnect();
      cancelAnimationFrame(id);
    };
  }, []);

  return (
    <span
      ref={ref}
      aria-hidden
      className={`key-primary pointer-events-none absolute top-1 bottom-1 left-0 rounded-inner bg-maroon ${ready ? "seg-thumb" : ""}`}
      style={{ width: box?.w ?? 0, translate: `${box?.x ?? 0}px 0`, opacity: box ? 1 : 0 }}
    />
  );
}
