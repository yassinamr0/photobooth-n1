"use client";

import { useState } from "react";
import { AlertTriangle, Banknote, CheckCircle2, ChevronDown, Coins, CreditCard, Frame, Layers, Magnet, MapPin, Package, Trash2 } from "lucide-react";
import { useAuth } from "@/components/auth/AuthProvider";
import { applyShiftDeduction } from "@/lib/inventory/firestore";
import { describeDeduction } from "@/lib/inventory/units";
import { useScopedInventory } from "./DashboardData";
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
import { fmtNum, formatEGP } from "@/lib/format";

export function MismatchIcon({ title = "Paper count mismatch" }: { title?: string }) {
  return (
    <span data-testid="mismatch-icon" title={title} className="inline-grid size-6 place-items-center rounded-inner bg-warning-dim text-warning">
      <AlertTriangle className="size-3.5" aria-label={title} />
    </span>
  );
}

/** The 7 stats (TOTAL · CASH · VISA · SHEETS · HADR · ACRYLIC · MAGNETIC). */
// Tile tints carry the fixed meanings: gold total, green cash, blue visa, pink hadr; counts
// stay neutral. Each tile is a ~6% wash of its colour + matching hairline (taste: bento
// background diversity), with a light-catch top edge.
const TONES = {
  gold: { text: "text-gold", tile: "bg-gold/[0.06] border-gold/20" },
  cash: { text: "text-success", tile: "bg-success/[0.06] border-success/20" },
  visa: { text: "text-info", tile: "bg-info/[0.06] border-info/20" },
  hadr: { text: "text-pink", tile: "bg-pink/[0.06] border-pink/20" },
  ink: { text: "text-ink", tile: "bg-white/[0.025] border-white/[0.07]" },
} as const;

