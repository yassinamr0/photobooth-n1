import { Minus, Plus } from "lucide-react";
import { cn } from "@/lib/cn";

/** Big −/+ stepper with the value in the middle (sheets / hadr, 0.5 steps). */
export function Stepper({
  value,
  unit,
  onStep,
  step = 0.5,
  label,
  tone = "accent",
}: {
  value: number;
  unit: string;
  onStep: (delta: number) => void;
  step?: number;
  label: string;
  tone?: "accent" | "pink";
}) {
  const btn =
    "grid size-14 shrink-0 place-items-center key rounded-inner border border-white/[0.08] bg-surface-2 text-ink " +
    "active:scale-95 transition-transform disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-magenta/60";
  return (
    <div className="flex items-center gap-3" role="group" aria-label={label}>
      <button type="button" className={btn} aria-label={`Decrease ${label}`} onClick={() => onStep(-step)} disabled={value <= 0}>
        <Minus className="size-5" />
      </button>
      <div className="flex-1 text-center" aria-live="polite">
        <span
          data-testid={`${label}-qty`}
          className={cn(
            "font-display text-4xl font-extrabold tabular-nums",
            tone === "pink" ? "text-pink" : "text-ink",
          )}
        >
          {value}
        </span>
        <span className="ml-1.5 text-sm text-ink-muted">{unit}</span>
      </div>
      <button type="button" className={btn} aria-label={`Increase ${label}`} onClick={() => onStep(step)}>
        <Plus className="size-5" />
      </button>
    </div>
  );
}

/** Small rounded preset/quick-fill chip. */
export function Chip({
  children,
  onClick,
  active,
}: {
  children: React.ReactNode;
  onClick: () => void;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "h-9 rounded-inner border px-3.5 text-sm font-semibold transition-colors",
        active ? "key-primary border-transparent bg-maroon text-white" : "border-line text-ink-muted hover:border-line-strong hover:text-ink",
      )}
    >
      {children}
    </button>
  );
}

/** Numeric text input tuned for mobile keypads. Empty string → null. */
export function NumberInput({
  id,
  value,
  onChange,
  className,
  tone,
  ...rest
}: {
  id: string;
  value: number | null;
  onChange: (v: number | null) => void;
  className?: string;
  tone?: "cash" | "visa" | "pink";
} & Omit<React.ComponentProps<"input">, "value" | "onChange" | "id">) {
  return (
    <input
      id={id}
      type="number"
      inputMode="decimal"
      min={0}
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))}
      onFocus={(e) => e.target.select()}
      className={cn(
        "h-12 w-full rounded-inner border border-white/[0.06] well px-4 text-lg font-semibold tabular-nums text-ink outline-none",
        "focus:border-magenta/70 focus:ring-2 focus:ring-magenta/25",
        tone === "cash" && "text-success",
        tone === "visa" && "text-info",
        tone === "pink" && "text-pink",
        className,
      )}
      {...rest}
    />
  );
}
