"use client";

import { useState } from "react";
import { AlertTriangle, Check, Droplet, FileStack, Frame, Info, Magnet, Settings2 } from "lucide-react";
import { Card, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Tag } from "@/components/ui/Tag";
import { FormError } from "@/components/ui/Field";
import { useToast } from "@/components/ui/Toast";
import { useAuth } from "@/components/auth/AuthProvider";
import { cn } from "@/lib/cn";
import { authErrorMessage } from "@/lib/auth/errors";
import { savePaperSettings } from "@/lib/admin/firestore";
import {
  applyShiftDeduction, correctCount, dismissLowStock, restockPaper, restockPieces, setThreshold, shiftConsumption,
} from "@/lib/inventory/firestore";
import { boxesToSheets, describeDeduction, sheetsToBoxes } from "@/lib/inventory/units";
import type { InventoryRow, StockAlert } from "@/lib/inventory/scope";
import type { Forecast } from "@/lib/inventory/forecast";
import { STOCK_INFO, STOCK_TYPES, type StockDoc, type StockLog, type StockType } from "@/lib/inventory/types";
import { fmtNum } from "@/lib/format";
import { fmtDateTime } from "@/lib/shift/summary";
import { NumberInput } from "@/components/shift/Stepper";
import { useScopedInventory } from "./DashboardData";

/* Inventory: scoped by the switcher — one location's stock under an event, or a side-by-side
   comparison of every location under Global. Paper restocks are in BOXES only; ink and
   frames are restocked by piece. */
