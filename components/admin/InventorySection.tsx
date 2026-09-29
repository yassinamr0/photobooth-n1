"use client";

import { useState } from "react";
import { AlertTriangle, Droplet, FileStack, Info, Settings2 } from "lucide-react";
import { Card, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Tag } from "@/components/ui/Tag";
import { FormError } from "@/components/ui/Field";
import { useToast } from "@/components/ui/Toast";
import { useAuth } from "@/components/auth/AuthProvider";
import { cn } from "@/lib/cn";
import { authErrorMessage } from "@/lib/auth/errors";
import { savePaperSettings } from "@/lib/admin/firestore";
import { applyShiftDeduction, correctCount, restockInk, restockPaper, setThreshold } from "@/lib/inventory/firestore";
import { boxesToSheets, sheetsToBoxes } from "@/lib/inventory/units";
import type { InventoryRow } from "@/lib/inventory/scope";
import type { StockDoc, StockLog, StockType } from "@/lib/inventory/types";
import { fmtDateTime } from "@/lib/shift/summary";
import { NumberInput } from "@/components/shift/Stepper";
import { useScopedInventory } from "./DashboardData";

/* Inventory: scoped by the switcher — one location's stock under an event, or a side-by-side
   comparison of every location under Global. Paper restocks are in BOXES only. */
export function InventorySection() {
  const inv = useScopedInventory();
  return (
    <div className="flex flex-col gap-5" data-testid="section-inventory">
      {inv.lowRows.length > 0 && <LowStockBanner rows={inv.lowRows} />}
      <PendingDeductions />
      {inv.scope === "global" ? (
        <>
          <ComparisonTable rows={inv.rows} />
          <PaperSettingsCard />
        </>
      ) : inv.rows[0] ? (
        <EventInventory row={inv.rows[0]} />
      ) : null}
      {inv.unattributedCount > 0 && (
        <p data-testid="unattributed-note" className="flex items-start gap-2 text-xs text-ink-faint">
          <Info className="mt-px size-3.5 shrink-0" />
          {inv.unattributedCount} ended shift{inv.unattributedCount === 1 ? " has" : "s have"} no event, so {inv.unattributedCount === 1 ? "it doesn't" : "they don't"} automatically
          affect any location&apos;s inventory.
        </p>
      )}
    </div>
  );
}

export function LowStockBanner({ rows }: { rows: InventoryRow[] }) {
  const parts = rows.map((r) => `${r.event.name} (${[r.paperLow && "paper", r.inkLow && "ink"].filter(Boolean).join(" + ")})`);
  return (
    <div data-testid="low-stock-banner" className="flex items-center gap-3 rounded-card border border-warning/40 bg-warning-dim px-5 py-4 text-warning">
      <AlertTriangle className="size-5 shrink-0" />
      <span className="font-semibold">Low stock: {parts.join(", ")}</span>
    </div>
  );
}

function PendingDeductions() {
  const { pending, entries, events } = useScopedInventory();
  const { profile } = useAuth();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  if (pending.length === 0 || !profile) return null;
  const sheets = (id: string) => {
    const es = entries.filter((e) => e.shiftId === id);
    return es.reduce((n, e) => n + (e.type === "sale" ? e.sheets : e.hadr), 0);
  };
  return (
    <div data-testid="pending-deductions" className="rounded-card border border-warning/40 bg-warning-dim/60 px-5 py-4 text-sm">
      <p className="font-semibold text-warning">
        {pending.length} ended shift{pending.length === 1 ? "" : "s"} not yet deducted from stock
      </p>
      <ul className="mt-2 flex flex-col gap-1 text-ink-muted">
        {pending.map((s) => (
          <li key={s.id}>
            {fmtDateTime(s.startTime)} · {s.staffName} · {events.find((e) => e.id === s.eventId)?.name} · {sheets(s.id)} sheets
          </li>
        ))}
      </ul>
      <Button size="sm" className="mt-3" loading={busy}
        onClick={async () => {
          setBusy(true);
          let ok = 0;
          for (const s of pending) {
            try {
              await applyShiftDeduction(s, entries, { uid: profile.uid, name: profile.name });
              ok++;
            } catch (e) {
              toast(`Could not deduct a shift: ${authErrorMessage(e)}`, "danger");
            }
          }
          if (ok) toast(`Applied ${ok} deduction${ok === 1 ? "" : "s"}`, "success");
          setBusy(false);
        }}>
        Apply now
      </Button>
    </div>
  );
}

