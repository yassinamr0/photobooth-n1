"use client";

import { useState } from "react";
import { Check, Droplet, Minus, Pencil, Play, Plus, Square } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { ActionButton } from "@/components/ui/ActionButton";
import { cn } from "@/lib/cn";
import { fmtTime } from "@/lib/shift/summary";
import type { ShiftTotals } from "@/lib/shift/summary";
import type { Shift } from "@/lib/shift/types";
import { NumberInput } from "./Stepper";
import { fmtNum } from "@/lib/format";

/**
 * LOCKED card #1 — "Your shift": status bar (start time · paper loaded · pack counter ·
 * End shift) DIRECTLY followed by the current-shift summary grid, all in this one card.
 */
export function ShiftCard({
  shift,
  totals,
  sheetsPerPack,
  onStart,
  onEnd,
  onPaperChange,
  onInkChange,
  onSetStartPaper,
}: {
  shift: Shift | null;
  totals: ShiftTotals;
  sheetsPerPack: number;
  onStart: () => void;
  onEnd: () => void;
  onPaperChange: (delta: 1 | -1) => void;
  onInkChange: (delta: 1 | -1) => void;
  onSetStartPaper: (n: number) => Promise<void>;
}) {
  return (
    <Card padding="md" data-testid="card-your-shift">
      <h2 className="mb-4 font-display text-lg font-bold">Your shift</h2>
      {!shift ? (
        <ActionButton icon={<Play />} sublabel="You'll be asked how much paper is loaded" onClick={onStart}>
          Start shift
        </ActionButton>
      ) : (
        <>
          <StatusBar
            shift={shift}
            sheetsPerPack={sheetsPerPack}
            onEnd={onEnd}
            onPaperChange={onPaperChange}
            onInkChange={onInkChange}
            onSetStartPaper={onSetStartPaper}
          />
          <SummaryGrid totals={totals} />
        </>
      )}
    </Card>
  );
}

function Cell({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <div className="text-[11px] font-medium tracking-wide text-ink-faint uppercase">{label}</div>
      <div className="mt-0.5 font-display text-lg font-bold whitespace-nowrap tabular-nums">{children}</div>
    </div>
  );
}

