"use client";

import { useState } from "react";
import { AlertTriangle, CheckCircle2, ChevronDown, MapPin, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Tag } from "@/components/ui/Tag";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/cn";
import { authErrorMessage } from "@/lib/auth/errors";
import { deleteShiftAndEntries, setPaperVerified } from "@/lib/admin/firestore";
import type { ScopedShift } from "@/lib/admin/scope";
import { describeReconciliation } from "@/lib/shift/paper";
import { fmtTime, type ShiftTotals } from "@/lib/shift/summary";
import { fmtDuration } from "@/lib/shift/time";

export function MismatchIcon({ title = "Paper count mismatch" }: { title?: string }) {
  return (
    <span data-testid="mismatch-icon" title={title} className="inline-grid size-6 place-items-center rounded-full bg-warning-dim text-warning">
      <AlertTriangle className="size-3.5" aria-label={title} />
    </span>
  );
}

/** The 7 stats (TOTAL · CASH · VISA · SHEETS · HADR · ACRYLIC · MAGNETIC). */
export function StatGrid({ totals, size = "sm" }: { totals: ShiftTotals; size?: "sm" | "lg" }) {
  const cells: [string, number, string?][] = [
    ["Total EGP", totals.total, "text-gold"],
    ["Cash", totals.cash, "text-success"],
    ["Visa", totals.visa, "text-info"],
    ["Sheets sold", totals.sheets],
    ["Hadr wasted", totals.hadr, "text-pink"],
    ["Acrylic", totals.acrylic],
    ["Magnetic", totals.magnetic],
  ];
  return (
    <div className={cn("grid gap-2", size === "lg" ? "grid-cols-2 sm:grid-cols-4 xl:grid-cols-7" : "grid-cols-4 sm:grid-cols-7")}>
      {cells.map(([label, v, color], i) => (
        <div
          key={label}
          className={cn(
            "rounded-inner border border-line bg-surface-2 px-3",
            size === "lg" ? "py-4" : "py-2",
            size === "lg" && i === 0 && "col-span-2 border-gold/30 bg-gold-dim/40 sm:col-span-2 xl:col-span-1",
          )}
        >
          <div
            data-testid={`stat-${label.split(" ")[0].toLowerCase()}`}
            className={cn("font-display font-bold tabular-nums", size === "lg" ? "text-2xl" : "text-base", color)}
          >
            {v}
          </div>
          <div className="text-[11px] text-ink-faint">{label}</div>
        </div>
      ))}
    </div>
  );
}