function ComparisonTable({ rows }: { rows: InventoryRow[] }) {
  const { paper } = useScopedInventory();
  return (
    <Card padding="lg">
      <CardHeader title="All locations" subtitle="Side-by-side stock · pick an event in the switcher to restock or adjust" />
      {rows.length === 0 ? (
        <p className="rounded-inner border border-dashed border-line px-4 py-8 text-center text-sm text-ink-faint">Create an event to start tracking inventory.</p>
      ) : (
        <div className="-mx-2 overflow-x-auto px-2">
          <table data-testid="inventory-table" className="w-full min-w-[640px] text-left text-sm">
            <thead className="text-xs text-ink-faint uppercase">
              <tr>
                <th className="py-2 font-medium">Location</th>
                <th className="py-2 text-right font-medium">Paper (sheets)</th>
                <th className="py-2 text-right font-medium">≈ Boxes</th>
                <th className="py-2 text-right font-medium">Low below</th>
                <th className="py-2 text-right font-medium">Runs out in</th>
                <th className="py-2 text-right font-medium">Ink</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map((r) => (
                <tr key={r.event.id} data-testid="inventory-row">
                  <td className="py-3">
                    <span className="font-semibold text-ink">{r.event.name}</span>
                    {r.event.status === "inactive" && <Tag tone="neutral" className="ml-2">Inactive</Tag>}
                    {!r.tracked && <span className="ml-2 text-xs text-ink-faint">setting up…</span>}
                  </td>
                  <td className={cn("py-3 text-right font-semibold tabular-nums", r.paperLow ? "text-warning" : "text-ink")}>
                    {r.paperLow && <AlertTriangle className="mr-1 inline size-3.5 -translate-y-px" />}
                    {r.inv.paper?.currentQuantity ?? "—"}
                  </td>
                  <td className="py-3 text-right tabular-nums text-ink-muted">{r.inv.paper ? sheetsToBoxes(r.inv.paper.currentQuantity, paper.sheetsPerBox) : "—"}</td>
                  <td className="py-3 text-right tabular-nums text-ink-faint">{r.inv.paper?.lowStockThreshold ?? "—"}</td>
                  <td className="py-3 text-right text-ink-muted">{r.forecast?.daysLeft != null ? `≈ ${r.forecast.daysLeft} days` : "—"}</td>
                  <td className={cn("py-3 text-right font-semibold tabular-nums", r.inkLow ? "text-warning" : "text-ink")}>
                    {r.inkLow && <AlertTriangle className="mr-1 inline size-3.5 -translate-y-px" />}
                    {r.inv.ink?.currentQuantity ?? "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

function EventInventory({ row }: { row: InventoryRow }) {
  if (!row.tracked) {
    return <Card padding="lg"><p className="text-sm text-ink-faint">Setting up inventory for {row.event.name}…</p></Card>;
  }
  return (
    <>
      <div className="grid gap-5 lg:grid-cols-2">
        <StockCard eventId={row.event.id} type="paper" stock={row.inv.paper!} low={row.paperLow} forecastDays={row.forecast?.daysLeft ?? null} avgPerDay={row.forecast?.avgPerDay ?? 0} />
        <StockCard eventId={row.event.id} type="ink" stock={row.inv.ink!} low={row.inkLow} forecastDays={null} avgPerDay={0} />
      </div>
      <StockLogList logs={row.inv.logs} eventName={row.event.name} />
    </>
  );
}

function StockCard({
  eventId, type, stock, low, forecastDays, avgPerDay,
}: {
  eventId: string; type: StockType; stock: StockDoc; low: boolean; forecastDays: number | null; avgPerDay: number;
}) {
  const { paper } = useScopedInventory();
  const { profile } = useAuth();
  const toast = useToast();
  const [mode, setMode] = useState<"restock" | "correct" | "threshold" | null>(null);
  const [amount, setAmount] = useState<number | null>(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isPaper = type === "paper";
  const unit = isPaper ? "sheets" : "cartridges";
  const by = { uid: profile?.uid ?? "", name: profile?.name ?? "" };

  function open(m: typeof mode) {
    setMode(m);
    setAmount(m === "threshold" ? stock.lowStockThreshold : m === "correct" ? stock.currentQuantity : null);
    setReason("");
    setError(null);
  }

  async function submit() {
    if (amount === null) return setError("Enter a number.");
    setBusy(true);
    setError(null);
    try {
      if (mode === "restock") {
        if (isPaper) {
          const sheets = await restockPaper(eventId, amount, paper.sheetsPerBox, by);
          toast(`Added ${amount} box${amount === 1 ? "" : "es"} = ${sheets} sheets`, "success");
        } else {
          await restockInk(eventId, amount, by);
          toast(`Added ${amount} cartridge${amount === 1 ? "" : "s"}`, "success");
        }
      } else if (mode === "correct") {
        await correctCount(eventId, type, amount, reason, by);
        toast("Count corrected", "success");
      } else if (mode === "threshold") {
        await setThreshold(eventId, type, amount);
        toast("Low-stock threshold updated", "success");
      }
      setMode(null);
    } catch (e) {
      setError(authErrorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card padding="lg" data-testid={`stock-card-${type}`} className={cn(low && "border-warning/50")}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="grid size-10 place-items-center rounded-[10px] bg-surface-2 text-ink-muted">
            {isPaper ? <FileStack className="size-5" /> : <Droplet className="size-5" />}
          </span>
          <div>
            <h3 className="font-display text-lg font-bold">{isPaper ? "Paper" : "Ink"}</h3>
            <p className="text-xs text-ink-faint">Low-stock warning below {stock.lowStockThreshold} {unit}</p>
          </div>
        </div>
        {low && <Tag tone="warning" icon={<AlertTriangle />}>Low stock</Tag>}
      </div>

      <div className="mt-5 flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span data-testid={`${type}-quantity`} className={cn("font-display text-5xl font-extrabold tabular-nums", low ? "text-warning" : "text-ink")}>
          {stock.currentQuantity}
        </span>
        <span className="text-ink-muted">{unit}</span>
        {isPaper && (
          <span data-testid="paper-boxes" className="text-sm text-ink-faint">
            ≈ {sheetsToBoxes(stock.currentQuantity, paper.sheetsPerBox)} boxes ({paper.sheetsPerBox} sheets/box)
          </span>
        )}
      </div>
      {isPaper && (
        <p data-testid="forecast" className="mt-2 text-sm text-ink-muted">
          {forecastDays != null
            ? <>At this rate (~{avgPerDay} sheets/day, last 14 days), runs out in <b className="text-ink">≈ {forecastDays} days</b>.</>
            : "Not enough shift data yet to forecast."}
        </p>
      )}

      <div className="mt-5 flex flex-wrap gap-2">
        <Button size="sm" onClick={() => open("restock")}>{isPaper ? "Restock (boxes)" : "Restock (cartridges)"}</Button>
        <Button size="sm" variant="secondary" onClick={() => open("correct")}>Correct count</Button>
        <Button size="sm" variant="ghost" onClick={() => open("threshold")}>Set warning level</Button>
      </div>

      {mode && (
        <div className="mt-4 rounded-inner border border-line bg-surface-2 p-4" data-testid={`${type}-${mode}-form`}>
          <label htmlFor={`${type}-${mode}-amount`} className="mb-1.5 block text-xs font-medium tracking-wide text-ink-faint uppercase">
            {mode === "restock"
              ? isPaper ? "Number of BOXES to add" : "Cartridges to add"
              : mode === "correct"
                ? `Counted ${unit} (stock-take — not a restock)`
                : `Warn when below (${unit})`}
          </label>
          <NumberInput id={`${type}-${mode}-amount`} value={amount} onChange={setAmount} inputMode={mode === "restock" ? "numeric" : "decimal"} />
          {mode === "restock" && isPaper && amount !== null && amount > 0 && (
            <p data-testid="restock-preview" className="mt-2 text-sm text-ink-muted">
              {amount} box{amount === 1 ? "" : "es"} × {paper.sheetsPerBox} = <b className="text-ink">{boxesToSheets(amount, paper.sheetsPerBox)} sheets</b>
            </p>
          )}
          {mode === "correct" && amount !== null && (
            <>
              <p className="mt-2 text-sm text-ink-muted">
                Change: {amount - stock.currentQuantity >= 0 ? "+" : ""}{Math.round((amount - stock.currentQuantity) * 10) / 10} {unit}
              </p>
              <input aria-label="Reason" placeholder="Reason (e.g. monthly stock-take)" value={reason} onChange={(e) => setReason(e.target.value)}
                className="mt-2 h-11 w-full rounded-inner border border-line bg-surface px-3 text-sm text-ink outline-none focus:border-magenta/70" />
            </>
          )}
          <div className="mt-3"><FormError>{error}</FormError></div>
          <div className="mt-3 flex gap-2">
            <Button size="sm" variant="secondary" onClick={() => setMode(null)}>Cancel</Button>
            <Button size="sm" loading={busy} onClick={submit}>
              {mode === "restock" ? "Add stock" : mode === "correct" ? "Save count" : "Save"}
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}

const KIND_LABEL: Record<StockLog["kind"], { label: string; tone: "success" | "info" | "neutral" | "accent" }> = {
  restock: { label: "Restock", tone: "success" },
  correction: { label: "Correction", tone: "info" },
  shift: { label: "Shift", tone: "neutral" },
  shiftReversal: { label: "Shift deleted", tone: "accent" },
};

function StockLogList({ logs, eventName }: { logs: StockLog[]; eventName: string }) {
  return (
    <Card padding="lg">
      <CardHeader title="Stock history" subtitle={`${eventName} · most recent first`} />
      {logs.length === 0 ? (
        <p className="rounded-inner border border-dashed border-line px-4 py-6 text-center text-sm text-ink-faint">No stock changes yet.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-line" data-testid="stock-log">
          {logs.map((l) => (
            <li key={l.id} data-testid="stock-log-row" className="flex flex-wrap items-center gap-3 py-2.5 text-sm">
              <span className="w-32 shrink-0 text-xs text-ink-faint tabular-nums">{l.createdAtMs ? fmtDateTime(new Date(l.createdAtMs).toISOString()) : "—"}</span>
              <Tag tone={KIND_LABEL[l.kind].tone}>{KIND_LABEL[l.kind].label}</Tag>
              <span className="text-xs text-ink-faint uppercase">{l.stockType}</span>
              <span className="min-w-0 flex-1 truncate text-ink-muted">{l.reason}{l.byName && ` · ${l.byName}`}</span>
              <span className={cn("font-semibold tabular-nums", l.delta >= 0 ? "text-success" : "text-pink")}>
                {l.delta >= 0 ? "+" : ""}{l.delta} {l.stockType === "paper" ? "sheets" : "cart."}
                {l.kind === "restock" && l.boxes != null && <span className="ml-1 font-normal text-ink-faint">({l.boxes} box{l.boxes === 1 ? "" : "es"})</span>}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

/** The two SEPARATE paper units. Pack = staff "+ Paper change"; box = inventory restocks. */
function PaperSettingsCard() {
  const { paper } = useScopedInventory();
  const toast = useToast();
  const [pack, setPack] = useState<number | null>(paper.sheetsPerPack);
  const [box, setBox] = useState<number | null>(paper.sheetsPerBox);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dirty = pack !== paper.sheetsPerPack || box !== paper.sheetsPerBox;
  return (
    <Card padding="lg" data-testid="paper-settings">
      <CardHeader title="Paper units" subtitle="Two different units — never interchanged" action={<Settings2 className="size-5 text-ink-faint" />} />
      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label htmlFor="set-pack" className="mb-1.5 block text-xs font-medium tracking-wide text-ink-faint uppercase">Sheets per PACK</label>
          <NumberInput id="set-pack" value={pack} onChange={setPack} inputMode="numeric" />
          <p className="mt-1.5 text-xs text-ink-faint">Staff tap “+ Paper change” once per pack during a shift. Used for paper reconciliation. Changes apply to shifts started afterwards.</p>
        </div>
        <div>
          <label htmlFor="set-box" className="mb-1.5 block text-xs font-medium tracking-wide text-ink-faint uppercase">Sheets per BOX</label>
          <NumberInput id="set-box" value={box} onChange={setBox} inputMode="numeric" />
          <p className="mt-1.5 text-xs text-ink-faint">Admins restock inventory in boxes. Stock is always stored in sheets.</p>
        </div>
      </div>
      <div className="mt-3"><FormError>{error}</FormError></div>
      <Button className="mt-3" size="sm" disabled={!dirty} loading={busy}
        onClick={async () => {
          setBusy(true);
          setError(null);
          try {
            await savePaperSettings({ sheetsPerPack: pack ?? 0, sheetsPerBox: box ?? 0 });
            toast("Paper units saved", "success");
          } catch (e) {
            setError(authErrorMessage(e));
          } finally {
            setBusy(false);
          }
        }}>
        Save units
      </Button>
    </Card>
  );
}
