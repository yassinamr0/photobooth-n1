"use client";

import { useState, type FormEvent } from "react";
import { Sheet } from "@/components/ui/Sheet";
import { Button } from "@/components/ui/Button";
import { FormError } from "@/components/ui/Field";
import { authErrorMessage } from "@/lib/auth/errors";
import { fmtDuration, isHHMM, resolveShiftTimes, toHHMM } from "@/lib/shift/time";
import type { Shift } from "@/lib/shift/types";
import { NumberInput } from "./Stepper";

const isWholeNonNeg = (n: number | null): n is number => n !== null && Number.isInteger(n) && n >= 0;

function Label({ htmlFor, children }: { htmlFor: string; children: React.ReactNode }) {
  return (
    <label htmlFor={htmlFor} className="mb-1.5 block text-xs font-medium tracking-wide text-ink-faint uppercase">
      {children}
    </label>
  );
}

/** Start shift: the loaded sheet count is REQUIRED before the shift doc is created. */
export function StartShiftDialog({
  open,
  onClose,
  onConfirm,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: (startPaperCount: number) => Promise<void>;
}) {
  const [count, setCount] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!isWholeNonNeg(count)) return setError("Enter how many sheets are in the printer (a whole number).");
    setBusy(true);
    setError(null);
    try {
      await onConfirm(count);
      setCount(null);
    } catch (err) {
      setError(`Could not start shift: ${authErrorMessage(err)}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet open={open} onClose={onClose} title="Start shift" labelledBy="start-shift-title">
      <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
        <div>
          <Label htmlFor="start-paper">How many sheets are currently loaded in the printer?</Label>
          <NumberInput id="start-paper" value={count} onChange={(v) => { setCount(v); setError(null); }} inputMode="numeric" step={1} autoFocus placeholder="e.g. 18" />
        </div>
        <FormError>{error}</FormError>
        <div className="flex gap-3">
          <Button variant="secondary" size="lg" className="flex-1" onClick={onClose}>Cancel</Button>
          <Button type="submit" size="lg" className="flex-1" loading={busy}>Start shift</Button>
        </div>
      </form>
    </Sheet>
  );
}

/**
 * End shift: actual start (defaults to stored start), actual end (defaults to now), and
 * sheets left (REQUIRED). If end < start the shift crossed midnight → end + 24h.
 */
export function EndShiftDialog({
  shift,
  open,
  onClose,
  onConfirm,
}: {
  shift: Shift;
  open: boolean;
  onClose: () => void;
  onConfirm: (start: Date, end: Date, endPaperCount: number) => Promise<void>;
}) {
  // Parent remounts this component (via key) each time it opens, so defaults are fresh.
  const [startHHMM, setStartHHMM] = useState(() => toHHMM(new Date(shift.startTime)));
  const [endHHMM, setEndHHMM] = useState(() => toHHMM(new Date()));
  const [left, setLeft] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const timesOk = isHHMM(startHHMM) && isHHMM(endHHMM);
  const preview = timesOk ? resolveShiftTimes(shift.startTime, startHHMM, endHHMM) : null;

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!preview) return setError("Enter both times.");
    if (!isWholeNonNeg(left)) return setError("Enter how many sheets are left in the printer (a whole number).");
    setBusy(true);
    setError(null);
    try {
      await onConfirm(preview.start, preview.end, left);
    } catch (err) {
      setError(`Could not end shift: ${authErrorMessage(err)}`);
      setBusy(false);
    }
  }

  const timeInput =
    "h-12 w-full rounded-inner border border-white/[0.06] well px-4 text-lg font-semibold tabular-nums text-ink outline-none focus:border-magenta/70 focus:ring-2 focus:ring-magenta/25 [color-scheme:dark]";

  return (
    <Sheet open={open} onClose={onClose} title="End shift" labelledBy="end-shift-title">
      <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="end-start">Actual start</Label>
            <input id="end-start" type="time" value={startHHMM} onChange={(e) => setStartHHMM(e.target.value)} className={timeInput} />
          </div>
          <div>
            <Label htmlFor="end-end">Actual end</Label>
            <input id="end-end" type="time" value={endHHMM} onChange={(e) => setEndHHMM(e.target.value)} className={timeInput} />
          </div>
        </div>
        {preview && (
          <p data-testid="shift-length" className="rounded-inner bg-surface-2 px-4 py-2.5 text-sm text-ink-muted">
            Shift length: <span className="font-semibold text-ink">{fmtDuration(preview.durationMs)}</span>
            {preview.crossesMidnight && <span className="text-warning"> · ends next day</span>}
          </p>
        )}
        <div>
          <Label htmlFor="end-paper">Sheets left in the printer</Label>
          <NumberInput id="end-paper" value={left} onChange={(v) => { setLeft(v); setError(null); }} inputMode="numeric" step={1} placeholder="e.g. 7" />
        </div>
        <FormError>{error}</FormError>
        <div className="flex gap-3">
          <Button variant="secondary" size="lg" className="flex-1" onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="danger" size="lg" className="flex-1" loading={busy}>End shift</Button>
        </div>
      </form>
    </Sheet>
  );
}
