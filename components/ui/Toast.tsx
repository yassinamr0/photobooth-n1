"use client";

import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/cn";

type Tone = "neutral" | "success" | "danger";
type ToastState = { msg: string; tone: Tone; key: number } | null;

const ToastContext = createContext<(msg: string, tone?: Tone) => void>(() => {});

/** Lightweight single toast, bottom-center, auto-hides after ~2.2s. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<ToastState>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = useCallback((msg: string, tone: Tone = "neutral") => {
    if (timer.current) clearTimeout(timer.current);
    setToast({ msg, tone, key: Date.now() });
    timer.current = setTimeout(() => setToast(null), 2200);
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
              "rounded-full border px-5 py-3 text-sm font-semibold shadow-panel",
              "animate-[toast-in_160ms_ease-out]",
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
