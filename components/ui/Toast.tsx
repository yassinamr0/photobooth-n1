"use client";

import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/cn";

type Tone = "neutral" | "success" | "danger";
type ToastState = { msg: string; tone: Tone; key: number; leaving: boolean } | null;

const ToastContext = createContext<(msg: string, tone?: Tone) => void>(() => {});

/** How long the exit transition runs before the toast is removed. */
const EXIT_MS = 160;

/**
 * Lightweight single toast, bottom-center, auto-hides after ~2.2s.
 * It rises in from below and leaves the same way it came (down + fade), so the motion
 * reads as one object coming and going rather than two different effects.
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<ToastState>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const exitTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = useCallback((msg: string, tone: Tone = "neutral") => {
    if (timer.current) clearTimeout(timer.current);
    if (exitTimer.current) clearTimeout(exitTimer.current);
    setToast({ msg, tone, key: Date.now(), leaving: false });
    timer.current = setTimeout(() => {
      setToast((t) => (t ? { ...t, leaving: true } : t));
      exitTimer.current = setTimeout(() => setToast(null), EXIT_MS);
    }, 2200);
  }, []);

  return (
    <ToastContext.Provider value={show}>
      {children}
      <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-6 z-50 flex justify-center px-4">
        {toast && (
          <div
            key={toast.key}
            role="status"
            className={cn(
              "rounded-inner border px-5 py-3 text-sm font-semibold shadow-panel",
              "animate-[toast-in_160ms_ease-out] transition-[opacity,transform] duration-150 ease-in-out",
              toast.leaving && "translate-y-2 opacity-0",
              toast.tone === "success" && "border-success/40 bg-success-dim text-success",
              toast.tone === "danger" && "border-danger/40 bg-danger-dim text-danger",
              toast.tone === "neutral" && "border-line-strong bg-surface-2 text-ink",
            )}
          >
            {toast.msg}
          </div>
        )}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}