export function InventorySection() {
  const inv = useScopedInventory();
  return (
    <div className="flex flex-col gap-5" data-testid="section-inventory">
      <LowStockBanner />
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

export const STOCK_ICON: Record<StockType, React.ComponentType<{ className?: string }>> = {
  paper: FileStack,
  ink: Droplet,
  acrylic: Frame,
  magnetic: Magnet,
};

const qtyText = (type: StockType, n: number) => `${fmtNum(n)} ${n === 1 ? STOCK_INFO[type].unitOne : STOCK_INFO[type].unit}`;

/**
 * Low-stock alerts for the current scope. Each one can be marked as read — hidden for every
 * admin until that stock is back at/above its warning level (then it re-arms).
 */
export function LowStockBanner({ compact, onOpen }: { compact?: boolean; onOpen?: () => void }) {
  const { alerts, readAlerts } = useScopedInventory();
  const [showRead, setShowRead] = useState(false);
  if (alerts.length === 0 && readAlerts.length === 0) return null;
  const shown = showRead ? [...alerts, ...readAlerts] : alerts;
  return (
    <div data-testid="low-stock-banner" data-active={alerts.length > 0 || undefined}
      className={cn("rounded-card border px-5 py-4", alerts.length > 0 ? "border-warning/40 bg-warning-dim" : "border-line bg-surface")}>
      <div className="flex items-center gap-3">
        <AlertTriangle className={cn("size-5 shrink-0", alerts.length > 0 ? "text-warning" : "text-ink-faint")} />
        <span className={cn("flex-1 font-semibold", alerts.length > 0 ? "text-warning" : "text-ink-muted")}>
          {alerts.length > 0 ? `Low stock (${alerts.length})` : "No new low-stock alerts"}
        </span>
        {onOpen && <button type="button" onClick={onOpen} className="text-sm text-warning underline underline-offset-4">Inventory</button>}
      </div>
      {shown.length > 0 && (
        <ul className={cn("mt-3 flex flex-col divide-y", alerts.length > 0 ? "divide-warning/20" : "divide-line")}>
          {shown.map((a) => <AlertRow key={`${a.event.id}:${a.type}`} a={a} compact={compact} />)}
        </ul>
      )}
      {readAlerts.length > 0 && (
        <button type="button" data-testid="toggle-read-alerts" onClick={() => setShowRead((v) => !v)}
          className="mt-2 text-xs text-ink-faint underline underline-offset-4 hover:text-ink-muted">
          {showRead ? "Hide read alerts" : `Show ${readAlerts.length} read alert${readAlerts.length === 1 ? "" : "s"}`}
        </button>
      )}
    </div>
  );
}

function AlertRow({ a, compact }: { a: StockAlert; compact?: boolean }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const Icon = STOCK_ICON[a.type];
  return (
    <li data-testid="low-stock-item" data-read={a.dismissed || undefined} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2 text-sm">
      <Icon className={cn("size-4 shrink-0", a.dismissed ? "text-ink-faint" : "text-warning")} />
      <span className={cn("min-w-0 flex-1", a.dismissed ? "text-ink-faint" : "text-ink")}>
        {compact ? (
          <>
            <b className="block truncate font-semibold">{a.event.name}</b>
            <span className="block text-xs text-ink-muted">{STOCK_INFO[a.type].label}: {qtyText(a.type, a.quantity)} left</span>
          </>
        ) : (
          <>
            <b className="font-semibold">{a.event.name}</b> · {STOCK_INFO[a.type].label}: {qtyText(a.type, a.quantity)} left
            <span className="text-ink-faint"> (warns below {fmtNum(a.threshold)})</span>
          </>
        )}
      </span>
      {a.dismissed ? (
        <span className="text-xs text-ink-faint">Read</span>
      ) : (
        <Button size="sm" variant="ghost" loading={busy} data-testid="mark-read"
          onClick={async () => {
            setBusy(true);
            try {
              await dismissLowStock(a.event.id, a.type);
            } catch (e) {
              toast(`Could not mark as read: ${authErrorMessage(e)}`, "danger");
              setBusy(false);
            }
          }}>
          <Check className="size-4" /> Mark as read
        </Button>
      )}
    </li>
  );
}

function PendingDeductions() {
  const { pending, entries, events } = useScopedInventory();
  const { profile } = useAuth();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  if (pending.length === 0 || !profile) return null;
  return (
    <div data-testid="pending-deductions" className="rounded-card border border-warning/40 bg-warning-dim/60 px-5 py-4 text-sm">
      <p className="font-semibold text-warning">
        {pending.length} ended shift{pending.length === 1 ? "" : "s"} not yet deducted from stock
      </p>
      <ul className="mt-2 flex flex-col gap-1 text-ink-muted">
        {pending.map((s) => (
          <li key={s.id}>
            {fmtDateTime(s.startTime)} · {s.staffName} · {events.find((e) => e.id === s.eventId)?.name} · {describeDeduction(shiftConsumption(s, entries))}
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

function QtyCell({ row, type, testid }: { row: InventoryRow; type: StockType; testid?: string }) {
  const s = row.inv[type];
  const low = row.low[type];
  return (
    <td data-testid={testid} className={cn("py-3 pl-4 text-right font-semibold tabular-nums", low ? (row.alerting[type] ? "text-warning" : "text-ink-muted") : "text-ink")}>
      {low && <AlertTriangle className="mr-1 inline size-3.5 -translate-y-px" />}
      {s ? fmtNum(s.currentQuantity) : "—"}
    </td>
  );
}

function ComparisonTable({ rows }: { rows: InventoryRow[] }) {
  const { paper } = useScopedInventory();
  const th = "py-2 pl-4 text-right font-medium";
  return (
    <Card padding="lg">
      <CardHeader title="All locations" subtitle="Side-by-side stock · pick an event in the switcher to restock or adjust" />
      {rows.length === 0 ? (
        <p className="rounded-inner border border-dashed border-line px-4 py-8 text-center text-sm text-ink-faint">Create an event to start tracking inventory.</p>
      ) : (
        <div className="-mx-2 overflow-x-auto px-2">
          <table data-testid="inventory-table" className="w-full min-w-[760px] text-left text-sm">
            <thead className="text-xs text-ink-faint uppercase">
              <tr>
                <th className="py-2 font-medium">Location</th>
                <th className={th}>Paper (sheets)</th>
                <th className={th}>≈ Boxes</th>
                <th className={th}>Paper runs out</th>
                <th className={th}>Ink</th>
                <th className={th}>Acrylic</th>
                <th className={th}>Magnetic</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map((r) => (
                <tr key={r.event.id} data-testid="inventory-row">
                  <td className="py-3">
                    <span className="font-semibold text-ink">{r.event.name}</span>
                    {r.event.status === "inactive" && <Tag tone="neutral" className="ml-2">Ended</Tag>}
                    {!r.tracked && <span className="ml-2 text-xs text-ink-faint">setting up…</span>}
                  </td>
                  <QtyCell row={r} type="paper" />
                  <td className="py-3 pl-4 text-right tabular-nums text-ink-muted">{r.inv.paper ? fmtNum(sheetsToBoxes(r.inv.paper.currentQuantity, paper.sheetsPerBox)) : "—"}</td>
                  <td className="py-3 pl-4 text-right text-ink-muted">{r.forecasts.paper?.daysLeft != null ? `≈ ${fmtNum(r.forecasts.paper.daysLeft)} days` : "—"}</td>
                  <QtyCell row={r} type="ink" />
                  <QtyCell row={r} type="acrylic" testid="inv-acrylic" />
                  <QtyCell row={r} type="magnetic" testid="inv-magnetic" />
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
      <div className="grid gap-5 md:grid-cols-2 2xl:grid-cols-4">
        {STOCK_TYPES.map((t) => (
          <StockCard key={t} eventId={row.event.id} type={t} stock={row.inv[t]!} low={row.low[t]} forecast={row.forecasts[t]} />
        ))}
      </div>
      <StockLogList logs={row.inv.logs} eventName={row.event.name} />
    </>
  );
}

function StockCard({
  eventId, type, stock, low, forecast,
}: {
  eventId: string; type: StockType; stock: StockDoc; low: boolean; forecast: Forecast | null;
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
  const { label, unit } = STOCK_INFO[type];
  const Icon = STOCK_ICON[type];
  const alerting = low && !stock.alertDismissed;
  const by = { uid: profile?.uid ?? "", name: profile?.name ?? "" };
  const forecastDays = forecast?.daysLeft ?? null;

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
          toast(`Added ${fmtNum(amount)} box${amount === 1 ? "" : "es"} = ${fmtNum(sheets)} sheets`, "success");
        } else {
          await restockPieces(eventId, type, amount, by);
          toast(`Added ${qtyText(type, amount)}`, "success");
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
    <Card padding="lg" data-testid={`stock-card-${type}`} className={cn("flex flex-col", alerting && "border-warning/50")}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-[10px] bg-surface-2 text-ink-muted">
            <Icon className="size-5" />
          </span>
          <div className="min-w-0">
            <h3 className="font-display text-lg font-bold">{label}</h3>
            <p className="text-xs text-ink-faint">Warns below {qtyText(type, stock.lowStockThreshold)}</p>
          </div>
        </div>
        {low && (alerting
          ? <Tag tone="warning" icon={<AlertTriangle />}>Low stock</Tag>
          : <Tag tone="neutral" data-testid={`${type}-low-read`}>Low stock · read</Tag>)}
      </div>

      <div className="mt-5 flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span data-testid={`${type}-quantity`} className={cn("font-display text-5xl font-extrabold tabular-nums lg:text-4xl", alerting ? "text-warning" : "text-ink")}>
          {fmtNum(stock.currentQuantity)}
        </span>
        <span className="text-ink-muted">{unit}</span>
        {isPaper && (
          <span data-testid="paper-boxes" className="text-sm text-ink-faint">
            ≈ {fmtNum(sheetsToBoxes(stock.currentQuantity, paper.sheetsPerBox))} boxes ({fmtNum(paper.sheetsPerBox)} sheets/box)
          </span>
        )}
      </div>
      <p data-testid={`${type}-forecast`} className="mt-2 text-sm text-ink-muted">
        {forecastDays != null
          ? <>At this rate (~{fmtNum(forecast!.avgPerDay)} {unit}/day, last 14 days), runs out in <b className="text-ink">≈ {fmtNum(forecastDays)} days</b>.</>
          : type === "paper"
            ? "Not enough shift data yet to forecast."
            : type === "ink"
              ? "No ink changes logged by staff recently — nothing to forecast yet."
              : "No frames sold recently — nothing to forecast yet."}
      </p>

      <div className="mt-auto flex flex-wrap gap-2 pt-5">
        <Button size="sm" onClick={() => open("restock")}>{isPaper ? "Restock (boxes)" : `Restock (${unit})`}</Button>
        <Button size="sm" variant="secondary" onClick={() => open("correct")}>Correct count</Button>
        <Button size="sm" variant="ghost" onClick={() => open("threshold")}>Set warning level</Button>
        {alerting && <MarkReadButton eventId={eventId} type={type} />}
      </div>

      {mode && (
        <div className="mt-4 rounded-inner border border-line bg-surface-2 p-4" data-testid={`${type}-${mode}-form`}>
          <label htmlFor={`${type}-${mode}-amount`} className="mb-1.5 block text-xs font-medium tracking-wide text-ink-faint uppercase">
            {mode === "restock"
              ? isPaper ? "Number of BOXES to add" : `${label} to add (pieces)`
              : mode === "correct"
                ? `Counted ${unit} (stock-take — not a restock)`
                : `Warn when below (${unit})`}
          </label>
          <NumberInput id={`${type}-${mode}-amount`} value={amount} onChange={setAmount} inputMode={mode === "restock" || !isPaper ? "numeric" : "decimal"} />
          {mode === "restock" && isPaper && amount !== null && amount > 0 && (
            <p data-testid="restock-preview" className="mt-2 text-sm text-ink-muted">
              {fmtNum(amount)} box{amount === 1 ? "" : "es"} × {fmtNum(paper.sheetsPerBox)} = <b className="text-ink">{fmtNum(boxesToSheets(amount, paper.sheetsPerBox))} sheets</b>
            </p>
          )}
          {mode === "correct" && amount !== null && (
            <>
              <p className="mt-2 text-sm text-ink-muted">
                Change: {amount - stock.currentQuantity >= 0 ? "+" : ""}{fmtNum(Math.round((amount - stock.currentQuantity) * 10) / 10)} {unit}
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

function MarkReadButton({ eventId, type }: { eventId: string; type: StockType }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  return (
    <Button size="sm" variant="ghost" loading={busy} data-testid={`${type}-mark-read`}
      onClick={async () => {
        setBusy(true);
        try {
          await dismissLowStock(eventId, type);
        } catch (e) {
          toast(`Could not mark as read: ${authErrorMessage(e)}`, "danger");
        } finally {
          setBusy(false);
        }
      }}>
      <Check className="size-4" /> Mark as read
    </Button>
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
        <div className="-mx-2 overflow-x-auto px-2">
          <table data-testid="stock-log" className="w-full min-w-[640px] table-fixed text-left text-sm">
            <thead className="text-xs text-ink-faint uppercase">
              <tr>
                <th className="w-36 py-2 font-medium">When</th>
                <th className="w-32 py-2 pl-3 font-medium">Kind</th>
                <th className="w-36 py-2 pl-3 font-medium">Item</th>
                <th className="py-2 pl-3 font-medium">Details</th>
                <th className="w-52 py-2 pl-3 text-right font-medium">Change</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {logs.map((l) => (
                <tr key={l.id} data-testid="stock-log-row">
                  <td className="py-2.5 text-xs whitespace-nowrap text-ink-faint tabular-nums">{l.createdAtMs ? fmtDateTime(new Date(l.createdAtMs).toISOString()) : "—"}</td>
                  <td className="py-2.5 pl-3"><Tag tone={KIND_LABEL[l.kind].tone}>{KIND_LABEL[l.kind].label}</Tag></td>
                  <td className="py-2.5 pl-3 whitespace-nowrap text-ink-muted">{STOCK_INFO[l.stockType].label}</td>
                  <td className="truncate py-2.5 pl-3 text-ink-muted" title={l.reason}>{l.reason}{l.byName && ` · ${l.byName}`}</td>
                  <td className={cn("py-2.5 pl-3 text-right font-semibold whitespace-nowrap tabular-nums", l.delta >= 0 ? "text-success" : "text-pink")}>
                    {l.delta >= 0 ? "+" : ""}{fmtNum(l.delta)} {STOCK_INFO[l.stockType].unit}
                    {l.kind === "restock" && l.boxes != null && <span className="ml-1 font-normal text-ink-faint">({fmtNum(l.boxes)} box{l.boxes === 1 ? "" : "es"})</span>}
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
