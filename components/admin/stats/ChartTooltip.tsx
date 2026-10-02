"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";

type TipState = { x: number; y: number; content: ReactNode } | null;

/** Grace period after leaving a mark, so sliding onto the next bar keeps the same tooltip. */
const HIDE_GRACE_MS = 80;

/**
 * Hover/focus tooltip for chart marks. Put `ref` on a `relative` container, render `tooltip`
 * inside it, and call `show(event, content)` / `hide()` from each mark.
 * The first tooltip fades in; moving to an adjacent mark just re-points it instantly.
 */
export function useChartTooltip<T extends HTMLElement = HTMLDivElement>() {
  const ref = useRef<T>(null);
  const [tip, setTip] = useState<TipState>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = useCallback((e: React.MouseEvent | React.FocusEvent, content: ReactNode) => {
    if (hideTimer.current) clearTimeout(hideTimer.current);
    const host = ref.current?.getBoundingClientRect();
    const r = (e.currentTarget as Element).getBoundingClientRect();
    if (!host) return;
    setTip({ x: r.left + r.width / 2 - host.left, y: r.top - host.top, content });
  }, []);
  const hide = useCallback(() => {
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => setTip(null), HIDE_GRACE_MS);
  }, []);
  useEffect(() => () => {
    if (hideTimer.current) clearTimeout(hideTimer.current);
  }, []);

  const tooltip = tip ? (
    <div
      role="tooltip"
      data-testid="chart-tooltip"
      className="pointer-events-none absolute z-20 -translate-x-1/2 -translate-y-full animate-[tip-in_125ms_ease-out] rounded-inner border border-line-strong bg-surface-2 px-3 py-2 text-xs whitespace-nowrap text-ink shadow-panel"
      style={{ left: tip.x, top: tip.y - 8 }}
    >
      {tip.content}
    </div>
  ) : null;

  return { ref, tooltip, show, hide };
}
