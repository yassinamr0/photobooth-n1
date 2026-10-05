"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, CreditCard, Info, Mail, Package } from "lucide-react";
import { Card, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { FormError } from "@/components/ui/Field";
import { useToast } from "@/components/ui/Toast";
import { NumberInput } from "@/components/shift/Stepper";
import { cn } from "@/lib/cn";
import { SegThumb } from "@/components/ui/Segmented";
import { firebase } from "@/lib/firebase/client";
import { authErrorMessage } from "@/lib/auth/errors";
import { dayKey, parseDay } from "@/lib/admin/range";
import { fmtNum, formatEGP } from "@/lib/format";
import { pct } from "@/lib/stats/waste";
import { breakEvenByLocation, pnlBreakEven, pnlProducts, type PnlInputs } from "@/lib/pnl/pnl";
import { costsOn, paperPerSheet, type CostStep } from "@/lib/pnl/costs";
import { describeFee, feeOn, type FeeMode } from "@/lib/pnl/fees";
import { saveCosts, saveFee } from "@/lib/pnl/firestore";
import { savePaperSettings } from "@/lib/admin/firestore";
import type { BreakEven } from "@/lib/pnl/breakeven";
import { usePnl } from "../DashboardData";

const egp = (n: number) => formatEGP(Math.round(n));
const dayText = (k: string) => parseDay(k).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
const input =
  "h-11 w-full min-w-0 rounded-inner border border-white/[0.06] well px-3 text-sm text-ink outline-none [color-scheme:dark] focus:border-magenta/70";
const lbl = "mb-1.5 block text-xs font-medium tracking-wide text-ink-faint uppercase";

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="empty-state">{children}</p>;
}

/* ─────────────── Break-even ─────────────── */
export function BreakEvenCard({ inp, now, label }: { inp: PnlInputs; now: Date; label: string }) {
  const { scope, range, events } = usePnl();
  const ended = useMemo(() => new Set(events.filter((e) => e.status === "inactive").map((e) => e.id)), [events]);
  const items = useMemo(() => {
    if (scope !== "global") {
      if (ended.has(scope)) return [];
      return [{ id: scope, name: events.find((e) => e.id === scope)?.name ?? "This location", ...pnlBreakEven(inp, scope, range, now) }];
    }
    return [
      ...breakEvenByLocation(inp, range, now, ended),
      { id: null, name: "All locations (incl. General costs)", ...pnlBreakEven(inp, "global", range, now) },
    ];
  }, [inp, scope, range, now, events, ended]);
  const missing = items.some((i) => i.materialsMissing);
  return (
    <Card padding="lg" data-testid="pnl-breakeven">
      <CardHeader title="Break-even" subtitle={`How much each location has to sell a day to pay for itself · ${label}`} />
      {items.length === 0 ? (
        <Empty>{scope !== "global" && ended.has(scope) ? "This event has ended — break-even isn't shown." : "No active locations."}</Empty>
      ) : (
        <ul className="flex flex-col divide-y divide-line">
          {items.map((i) => <BreakEvenRow key={i.id ?? "all"} name={i.name} be={i.be} total={i.id === null} notOpen={i.notOpen} />)}
        </ul>
      )}
      <p className="mt-3 flex items-start gap-2 text-xs text-ink-faint">
        <Info className="mt-px size-3.5 shrink-0" />
        &quot;Needs&quot; = your fixed costs per day (rent, salaries, other expenses — monthly ones spread over the month), plus
        enough extra to cover paper, ink and card fees on those sales. If a location sells more than that a day, it&apos;s profitable.
        {missing && " Some product costs aren't set yet, so paper/ink are left out where missing."}
      </p>
    </Card>
  );
}