export function StatGrid({ totals, size = "sm" }: { totals: ShiftTotals; size?: "sm" | "lg" }) {
  const cells: { label: string; v: number; tone: keyof typeof TONES; icon: React.ReactNode; span: string }[] = [
    { label: "Total EGP", v: totals.total, tone: "gold", icon: <Coins />, span: "col-span-2 sm:row-span-2" },
    { label: "Cash", v: totals.cash, tone: "cash", icon: <Banknote />, span: "sm:col-span-2" },
    { label: "Visa", v: totals.visa, tone: "visa", icon: <CreditCard />, span: "sm:col-span-2" },
    { label: "Sheets sold", v: totals.sheets, tone: "ink", icon: <Layers />, span: "" },
    { label: "Hadr wasted", v: totals.hadr, tone: "hadr", icon: <Trash2 />, span: "" },
    { label: "Acrylic", v: totals.acrylic, tone: "ink", icon: <Frame />, span: "" },
    { label: "Magnetic", v: totals.magnetic, tone: "ink", icon: <Magnet />, span: "" },
  ];
  const lg = size === "lg";
  const paid = totals.cash + totals.visa;
  return (
    <div className={cn("develop-stagger grid gap-2.5", lg ? "grid-cols-2 sm:grid-cols-4 xl:grid-cols-6" : "grid-cols-4 sm:grid-cols-7 lg:grid-cols-4 2xl:grid-cols-7")}>
      {cells.map(({ label, v, tone, icon, span }, i) => {
        const hero = lg && i === 0;
        return (
          <div
            key={label}
            className={cn(
              "relative flex flex-col overflow-hidden rounded-[8px] border shadow-[inset_0_1px_0_rgb(255_255_255/0.05)]",
              TONES[tone].tile,
              lg ? "px-4 py-3.5" : "px-3 py-2",
              lg && span,
              hero && "justify-between gap-4 py-4",
            )}
          >
            {lg && (
              <div className="mb-2 flex items-center justify-between gap-2">
                <span className="text-[13px] font-medium text-ink-muted">{label}</span>
                <span aria-hidden className={cn("opacity-80 [&_svg]:size-4", TONES[tone].text)}>{icon}</span>
              </div>
            )}
            <div
              data-testid={`stat-${label.split(" ")[0].toLowerCase()}`}
              className={cn(
                "font-display font-bold tracking-[-0.03em] tabular-nums leading-none",
                hero ? "text-[2.8rem] sm:text-[3.25rem]" : lg ? "text-[1.7rem]" : "text-[1.15rem]",
                TONES[tone].text,
              )}
            >
              {fmtNum(v)}
            </div>
            {!lg && <div className="mt-1.5 text-[12.5px] font-medium text-ink-muted">{label}</div>}
            {hero && (
              // Cash vs Visa split of the total (decorative; the exact numbers sit beside it).
              <div aria-hidden className="flex h-1.5 w-full gap-[2px] overflow-hidden rounded-full bg-white/[0.05]"
                title={paid ? `Cash ${Math.round((totals.cash / paid) * 100)}% · Visa ${Math.round((totals.visa / paid) * 100)}%` : undefined}>
                {paid > 0 && (
                  <>
                    <span className="h-full rounded-full bg-success" style={{ width: `${(totals.cash / paid) * 100}%` }} />
                    <span className="h-full rounded-full bg-info" style={{ width: `${(totals.visa / paid) * 100}%` }} />
                  </>
                )}
              </div>
            )}
          </div>
        );
      })}
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

const COLS = (showEvent: boolean) =>
  showEvent
    ? "lg:grid lg:grid-cols-[150px_minmax(0,1.2fr)_minmax(0,1fr)_80px_110px_120px_110px_20px] lg:gap-4"
    : "lg:grid lg:grid-cols-[150px_minmax(0,1.2fr)_80px_110px_120px_110px_20px] lg:gap-4";

/** Column headings over the desktop shift rows. */
export function ShiftColumnsHeader({ showEvent }: { showEvent: boolean }) {
  return (
    <div className={cn("hidden px-4 pt-1 text-[11px] font-medium tracking-wide text-ink-faint uppercase", COLS(showEvent))}>
      <span>Time</span>
      <span>Staff</span>
      {showEvent && <span>Event</span>}
      <span>Duration</span>
      <span className="text-right">Revenue</span>
      <span>Paper</span>
      <span>Stock</span>
      <span />
    </div>
  );
}

function paperShort(s: ScopedShift): { text: string; tone: string } {
  const r = s.recon;
  if (!r) return { text: s.shift.endTime ? "No counts" : "—", tone: "text-ink-faint" };
  if (r.warn) return { text: "Mismatch", tone: "text-warning" };
  if (r.mismatch) return { text: "Checked ✓", tone: "text-success" };
  return { text: "Matches", tone: "text-success" };
}

function stockShort(s: ScopedShift, pendingIds: Set<string>): { text: string; tone: string } {
  const { shift } = s;
  if (shift.stockExempt) return { text: "Exempt", tone: "text-ink-faint" };
  if (shift.stockDeduction) return { text: "Deducted", tone: "text-ink-muted" };
  if (!shift.eventId) return { text: "No event", tone: "text-ink-faint" };
  if (!shift.endTime) return { text: "At shift end", tone: "text-ink-faint" };
  if (pendingIds.has(shift.id)) return { text: "Pending", tone: "text-warning" };
  return { text: "Not tracked", tone: "text-ink-faint" };
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
  const { pending } = useScopedInventory();
  const { shift } = s;
  const dur = shift.endTime ? fmtDuration(new Date(shift.endTime).getTime() - new Date(shift.startTime).getTime()) : "ongoing";
  const date = showDate
    ? new Date(shift.startTime).toLocaleDateString(undefined, { month: "short", day: "numeric" }) + " · "
    : "";
  const paper = paperShort(s);
  const stock = stockShort(s, new Set(pending.map((p) => p.id)));
  return (
    <div data-testid="shift-row" className="rounded-inner border border-line bg-surface">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className={cn("flex w-full items-center gap-3 px-4 py-3 text-left lg:items-center", COLS(showEvent))}
      >
        {/* phones: stacked summary (unchanged) */}
        <div className="min-w-0 flex-1 lg:hidden">
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
        {/* desktop: columns */}
        <span className="hidden text-sm font-semibold whitespace-nowrap text-ink tabular-nums lg:block">
          {date}
          {fmtTime(shift.startTime)} → {shift.endTime ? fmtTime(shift.endTime) : "now"}
        </span>
        <span className="hidden min-w-0 items-center gap-2 text-sm text-ink lg:flex">
          <span className="truncate">{s.staffName}</span>
          {!shift.endTime && <Tag tone="success" dot>Live</Tag>}
        </span>
        {showEvent && (
          <span data-testid="event-label-desktop" className="hidden min-w-0 items-center gap-1 truncate text-sm text-ink-muted lg:flex">
            <MapPin className="size-3.5 shrink-0 text-ink-faint" /> <span className="truncate">{s.eventName ?? "No event"}</span>
          </span>
        )}
        <span className="hidden text-sm text-ink-muted lg:block">{dur}</span>
        <span className="text-sm font-semibold whitespace-nowrap text-gold tabular-nums lg:text-right">{formatEGP(s.totals.total)}</span>
        <span className={cn("hidden items-center gap-1.5 text-sm lg:flex", paper.tone)}>
          {s.recon?.warn && <AlertTriangle className="size-3.5" />}{paper.text}
        </span>
        <span className={cn("hidden text-sm lg:block", stock.tone)}>{stock.text}</span>
        <span className="hidden text-xs text-ink-faint sm:inline lg:hidden">{dur}</span>
        {!shift.endTime && <span className="lg:hidden"><Tag tone="success" dot>Live</Tag></span>}
        <ChevronDown className={cn("size-4 shrink-0 text-ink-faint transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <div className="grid animate-develop gap-3 border-t border-line px-4 py-4 lg:grid-cols-2 lg:gap-4">
          <div className="flex flex-col gap-3">
            <StatGrid totals={s.totals} />
            <PaperBlock s={s} readOnly={readOnly} />
          </div>
          <div className="flex flex-col gap-3">
            <StockStatus s={s} readOnly={readOnly} />
            {!readOnly && <DeleteShift s={s} />}
          </div>
        </div>
      )}
    </div>
  );
}

/** Whether/where this shift's paper use hit inventory (always the SHIFT'S own event). */
export function StockStatus({ s, readOnly }: { s: ScopedShift; readOnly?: boolean }) {
  const toast = useToast();
  const { profile } = useAuth();
  const { pending, entries } = useScopedInventory();
  const [busy, setBusy] = useState(false);
  const { shift } = s;
  const d = shift.stockDeduction;
  let text: React.ReactNode;
  let action: React.ReactNode = null;
  if (shift.stockExempt) {
    text = `Tagged with ${s.eventName ?? "an event"} by an admin later — doesn't affect inventory`;
  } else if (d) {
    text = (
      <>
        Deducted <b className="text-ink">{describeDeduction(d)}</b> from {s.eventName ?? "its event"}&apos;s stock
      </>
    );
  } else if (!shift.eventId) {
    text = shift.endTime ? "No event — this shift doesn't affect any location's inventory" : "No event — won't affect any location's inventory";
  } else if (!shift.endTime) {
    text = `Paper used, frames sold${shift.inkChanges ? ` and ${shift.inkChanges} ink cartridge(s)` : ""} will be deducted from ${s.eventName}'s stock when the shift ends`;
  } else if (pending.some((p) => p.id === shift.id)) {
    text = <span className="text-warning">Not yet deducted from {s.eventName}&apos;s stock</span>;
    if (!readOnly && profile)
      action = (
        <Button size="sm" variant="secondary" loading={busy}
          onClick={async () => {
            setBusy(true);
            try {
              const n = await applyShiftDeduction(shift, entries, { uid: profile.uid, name: profile.name });
              toast(n ? `Deducted ${describeDeduction(n)} from ${s.eventName}` : "Nothing to deduct", "success");
            } catch (e) {
              toast(`Could not deduct: ${authErrorMessage(e)}`, "danger");
            } finally {
              setBusy(false);
            }
          }}>
          Apply now
        </Button>
      );
  } else {
    text = "Ended before inventory tracking started for this event — not deducted";
  }
  return (
    <>
    <div data-testid="stock-status" className="flex flex-wrap items-center gap-2 rounded-inner bg-surface-2 px-4 py-2.5 text-sm text-ink-muted">
      <Package className="size-4 shrink-0 text-ink-faint" />
      <span className="flex-1">{text}</span>
      {action}
    </div>
    <p data-testid="ink-changes-admin" className="-mt-1 px-1 text-xs text-ink-faint">
      Ink changed during this shift: {fmtNum(shift.inkChanges || 0)}× (1 = one cartridge)
    </p>
    </>
  );
}

const hasAnyDeduction = (d: NonNullable<ScopedShift["shift"]["stockDeduction"]>) =>
  d.sheets > 0 || d.cartridges > 0 || d.acrylic > 0 || d.magnetic > 0;

function DeleteShift({ s }: { s: ScopedShift }) {
  const toast = useToast();
  const { profile } = useAuth();
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
        {s.shift.stockDeduction && hasAnyDeduction(s.shift.stockDeduction) && (
          <span className="mt-1 block font-normal">
            The {describeDeduction(s.shift.stockDeduction)} it deducted will be put back into {s.eventName ?? "its event"}&apos;s stock.
          </span>
        )}
      </p>
      <div className="mt-3 flex gap-2">
        <Button size="sm" variant="secondary" onClick={() => setConfirming(false)} disabled={busy}>Cancel</Button>
        <Button size="sm" variant="danger" loading={busy}
          onClick={async () => {
            setBusy(true);
            try {
              await deleteShiftAndEntries(s.shift, s.entries.map((e) => e.id), { uid: profile?.uid ?? "", name: profile?.name ?? "" });
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