/** Paper reconciliation block for an expanded shift. */
export function PaperBlock({ s, readOnly }: { s: ScopedShift; readOnly?: boolean }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const r = s.recon;
  if (!r) {
    return (
      <p className="rounded-inner bg-surface-2 px-4 py-3 text-sm text-ink-faint">
        Paper check: {s.shift.endTime ? "no start/end paper count recorded for this shift" : "available once the shift ends"}.
      </p>
    );
  }
  const text = describeReconciliation(s.shift, r);
  async function toggle(verified: boolean) {
    setBusy(true);
    try {
      await setPaperVerified(s.shift.id, verified);
      toast(verified ? "Marked as checked" : "Unmarked", "success");
    } catch (e) {
      toast(`Could not update: ${authErrorMessage(e)}`, "danger");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div
      data-testid="paper-block"
      className={cn(
        "rounded-inner border px-4 py-3 text-sm leading-relaxed",
        r.warn ? "border-warning/40 bg-warning-dim/60 text-ink" : "border-line bg-surface-2 text-ink-muted",
      )}
    >
      <p>{text.printer}</p>
      <p>{text.logged}</p>
      <p className={cn("mt-1 font-semibold", r.warn ? "text-warning" : r.mismatch ? "text-ink-muted" : "text-success")}>
        {r.warn && <AlertTriangle className="mr-1.5 inline size-4 -translate-y-px" />}
        {text.status}
        <span className="ml-1.5 text-xs font-normal text-ink-faint">· 1 pack = {r.packSize} sheets</span>
      </p>
      {r.mismatch && (
        <div className="mt-2 flex flex-wrap items-center gap-3">
          {r.warn ? (
            !readOnly && (
              <Button size="sm" variant="secondary" loading={busy} leftIcon={<CheckCircle2 className="size-4" />} onClick={() => toggle(true)}>
                Mark as checked
              </Button>
            )
          ) : (
            <>
              <span className="text-success">Checked off by admin ✓</span>
              {!readOnly && (
                <button type="button" disabled={busy} onClick={() => toggle(false)} className="text-ink-muted underline underline-offset-4 hover:text-ink">
                  Unmark
                </button>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

/** One shift: collapsed row (+ ⚠ even when collapsed) → expanded stats, paper check, delete. */
export function ShiftRow({
  s,
  showEvent,
  showDate,
  readOnly,
}: {
  s: ScopedShift;
  showEvent: boolean;
  showDate?: boolean;
  readOnly?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const { shift } = s;
  const dur = shift.endTime ? fmtDuration(new Date(shift.endTime).getTime() - new Date(shift.startTime).getTime()) : "ongoing";
  const date = showDate
    ? new Date(shift.startTime).toLocaleDateString(undefined, { month: "short", day: "numeric" }) + " · "
    : "";
  return (
    <div data-testid="shift-row" className="rounded-inner border border-line bg-surface">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-3 px-4 py-3 text-left"
      >
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold text-ink tabular-nums">
              {date}
              {fmtTime(shift.startTime)} → {shift.endTime ? fmtTime(shift.endTime) : "now"}
            </span>
            <span className="truncate text-sm text-ink-muted">{s.staffName}</span>
            {s.recon?.warn && <MismatchIcon />}
          </div>
          {showEvent && (
            <span data-testid="event-label" className="mt-1 inline-flex items-center gap-1 text-[11px] text-ink-faint">
              <MapPin className="size-3" /> {s.eventName ?? "No event"}
            </span>
          )}
        </div>
        <span className="text-sm font-semibold text-gold tabular-nums">{s.totals.total} EGP</span>
        <span className="hidden text-xs text-ink-faint sm:inline">{dur}</span>
        {!shift.endTime && <Tag tone="success" dot>Live</Tag>}
        <ChevronDown className={cn("size-4 shrink-0 text-ink-faint transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <div className="flex flex-col gap-3 border-t border-line px-4 py-4">
          <StatGrid totals={s.totals} />
          <PaperBlock s={s} readOnly={readOnly} />
          {!readOnly && <DeleteShift s={s} />}
        </div>
      )}
    </div>
  );
}

function DeleteShift({ s }: { s: ScopedShift }) {
  const toast = useToast();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const n = s.entries.length;
  if (!confirming) {
    return (
      <button type="button" onClick={() => setConfirming(true)}
        className="flex items-center gap-1.5 self-start text-sm text-danger/80 hover:text-danger">
        <Trash2 className="size-4" /> Delete this shift
      </button>
    );
  }
  return (
    <div role="alertdialog" aria-label="Confirm delete shift" className="rounded-inner border border-danger/40 bg-danger-dim px-4 py-3">
      <p className="text-sm font-semibold text-danger">
        Delete this shift and its {n} {n === 1 ? "entry" : "entries"}? This can&apos;t be undone.
      </p>
      <div className="mt-3 flex gap-2">
        <Button size="sm" variant="secondary" onClick={() => setConfirming(false)} disabled={busy}>Cancel</Button>
        <Button size="sm" variant="danger" loading={busy}
          onClick={async () => {
            setBusy(true);
            try {
              await deleteShiftAndEntries(s.shift.id, s.entries.map((e) => e.id));
              toast("Shift deleted", "success");
            } catch (e) {
              toast(`Could not delete: ${authErrorMessage(e)}`, "danger");
              setBusy(false);
            }
          }}>
          Delete permanently
        </Button>
      </div>
    </div>
  );
}