function BreakEvenRow({ name, be, total, notOpen }: { name: string; be: BreakEven; total: boolean; notOpen?: boolean }) {
  if (notOpen) {
    return (
      <li data-testid="breakeven-row" className="flex flex-wrap items-center justify-between gap-2 py-4 text-sm">
        <span className="font-semibold text-ink">{name}</span>
        <span className="text-ink-faint">Not running on these dates</span>
      </li>
    );
  }
  const need = be.breakEvenPerDay;
  const ok = be.covered === true;
  const none = be.covered === null;
  // Progress toward the daily goal (capped at the goal; the surplus is shown as text).
  const progress = need && need > 0 ? Math.min(1, be.avgPerDay / need) : be.avgPerDay > 0 ? 1 : 0;
  const gap = need != null ? be.avgPerDay - need : 0;
  return (
    <li data-testid="breakeven-row" data-covered={ok || undefined} className={cn("py-4", total && "rounded-[8px] bg-white/[0.02] px-3")}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-semibold text-ink">{name}</span>
        <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold",
          none ? "bg-white/[0.04] text-ink-faint" : ok ? "bg-success/10 text-success" : "bg-danger/10 text-danger")}>
          {none ? "No costs or sales yet"
            : ok ? <><CheckCircle2 className="size-3.5" /> Profitable · {egp(gap)}/day above</>
              : need == null ? <><AlertTriangle className="size-3.5" /> Costs take all the money</>
                : <><AlertTriangle className="size-3.5" /> Losing · {egp(-gap)}/day short</>}
        </span>
      </div>

      {need == null ? (
        <p className="mt-2 text-sm text-danger">Paper, ink and card fees cost more than the sales bring in, so no amount of sales covers the costs.</p>
      ) : (
        <>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <div>
              <div className="text-xs text-ink-faint">Needs to sell</div>
              <div className="font-display text-xl font-bold tabular-nums text-ink"><span data-testid="breakeven-need">{egp(need)}</span><span className="text-sm font-medium text-ink-muted"> /day</span></div>
              {be.printsPerDay != null && need > 0 && <div className="text-xs text-ink-faint">≈ {fmtNum(Math.ceil(be.printsPerDay))} half-sheet print{Math.ceil(be.printsPerDay) === 1 ? "" : "s"} a day</div>}
            </div>
            <div>
              <div className="text-xs text-ink-faint">Actually selling</div>
              <div className={cn("font-display text-xl font-bold tabular-nums", none ? "text-ink" : ok ? "text-success" : "text-danger")}>
                {egp(be.avgPerDay)}<span className="text-sm font-medium text-ink-muted"> /day</span>
              </div>
              <div className="text-xs text-ink-faint">average over {fmtNum(be.days)} day{be.days === 1 ? "" : "s"}</div>
            </div>
          </div>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-chart-track" aria-hidden>
            <div className={cn("h-full rounded-full", none ? "bg-line-strong" : ok ? "bg-success" : "bg-danger")} style={{ width: `${progress * 100}%` }} />
          </div>
          <div className="mt-1 flex justify-between text-[11px] text-ink-faint">
            <span>0</span>
            <span>{ok ? "goal reached" : `${Math.round(progress * 100)}% of the goal`}</span>
          </div>
        </>
      )}
      <details className="mt-2 text-xs text-ink-faint">
        <summary className="cursor-pointer select-none hover:text-ink-muted">How this is worked out</summary>
        <p className="mt-1.5 leading-relaxed">
          Fixed costs: {egp(be.fixedPerDay)} a day. Paper, ink and card fees: {be.variableShare == null ? "not known yet (no sales)" : `${pct(be.variableShare)} of every sale`}.
          So the booth has to sell {need == null ? "more than it ever can" : `${egp(need)} a day`} to cover both.
        </p>
      </details>
    </li>
  );
}