function StatusBar({
  shift,
  sheetsPerPack,
  onEnd,
  onPaperChange,
  onInkChange,
  onSetStartPaper,
}: {
  shift: Shift;
  sheetsPerPack: number;
  onEnd: () => void;
  onPaperChange: (delta: 1 | -1) => void;
  onInkChange: (delta: 1 | -1) => void;
  onSetStartPaper: (n: number) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const draftOk = draft !== null && Number.isInteger(draft) && draft >= 0;

  async function save() {
    if (!draftOk) return;
    setSaving(true);
    try {
      await onSetStartPaper(draft);
      setEditing(false);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-4 rounded-inner border border-line bg-canvas/50 p-4" data-testid="shift-status-bar">
      <div className="grid grid-cols-3 gap-3">
        <Cell label="Started">{fmtTime(shift.startTime)}</Cell>
        <div className="min-w-0">
          <div className="text-[11px] font-medium tracking-wide text-ink-faint uppercase">Paper loaded</div>
          {editing ? (
            <div className="mt-1 flex items-center gap-1.5">
              <NumberInput id="edit-start-paper" value={draft} onChange={setDraft} inputMode="numeric"
                className="h-9 px-2 text-base" autoFocus onKeyDown={(e) => e.key === "Enter" && save()} />
              <button type="button" aria-label="Save paper loaded" onClick={save} disabled={!draftOk || saving}
                className="grid size-9 shrink-0 place-items-center rounded-inner bg-success-dim text-success disabled:opacity-40">
                <Check className="size-4" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              data-testid="paper-loaded"
              onClick={() => { setDraft(shift.startPaperCount); setEditing(true); }}
              className="mt-0.5 flex items-center gap-1.5 font-display text-lg font-bold tabular-nums hover:text-magenta"
            >
              {shift.startPaperCount != null ? fmtNum(shift.startPaperCount) : "—"}
              <Pencil className="size-3.5 text-ink-faint" aria-label="Edit" />
            </button>
          )}
        </div>
        <Cell label="Packs changed">
          <span data-testid="paper-changes">{shift.paperChanges}×</span>
        </Cell>
      </div>

      {/* Pack counter: +1 per PACK (sheetsPerPack sheets) — never a box. − undoes a mis-tap. */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          aria-label="Remove one paper change"
          onClick={() => onPaperChange(-1)}
          disabled={shift.paperChanges <= 0}
          className="grid size-12 shrink-0 place-items-center rounded-inner border border-line-strong bg-surface-2 text-ink active:scale-95 disabled:opacity-40"
        >
          <Minus className="size-5" />
        </button>
        <button
          type="button"
          onClick={() => onPaperChange(1)}
          className="flex h-12 flex-1 items-center justify-center gap-2 rounded-inner border border-line-strong bg-surface-2 text-ink active:scale-[0.98]"
        >
          <Plus className="size-4 shrink-0" />
          <span className="flex flex-col items-start leading-tight">
            <span className="font-semibold whitespace-nowrap">Paper change</span>
            <span className="text-[11px] whitespace-nowrap text-ink-faint">1 pack = {sheetsPerPack} sheets</span>
          </span>
        </button>
      </div>

      {/* Ink counter: +1 per CARTRIDGE swapped in. − undoes a mis-tap. Deducted from this
          shift's event's ink stock when the shift ends. */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          aria-label="Remove one ink change"
          onClick={() => onInkChange(-1)}
          disabled={(shift.inkChanges || 0) <= 0}
          className="grid size-12 shrink-0 place-items-center rounded-inner border border-line-strong bg-surface-2 text-ink active:scale-95 disabled:opacity-40"
        >
          <Minus className="size-5" />
        </button>
        <button
          type="button"
          onClick={() => onInkChange(1)}
          className="flex h-12 flex-1 items-center justify-center gap-2 rounded-inner border border-line-strong bg-surface-2 text-ink active:scale-[0.98]"
        >
          <Droplet className="size-4 shrink-0" />
          <span className="flex flex-col items-start leading-tight">
            <span className="font-semibold whitespace-nowrap">Ink change</span>
            <span className="text-[11px] whitespace-nowrap text-ink-faint">1 tap = 1 cartridge</span>
          </span>
        </button>
        <span data-testid="ink-changes" className="w-10 shrink-0 text-center font-display text-lg font-bold tabular-nums">
          {shift.inkChanges || 0}×
        </span>
      </div>

      <Button variant="danger" size="lg" className="w-full" leftIcon={<Square className="size-4" />} onClick={onEnd}>
        End shift
      </Button>
    </div>
  );
}

function SummaryGrid({ totals }: { totals: ShiftTotals }) {
  const cell = "rounded-inner border border-line border-t-[3px] border-t-line-strong bg-surface-2 px-3 py-2.5";
  const v = "font-display text-[1.6rem] leading-none font-semibold tracking-[-0.01em] tabular-nums";
  const l = "mt-1 font-display text-[13px] font-medium tracking-[0.07em] text-ink-muted uppercase";
  return (
    <div className="mt-3 grid grid-cols-2 gap-2" data-testid="shift-summary-grid">
      <div className={cn(cell, "col-span-2 flex items-baseline justify-between border-t-gold bg-gold-dim/50")}>
        <span className={l}>Total EGP</span>
        <span data-testid="sum-total" className={cn(v, "text-[2.2rem] text-gold")}>{fmtNum(totals.total)}</span>
      </div>
      <div className={cn(cell, "border-t-success")}><div data-testid="sum-cash" className={cn(v, "text-success")}>{fmtNum(totals.cash)}</div><div className={l}>Cash</div></div>
      <div className={cn(cell, "border-t-info")}><div data-testid="sum-visa" className={cn(v, "text-info")}>{fmtNum(totals.visa)}</div><div className={l}>Visa</div></div>
      <div className={cell}><div data-testid="sum-sheets" className={v}>{fmtNum(totals.sheets)}</div><div className={l}>Sheets sold</div></div>
      <div className={cn(cell, "border-t-pink")}><div data-testid="sum-hadr" className={cn(v, "text-pink")}>{fmtNum(totals.hadr)}</div><div className={l}>Hadr wasted</div></div>
      <div className={cell}><div data-testid="sum-acrylic" className={v}>{fmtNum(totals.acrylic)}</div><div className={l}>Acrylic sold</div></div>
      <div className={cell}><div data-testid="sum-magnetic" className={v}>{fmtNum(totals.magnetic)}</div><div className={l}>Magnetic sold</div></div>
    </div>
  );
}
