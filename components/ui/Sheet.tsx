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
      <div className="absolute inset-0 bg-black/60 backdrop-blur-[2px]" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        className="relative max-h-[90dvh] w-full max-w-[480px] overflow-y-auto rounded-t-[8px] border border-line bg-surface p-6 pb-8 shadow-panel sm:rounded-inner"
      >
        <h2 id={labelledBy} className="mb-5 font-display text-xl font-bold text-ink">
          {title}
        </h2>
        {children}
      </div>
    </div>
  );
}
