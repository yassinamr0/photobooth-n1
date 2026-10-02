"use client";

import { useEffect, type ReactNode } from "react";

/**
 * Modal bottom sheet (mobile) / centered dialog (wider screens).
 * Closes on Escape and backdrop tap.
 */
export function Sheet({
  open,
  onClose,
  title,
  children,
  labelledBy = "sheet-title",
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  children: ReactNode;
  labelledBy?: string;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center sm:items-center" role="presentation">
      {/* Dim to focus (apple-design): the page recedes behind a blurred scrim. */}
      <div className="absolute inset-0 animate-[fade_200ms_ease-out] bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        className="relative max-h-[90dvh] w-full max-w-[480px] animate-[sheet-in_280ms_cubic-bezier(0.32,0.72,0,1)] overflow-y-auto rounded-t-[14px] border border-white/[0.08] bg-surface p-6 pb-8 shadow-[inset_0_1px_0_rgb(255_255_255/0.06),0_0_0_5px_rgb(255_236_246/0.03),0_0_0_6px_rgb(255_236_246/0.07),0_40px_80px_-30px_rgb(0_0_0/0.9)] sm:rounded-[12px]"
      >
        <h2 id={labelledBy} className="mb-5 font-display text-xl font-bold text-ink">
          {title}
        </h2>
        {children}
      </div>
    </div>
  );
}
