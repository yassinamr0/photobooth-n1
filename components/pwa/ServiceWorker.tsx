"use client";

import { useEffect } from "react";

/** Registers /sw.js in production builds (dev builds change constantly — no caching there). */
export function ServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch((e) => console.warn("[sw] registration failed", e));
  }, []);
  return null;
}