/* ─────────────── Profit per product ─────────────── */
export function ProductsCard({ inp, now, label }: { inp: PnlInputs; now: Date; label: string }) {
  const { scope, range } = usePnl();
  const p = useMemo(() => pnlProducts(inp, scope, range, now), [inp, scope, range, now]);
  const th = "py-2 pl-4 text-right font-medium whitespace-nowrap";
  const td = "py-3 pl-4 text-right tabular-nums whitespace-nowrap";
  const perUnit = (r: (typeof p.rows)[number]) =>
    r.units > 0 && r.key !== "adjust" ? `${egp(r.revenue / r.units)} → ${r.profit == null ? "?" : egp(r.profit / r.units)}` : "—";
  return (
    <Card padding="lg" data-testid="pnl-products">
      <CardHeader title="Profit per product" subtitle={`After materials and card fees · ${label}`} />
      {p.rows.length === 0 ? (
        <Empty>No sales in this range.</Empty>
      ) : (
        <div className="-mx-2 overflow-x-auto px-2">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="text-xs text-ink-faint uppercase">
              <tr>
                <th className="py-2 font-medium">Product</th>
                <th className={th}>Sold</th>
                <th className={th}>Revenue</th>
                <th className={th}>Materials</th>
                <th className={th}>Card fees</th>
                <th className={th}>Profit</th>
                <th className={th}>Per unit (price → profit)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {p.rows.map((r) => (
                <tr key={r.key} data-testid={`product-${r.key}`}>
                  <td className="py-3 font-semibold text-ink">
                    {r.label}
                    {r.key === "adjust" && <span className="ml-1 text-xs font-normal text-ink-faint">(discounts on sales without prints)</span>}
                  </td>
                  <td className={td}>{r.key === "adjust" ? "—" : fmtNum(r.units)}</td>
                  <td className={cn(td, "text-gold")}>{egp(r.revenue)}</td>
                  <td className={td}>{r.materials == null ? <span className="text-ink-faint">cost not set</span> : egp(r.materials)}</td>
                  <td className={td}>{egp(r.fees)}</td>
                  <td data-testid="product-profit" className={cn(td, "font-semibold", r.profit == null ? "text-ink-faint" : r.profit < 0 ? "text-danger" : "text-success")}>
                    {r.profit == null ? "—" : `${r.profit < 0 ? "−" : ""}${egp(Math.abs(r.profit))}`}
                  </td>
                  <td className={cn(td, "text-ink-muted")}>{perUnit(r)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div className="mt-4 flex flex-wrap items-center gap-3 rounded-inner border border-line bg-surface-2 px-4 py-3 text-sm" data-testid="waste-cost">
        <Package className="size-4 text-pink" />
        {p.waste.sheets === 0 ? (
          <span className="text-ink-muted">No hadr waste in this range.</span>
        ) : p.waste.cost == null ? (
          <span className="text-ink-muted">{fmtNum(p.waste.sheets)} sheets wasted — set the box price to see what that cost.</span>
        ) : (
          <span className="text-ink-muted">
            Waste cost you <b className="text-ink">{egp(p.waste.cost)}</b> ({fmtNum(p.waste.sheets)} sheet{p.waste.sheets === 1 ? "" : "s"} of paper + ink)
          </span>
        )}
      </div>
      <p className="mt-3 flex items-start gap-2 text-xs text-ink-faint">
        <Info className="mt-px size-3.5 shrink-0" />
        Frames count at full price; prints take any discount. A printed sheet costs the box price ÷ sheets in a box (ink included). This is an
        analysis — your headline profit already includes stock purchases as expenses, so materials aren&apos;t subtracted twice.
        {p.missingCosts && " Set your costs in “What things cost you” below to fill in the blanks."}
      </p>
    </Card>
  );
}

/* ─────────────── Settings: card fees ─────────────── */
export function FeesCard() {
  const { fees } = usePnl();
  const toast = useToast();
  const today = dayKey(new Date());
  const current = feeOn(fees, today);
  const [mode, setMode] = useState<FeeMode>(current?.mode ?? "percent");
  const [percent, setPercent] = useState<number | null>(current?.percent ?? null);
  const [fixed, setFixed] = useState<number | null>(current?.fixed ?? null);
  const [from, setFrom] = useState(today);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setBusy(true);
    setError(null);
    try {
      await saveFee(fees, { from, mode, percent: percent ?? 0, fixed: mode === "percentPlusFixed" ? fixed ?? 0 : 0 });
      toast(`Card fee saved — applies from ${dayText(from)}`, "success");
    } catch (e) {
      setError(authErrorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  const history = [...fees].sort((a, b) => b.from.localeCompare(a.from));
  return (
    <Card padding="lg" data-testid="fees-card">
      <CardHeader title="Card machine fees" subtitle={<>Now: <b className="text-ink" data-testid="fee-now">{describeFee(current)}</b></>}
        action={<CreditCard className="size-5 text-ink-faint" />} />
      <div role="tablist" aria-label="Fee type" className="mb-4 flex gap-1 relative rounded-inner border border-white/[0.06] well p-1">
        <SegThumb />
        {([["percent", "Percentage only"], ["percentPlusFixed", "Percentage + fixed"]] as const).map(([k, l]) => (
          <button key={k} type="button" role="tab" aria-selected={mode === k} data-testid={`fee-mode-${k}`} onClick={() => setMode(k)}
            className={cn("relative z-[1] h-8 flex-1 rounded-inner px-3 text-sm font-semibold transition-colors", mode === k ? "text-on-primary" : "text-ink-muted hover:text-ink")}>
            {l}
          </button>
        ))}
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <label htmlFor="fee-percent" className={lbl}>% of card amount</label>
          <NumberInput id="fee-percent" value={percent} onChange={setPercent} className="h-11 text-base" step="0.01" />
        </div>
        {mode === "percentPlusFixed" && (
          <div>
            <label htmlFor="fee-fixed" className={lbl}>+ EGP per card sale</label>
            <NumberInput id="fee-fixed" value={fixed} onChange={setFixed} className="h-11 text-base" step="0.01" />
          </div>
        )}
        <div>
          <label htmlFor="fee-from" className={lbl}>Applies from</label>
          <input id="fee-from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} className={input} />
        </div>
      </div>
      <p className="mt-3 text-xs text-ink-faint">
        Charged on the Visa part of each sale; a split cash + card sale counts as one card sale. It stays in force until you change
        it — earlier days keep the fee they had.
      </p>
      <div className="mt-3"><FormError>{error}</FormError></div>
      <Button className="mt-3" size="sm" loading={busy} onClick={save} data-testid="fee-save">Save fee</Button>
      {history.length > 0 && (
        <ul className="mt-4 flex flex-col gap-1 border-t border-line pt-3 text-xs text-ink-muted" data-testid="fee-history">
          {history.map((h) => <li key={h.from}>From {dayText(h.from)}: {describeFee(h)}</li>)}
        </ul>
      )}
    </Card>
  );
}

/* ─────────────── Settings: product costs ─────────────── */
export function CostsCard() {
  const { costs, paper } = usePnl();
  const toast = useToast();
  const today = dayKey(new Date());
  const current = costsOn(costs, today);
  const [v, setV] = useState<Omit<CostStep, "from">>({
    paperBox: current?.paperBox ?? null, cartridgesPerBox: current?.cartridgesPerBox ?? null, acrylic: current?.acrylic ?? null, magnetic: current?.magnetic ?? null,
  });
  // Sheets per BOX is the same setting Inventory restocks use (settings/paper) — one box, one number.
  const [sheetsPerBox, setSheetsPerBox] = useState<number | null>(paper.sheetsPerBox);
  const [from, setFrom] = useState(today);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const perSheet = paperPerSheet({ from, ...v }, sheetsPerBox ?? 0);
  const field = (k: keyof typeof v, label: string, testid: string, hint?: string) => (
    <div>
      <label htmlFor={`cost-${k}`} className={lbl}>{label}</label>
      <NumberInput id={`cost-${k}`} data-testid={testid} value={v[k]} onChange={(x) => setV({ ...v, [k]: x })} className="h-11 text-base" />
      {hint && <p className="mt-1 text-[11px] text-ink-faint">{hint}</p>}
    </div>
  );
  return (
    <Card padding="lg" data-testid="costs-card">
      <CardHeader title="What things cost you" subtitle="Used for profit per product, waste cost and break-even" action={<Package className="size-5 text-ink-faint" />} />
      <h4 className="mb-2 text-xs font-semibold tracking-wide text-ink-muted uppercase">Box of paper (ink included)</h4>
      <div className="grid gap-3 sm:grid-cols-3">
        {field("paperBox", "Box price (EGP)", "cost-paper")}
        <div>
          <label htmlFor="cost-sheetsPerBox" className={lbl}>Sheets in a box</label>
          <NumberInput id="cost-sheetsPerBox" data-testid="cost-sheets" value={sheetsPerBox} onChange={setSheetsPerBox} inputMode="numeric" className="h-11 text-base" />
          <p className="mt-1 text-[11px] text-ink-faint">Same box you restock in Inventory</p>
        </div>
        {field("cartridgesPerBox", "Ink cartridges in a box", "cost-cartridges")}
      </div>
      {perSheet != null && (
        <p data-testid="cost-per-sheet" className="mt-2 text-xs text-ink-muted">
          = {formatEGP(Math.round(perSheet * 100) / 100)} per printed sheet (paper + ink)
          {v.cartridgesPerBox != null && ` · ${fmtNum(v.cartridgesPerBox)} cartridge${v.cartridgesPerBox === 1 ? "" : "s"} per ${fmtNum(sheetsPerBox ?? 0)} sheets`}
        </p>
      )}
      <h4 className="mt-5 mb-2 text-xs font-semibold tracking-wide text-ink-muted uppercase">Frames</h4>
      <div className="grid gap-3 sm:grid-cols-3">
        {field("acrylic", "Acrylic frame (EGP)", "cost-acrylic")}
        {field("magnetic", "Magnetic frame (EGP)", "cost-magnetic")}
        <div>
          <label htmlFor="cost-from" className={lbl}>Applies from</label>
          <input id="cost-from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} className={input} />
        </div>
      </div>
      <p className="mt-3 text-xs text-ink-faint">Prices stay in force until you change them — earlier days keep the prices they had.</p>
      <div className="mt-3"><FormError>{error}</FormError></div>
      <Button className="mt-3" size="sm" loading={busy} data-testid="costs-save"
        onClick={async () => {
          setBusy(true);
          setError(null);
          try {
            if (sheetsPerBox !== paper.sheetsPerBox)
              await savePaperSettings({ sheetsPerPack: paper.sheetsPerPack, sheetsPerBox: sheetsPerBox ?? 0 });
            await saveCosts(costs, { from, ...v });
            toast(`Costs saved — apply from ${dayText(from)}`, "success");
          } catch (e) {
            setError(authErrorMessage(e));
          } finally {
            setBusy(false);
          }
        }}>
        Save costs
      </Button>
      {costs.length > 0 && (
        <ul className="mt-4 flex flex-col gap-1 border-t border-line pt-3 text-xs text-ink-muted">
          {[...costs].sort((a, b) => b.from.localeCompare(a.from)).map((c) => (
            <li key={c.from}>
              From {dayText(c.from)}: box {c.paperBox == null ? "—" : egp(c.paperBox)}
              {c.cartridgesPerBox != null && ` (${fmtNum(c.cartridgesPerBox)} cartridge${c.cartridgesPerBox === 1 ? "" : "s"})`} ·
              acrylic {c.acrylic == null ? "—" : egp(c.acrylic)} · magnetic {c.magnetic == null ? "—" : egp(c.magnetic)}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

/* ─────────────── Daily summary email ─────────────── */
export function EmailCard() {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);
  return (
    <Card padding="lg" data-testid="email-card">
      <CardHeader title="Daily summary email" subtitle="Every morning at 9:00 (Cairo): yesterday's revenue & profit, shifts, month so far and alerts"
        action={<Mail className="size-5 text-ink-faint" />} />
      <Button size="sm" variant="secondary" loading={busy} data-testid="email-test"
        onClick={async () => {
          setBusy(true);
          setResult(null);
          try {
            const token = await firebase().auth.currentUser?.getIdToken();
            const res = await fetch("/api/daily-summary", { method: "POST", headers: { Authorization: `Bearer ${token ?? ""}` } });
            const body = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(body.error || `Failed (${res.status})`);
            setResult({ ok: true, text: `Sent to ${body.to} — summary of ${dayText(body.about)}` });
            toast("Test email sent", "success");
          } catch (e) {
            setResult({ ok: false, text: (e as Error).message });
          } finally {
            setBusy(false);
          }
        }}>
        Send test email now
      </Button>
      {result && (
        <p data-testid="email-result" className={cn("mt-3 text-sm", result.ok ? "text-success" : "text-danger")}>{result.text}</p>
      )}
    </Card>
  );
}
