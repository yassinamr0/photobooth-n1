"use client";

import { useEffect, useMemo, useState } from "react";
import { ClipboardCopy } from "lucide-react";
import { PanelFrame } from "@/components/layout/PanelFrame";
import { Spinner } from "@/components/ui/Button";
import { ToastProvider, useToast } from "@/components/ui/Toast";
import { useAuth } from "@/components/auth/AuthProvider";
import { LogoutButton } from "@/components/auth/LogoutButton";
import { authErrorMessage } from "@/lib/auth/errors";
import {
  adjustInkChanges,
  adjustPaperChanges,
  deleteEntry,
  endShift,
  logSale,
  logWaste,
  setStartPaperCount,
  startShift,
  watchActiveShift,
  watchPaperSettings,
  watchShiftEntries,
} from "@/lib/shift/firestore";
import { DEFAULT_SHEETS_PER_PACK } from "@/lib/shift/paper";
import { applyShiftDeduction } from "@/lib/inventory/firestore";
import { aggregate, buildShiftSummaryText } from "@/lib/shift/summary";
import type { Entry, Shift } from "@/lib/shift/types";
import { ShiftCard } from "./ShiftCard";
import { SaleCard } from "./SaleCard";
import { WasteCard } from "./WasteCard";
import { ShiftLog } from "./ShiftLog";
import { EndShiftDialog, StartShiftDialog } from "./ShiftDialogs";
import { SummarySheet } from "./SummarySheet";

export function StaffShiftScreen() {
  return (
    <ToastProvider>
      <ShiftScreenInner />
    </ToastProvider>
  );
}

function ShiftScreenInner() {
  const { profile } = useAuth();
  const toast = useToast();
  const uid = profile?.uid;

  // undefined = still loading
  const [shift, setShift] = useState<Shift | null | undefined>(undefined);
  const [entriesState, setEntriesState] = useState<{ shiftId: string; entries: Entry[] } | null>(null);
  const [sheetsPerPack, setSheetsPerPack] = useState(DEFAULT_SHEETS_PER_PACK);
  const [dialog, setDialog] = useState<"start" | "end" | "summary" | null>(null);
  const [endKey, setEndKey] = useState(0);

  useEffect(() => {
    if (!uid) return;
    return watchActiveShift(uid, setShift, (e) => toast(`Shift sync error: ${authErrorMessage(e)}`, "danger"));
  }, [uid, toast]);

  const shiftId = shift?.id;
  useEffect(() => {
    if (!uid || !shiftId) return;
    return watchShiftEntries(
      uid,
      shiftId,
      (entries) => setEntriesState({ shiftId, entries }),
      (e) => toast(`Log sync error: ${authErrorMessage(e)}`, "danger"),
    );
  }, [uid, shiftId, toast]);

  useEffect(() => watchPaperSettings((s) => setSheetsPerPack(s.sheetsPerPack)), []);

  // Current shift only — never all-time.
  const entries = useMemo(
    () => (shift && entriesState?.shiftId === shift.id ? entriesState.entries : []),
    [shift, entriesState],
  );
  const totals = useMemo(() => aggregate(entries), [entries]);

  if (!profile) return null;

  async function run(action: () => Promise<unknown>, ok: string): Promise<boolean> {
    try {
      await action();
      toast(ok, "success");
      return true;
    } catch (e) {
      toast(`Could not save: ${authErrorMessage(e)}`, "danger");
      return false;
    }
  }

  const firstName = profile.name.split(" ")[0] || "there";

  return (
    <PanelFrame variant="mobile">
      <header className="mb-5 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm text-ink-muted">Booth Log</p>
          <h1 className="truncate font-display text-2xl font-extrabold tracking-tight">Hi, {firstName}</h1>
        </div>
        <LogoutButton />
      </header>

      {shift === undefined ? (
        <div className="grid place-items-center py-24"><Spinner className="size-8 border-[3px] text-magenta" /></div>
      ) : (
        // LOCKED ORDER (SPEC Phase 3) — do not rearrange:
        // 1 Your shift (status bar + summary) · 2 New sale · 3 Waste · 4 This shift · 5 Copy summary
        <div className="flex flex-col gap-4" data-testid="shift-screen">
          <ShiftCard
            shift={shift}
            totals={totals}
            sheetsPerPack={sheetsPerPack}
            onStart={() => setDialog("start")}
            onEnd={() => { setEndKey((k) => k + 1); setDialog("end"); }}
            onPaperChange={async (delta) => {
              if (!shift) return;
              try {
                if (await adjustPaperChanges(shift, delta))
                  toast(delta > 0 ? "Paper change logged" : "Paper change removed", "success");
              } catch (e) {
                toast(`Could not update: ${authErrorMessage(e)}`, "danger");
              }
            }}
            onInkChange={async (delta) => {
              if (!shift) return;
              try {
                if (await adjustInkChanges(shift, delta))
                  toast(delta > 0 ? "Ink change logged" : "Ink change removed", "success");
              } catch (e) {
                toast(`Could not update: ${authErrorMessage(e)}`, "danger");
              }
            }}
            onSetStartPaper={async (n) => {
              if (shift) await run(() => setStartPaperCount(shift.id, n), "Paper loaded updated");
            }}
          />
          {shift && (
            <>
              <SaleCard onLog={(cart, payment, check) => run(() => logSale(profile, shift, cart, payment, check), "Sale logged")} />
              <WasteCard onLog={(hadr, cost) => run(() => logWaste(profile, shift, hadr, cost), "Waste logged")} />
              <ShiftLog entries={entries} onDelete={async (id) => { await run(() => deleteEntry(id), "Entry deleted"); }} />
            </>
          )}
          <button
            type="button"
            onClick={() => setDialog("summary")}
            className="flex h-14 w-full items-center justify-center gap-2 rounded-full border border-line-strong bg-surface text-sm font-semibold text-ink-muted hover:text-ink"
          >
            <ClipboardCopy className="size-4" /> Copy shift summary
          </button>
        </div>
      )}

      <StartShiftDialog
        open={dialog === "start"}
        onClose={() => setDialog(null)}
        onConfirm={async (count) => {
          await startShift(profile, count, sheetsPerPack);
          setDialog(null);
          toast("Shift started", "success");
        }}
      />
      {shift && (
        <EndShiftDialog
          key={endKey}
          shift={shift}
          open={dialog === "end"}
          onClose={() => setDialog(null)}
          onConfirm={async (start, end, left) => {
            // Capture the shift + its entries as they are right now (the listener will clear them).
            const ended = shift;
            const endedEntries = entries;
            await endShift(ended.id, start, end, left);
            setDialog(null);
            toast("Shift ended — nice work", "success");
            // Automatic paper consumption: deduct this shift's actual use (sold + hadr) from the
            // stock of the event THIS SHIFT was stamped with (not the current assignment).
            // Invisible to staff; if it fails, the admin sees it as "not yet deducted".
            if (ended.eventId) {
              applyShiftDeduction(ended, endedEntries, { uid: profile.uid, name: profile.name }).catch((e) =>
                console.warn("[inventory] deduction deferred to admin:", e),
              );
            }
          }}
        />
      )}
      <SummarySheet
        open={dialog === "summary"}
        onClose={() => setDialog(null)}
        text={buildShiftSummaryText(profile.name, shift ?? null, entries)}
        onCopied={(ok) => toast(ok ? "Copied!" : "Could not copy", ok ? "success" : "danger")}
      />
    </PanelFrame>
  );
}
