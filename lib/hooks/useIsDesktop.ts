"use client";

import { useSyncExternalStore } from "react";

const QUERY = "(min-width: 1024px)"; // Tailwind `lg`

function subscribe(cb: () => void) {
  const mq = window.matchMedia(QUERY);
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
}

/**
 * True at Tailwind's `lg` width and up. Used where the desktop layout is a different
 * structure (tables) rather than just different CSS, so only one of the two is rendered.
 */
export function useIsDesktop() {
  return useSyncExternalStore(subscribe, () => window.matchMedia(QUERY).matches, () => false);
}
