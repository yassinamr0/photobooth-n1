"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import { SegThumb } from "@/components/ui/Segmented";
import {
  customRange,
  dayKey,
  isCustom,
  parseDay,
  shiftCustom,
  type CustomMode,
  type CustomRange,
  type DateRange,
} from "@/lib/admin/range";

const MODES: { id: CustomMode; label: string }[] = [
  { id: "day", label: "Day" },
  { id: "week", label: "Week" },
  { id: "range", label: "Date range" },
];

const input =
  "h-10 w-full min-w-0 rounded-inner border border-white/[0.06] well px-3 text-sm text-ink outline-none [color-scheme:dark] focus:border-magenta/70";
const label = "mb-1.5 block text-xs font-medium tracking-wide text-ink-faint uppercase";

/**
 * Custom range popover: a single day, the Mon–Sun week around a picked day, or any
 * from–to span (inclusive). Applies to every section the date range applies to.
 */
export function CustomRangePicker({
  range,
  onApply,
  onClose,
}: {
  range: DateRange;
  onApply: (r: CustomRange) => void;
  onClose: () => void;
}) {
  const today = dayKey(new Date());
  const initial: CustomRange = isCustom(range) ? range : customRange("day", today);
  const [mode, setMode] = useState<CustomMode>(initial.mode);
  const [a, setA] = useState(initial.from);
  const [b, setB] = useState(initial.to);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    const onDown = (e: MouseEvent) => {
      const t = e.target as Element;
      if (t.closest?.('[data-testid="range-custom"]')) return; // the Custom tab toggles itself
      if (ref.current && !ref.current.contains(t)) onClose();
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onDown);
    };
  }, [onClose]);

  const draft = customRange(mode, a, mode === "range" ? b : undefined);
  const valid = !!a && (mode !== "range" || !!b);
  const step = (dir: -1 | 1) => {
    const next = shiftCustom(draft, dir);
    setA(next.from);
    setB(next.to);
  };
  const weekText =
    mode === "week" && a
      ? `${parseDay(draft.from).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })} – ${parseDay(draft.to).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}`
      : null;

  return (
    <div
      ref={ref}
      role="dialog"
      aria-label="Custom date range"
      data-testid="custom-range"
      className="absolute top-full right-0 left-0 z-30 mt-2 origin-top-right animate-pop rounded-card border border-white/[0.09] bg-surface/95 p-4 backdrop-blur-xl shadow-[inset_0_1px_0_rgb(255_255_255/0.06),0_0_0_5px_rgb(255_236_246/0.03),0_0_0_6px_rgb(255_236_246/0.07),0_30px_60px_-24px_rgb(0_0_0/0.9)] sm:left-auto sm:w-[400px]"
    >
      <div role="tablist" aria-label="Custom range type" className="mb-4 flex gap-1 relative rounded-inner border border-white/[0.06] well p-1">
        <SegThumb />
        {MODES.map((m) => (
          <button key={m.id} type="button" role="tab" aria-selected={mode === m.id} data-testid={`custom-mode-${m.id}`}
            onClick={() => {
              setMode(m.id);
              if (m.id === "range" && b < a) setB(a);
            }}
            className={cn("relative z-[1] h-8 flex-1 rounded-inner px-3 text-sm font-semibold transition-colors", mode === m.id ? "text-white" : "text-ink-muted hover:text-ink")}>
            {m.label}
          </button>
        ))}
      </div>

      {mode === "range" ? (
        <div className="grid grid-cols-2 gap-3">
          <label>
            <span className={label}>From</span>
            <input type="date" data-testid="custom-from" className={input} value={a} max={b || undefined} onChange={(e) => setA(e.target.value)} />
          </label>
          <label>
            <span className={label}>To</span>
            <input type="date" data-testid="custom-to" className={input} value={b} min={a || undefined} onChange={(e) => setB(e.target.value)} />
          </label>
        </div>
      ) : (
        <div>
          <span className={label}>{mode === "day" ? "Day" : "Any day in the week"}</span>
          <div className="flex items-center gap-2">
            <button type="button" aria-label={mode === "day" ? "Previous day" : "Previous week"} onClick={() => valid && step(-1)}
              className="grid size-10 shrink-0 place-items-center rounded-inner border border-line text-ink-muted hover:text-ink">
              <ChevronLeft className="size-4" />
            </button>
            <input type="date" data-testid="custom-day" className={input} value={a} onChange={(e) => setA(e.target.value)} />
            <button type="button" aria-label={mode === "day" ? "Next day" : "Next week"} onClick={() => valid && step(1)}
              className="grid size-10 shrink-0 place-items-center rounded-inner border border-line text-ink-muted hover:text-ink">
              <ChevronRight className="size-4" />
            </button>
          </div>
          {weekText && <p data-testid="custom-week-text" className="mt-2 text-sm text-ink-muted">{weekText}</p>}
        </div>
      )}

      <div className="mt-4 flex items-center justify-between gap-2">
        <button type="button" className="text-sm text-ink-faint underline underline-offset-4 hover:text-ink"
          onClick={() => { setA(today); setB(today); }}>
          Today
        </button>
        <div className="flex gap-2">
          <Button size="sm" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button size="sm" data-testid="custom-apply" disabled={!valid} onClick={() => onApply(draft)}>Apply</Button>
        </div>
      </div>
    </div>
  );
}
