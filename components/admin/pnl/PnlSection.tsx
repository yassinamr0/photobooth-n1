"use client";

import { useMemo, useState } from "react";
import { ArrowDownRight, ArrowUpRight, CalendarRange, Info, Minus, Pencil, Plus, Repeat, Trash2 } from "lucide-react";
import { Card, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Tag } from "@/components/ui/Tag";
import { FormError } from "@/components/ui/Field";
import { useToast } from "@/components/ui/Toast";
import { useAuth } from "@/components/auth/AuthProvider";
import { NumberInput } from "@/components/shift/Stepper";
import { cn } from "@/lib/cn";
import { SegThumb } from "@/components/ui/Segmented";
import { authErrorMessage } from "@/lib/auth/errors";
import { dayKey, parseDay, rangeLabel } from "@/lib/admin/range";
import { formatEGP } from "@/lib/format";
import { pct } from "@/lib/stats/waste";
import { pnlByLocation, pnlSummary, pnlTrend, type PnlCategory, type PnlSummary } from "@/lib/pnl/pnl";
import { BreakEvenCard, CostsCard, EmailCard, FeesCard, ProductsCard } from "./PnlExtras";
import { currentAmount, isActive, monthKey } from "@/lib/pnl/recurring";
import {
  addExpense, addRecurring, changeRecurringAmount, deleteExpense, deleteRecurring, setRecurringEnd, updateExpense,
  type ExpenseInput,
} from "@/lib/pnl/firestore";
import { CATEGORY_LABEL, EXPENSE_CATEGORIES, type Expense, type ExpenseCategory, type RecurringExpense } from "@/lib/pnl/types";
import { useDashboardScope, usePnl } from "../DashboardData";
import { PnlChart } from "./PnlChart";
import { ExpenseDonut } from "./ExpenseDonut";
import { eventSpan } from "@/lib/pnl/eventSpan";

/** Whole pounds for display (spread rent produces fractions). */
const egp = (n: number) => formatEGP(Math.round(n));
const monthLabel = (m: string) => parseDay(`${m}-01`).toLocaleDateString("en-US", { month: "short", year: "numeric" });

const input =
  "h-11 w-full min-w-0 rounded-inner border border-white/[0.06] well px-3 text-sm text-ink outline-none [color-scheme:dark] focus:border-magenta/70";
const lbl = "mb-1.5 block text-xs font-medium tracking-wide text-ink-faint uppercase";

/**
 * P&L: revenue (same as Overview) − expenses = profit, for the selected event (or Global) and
 * date range. Expenses: one-off (on their date) and monthly (spread over each month's days).
 */
export function PnlSection() {
  const p = usePnl();
  const { scopeName } = useDashboardScope();
  const [now] = useState(() => new Date());
  const inp = useMemo(
    () => ({ raw: p.raw, expenses: p.expenses, recurring: p.recurring, fees: p.fees, costs: p.costs, sheetsPerBox: p.paper.sheetsPerBox }),
    [p.raw, p.expenses, p.recurring, p.fees, p.costs, p.paper.sheetsPerBox],
  );
  const summary = useMemo(() => pnlSummary(inp, p.scope, p.range, now), [inp, p.scope, p.range, now]);
  const trend = useMemo(() => pnlTrend(inp, p.scope, p.range, now), [inp, p.scope, p.range, now]);
  const rows = useMemo(() => (p.scope === "global" ? pnlByLocation(inp, p.range, now) : []), [inp, p.scope, p.range, now]);
  const label = `${scopeName} · ${rangeLabel(p.range)}`;

  return (
    <div className="flex flex-col gap-5" data-testid="section-pnl">
      <Headline s={summary} label={label} />
      <div className="grid gap-5 xl:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <Categories s={summary} />
        <Card padding="lg">
          <CardHeader title="Revenue vs expenses" subtitle={`Per period · ${label}`} />
          {summary.revenue === 0 && summary.expenses.total === 0 ? (
            <Empty>Nothing earned or spent in this range.</Empty>
          ) : (
            <PnlChart points={trend} />
          )}
        </Card>
      </div>
      <BreakEvenCard inp={inp} now={now} label={label} />
      <ProductsCard inp={inp} now={now} label={label} />
      {p.scope === "global" && <LocationTable rows={rows} rangeText={rangeLabel(p.range)} />}
      <ExpenseManager s={summary} label={label} />
      <div className="grid gap-5 xl:grid-cols-2">
        {/* Remount when the saved settings arrive/change so the forms start from them. */}
        <FeesCard key={`fees-${JSON.stringify(p.fees)}`} />
        <CostsCard key={`costs-${JSON.stringify(p.costs)}-${p.paper.sheetsPerBox}`} />
        <EmailCard />
      </div>
      <p className="flex items-start gap-2 text-xs text-ink-faint">
        <Info className="mt-px size-3.5 shrink-0" />
        Monthly expenses are spread evenly over the days of each month, so any range gets its fair share. Everything counts up to
        today. Revenue is the same figure as Overview. The optional cost staff type on a hadr waste entry isn&apos;t counted — that
        paper is already paid for through stock purchases.
      </p>
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="empty-state">{children}</p>;
}

/* ─────────────── Headline ─────────────── */
function Headline({ s, label }: { s: PnlSummary; label: string }) {
  const loss = s.profit < -0.5;
  return (
    <Card padding="lg" data-testid="pnl-headline">
      <CardHeader title="Profit & loss" subtitle={label} />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Tile label="Revenue" value={egp(s.revenue)} testid="pnl-revenue" className="text-gold" tint="gold" />
        <Tile label="Expenses" value={egp(s.expenses.total)} testid="pnl-expenses" className="text-ink" tint="loss" />
        <Tile label={loss ? "Net loss" : "Net profit"} value={`${loss ? "−" : ""}${egp(Math.abs(s.profit))}`} testid="pnl-profit"
          className={loss ? "text-danger" : "text-success"} highlight={loss ? "loss" : "profit"} />
        <Tile label="Margin" value={s.margin == null ? "—" : pct(s.margin)} testid="pnl-margin" className="text-ink"
          hint={s.margin == null ? "no revenue" : "profit ÷ revenue"} />
      </div>
      {s.previous && <Compare s={s} />}
    </Card>
  );
}

// Bento tiles tinted with their meaning colour (same language as the Overview KPIs).
function Tile({ label, value, testid, className, hint, highlight, tint }: {
  label: string; value: string; testid: string; className?: string; hint?: string; highlight?: "profit" | "loss"; tint?: "gold" | "loss";
}) {
  return (
    <div className={cn("rounded-[8px] border px-4 py-3.5 shadow-[inset_0_1px_0_rgb(255_255_255/0.05)]",
      highlight === "loss" ? "border-danger/30 bg-danger/[0.08]" : highlight === "profit" ? "border-success/25 bg-success/[0.07]"
        : tint === "gold" ? "border-gold/20 bg-gold/[0.06]" : tint === "loss" ? "border-danger/15 bg-danger/[0.04]" : "border-white/[0.07] bg-white/[0.025]")}>
      <div className="mb-1.5 text-[13px] font-medium text-ink-muted">{label}</div>
      <div data-testid={testid} className={cn("font-display text-[1.7rem] leading-none font-bold tracking-[-0.03em] tabular-nums", className)}>{value}</div>
      {hint && <div className="text-[11px] text-ink-faint">{hint}</div>}
    </div>
  );
}

function Compare({ s }: { s: PnlSummary }) {
  const prev = s.previous!;
  const diff = s.profit - prev.profit;
  const up = diff > 0.5;
  const down = diff < -0.5;
  const Icon = up ? ArrowUpRight : down ? ArrowDownRight : Minus;
  return (
    <p data-testid="pnl-compare" className="mt-4 flex flex-wrap items-center gap-2 text-sm text-ink-muted">
      <span className={cn("inline-flex items-center gap-1 rounded-inner border px-2.5 py-1 font-semibold",
        up ? "border-success/40 bg-success-dim text-success" : down ? "border-danger/40 bg-danger-dim text-danger" : "border-line bg-surface-2 text-ink")}>
        <Icon className="size-4" />
        {up ? "+" : down ? "−" : ""}{egp(Math.abs(diff))} profit
      </span>
      vs {prev.label}: profit {prev.profit < 0 ? "−" : ""}{egp(Math.abs(prev.profit))} · revenue {egp(prev.revenue)} · expenses {egp(prev.expenses)}
    </p>
  );
}

/* ─────────────── Expenses by category ─────────────── */
// Expenses are "money out" (red family): one warm ramp so the slices read as one meaning,
// the legend carries the exact numbers.
const SLICE_COLORS = ["#ff5c6c", "#ff9a6b", "#f5c06a", "#d9667f", "#a8505c", "#ffb3ba", "#7d3a44"];

function Categories({ s }: { s: PnlSummary }) {
  const cats = ([...EXPENSE_CATEGORIES, "cardFees"] as PnlCategory[])
    .map((c) => ({ c, v: s.expenses.byCategory[c] }))
    .filter((x) => x.v > 0.004)
    .sort((a, b) => b.v - a.v);
  const slices = cats.map(({ c, v }, i) => ({
    key: c, value: v, color: SLICE_COLORS[i % SLICE_COLORS.length],
    label: c === "cardFees" ? "Card fees" : CATEGORY_LABEL[c],
  }));
  return (
    <Card padding="lg" data-testid="pnl-categories">
      <CardHeader title="Expenses by category" subtitle={`Total ${egp(s.expenses.total)}`} />
      {cats.length === 0 ? (
        <Empty>No expenses in this range.</Empty>
      ) : (
        <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-center">
          <ExpenseDonut slices={slices} total={s.expenses.total} centerLabel={egp(s.expenses.total)} />
          <ul className="flex w-full min-w-0 flex-1 flex-col gap-2.5">
            {cats.map(({ c, v }, i) => (
              <li key={c} data-testid="pnl-category" className="flex items-center gap-3 text-sm">
                <span aria-hidden className="size-3 shrink-0 rounded-[3px]" style={{ background: slices[i].color }} />
                <span className="min-w-0 flex-1 truncate text-ink">
                  {c === "cardFees" ? <>Card fees <span className="text-xs text-ink-faint">(automatic)</span></> : CATEGORY_LABEL[c]}
                </span>
                <span className="shrink-0 tabular-nums text-ink-muted">
                  <b className="font-semibold text-ink">{egp(v)}</b> · {pct(v / s.expenses.total)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  );
}

/* ─────────────── Per location (Global) ─────────────── */
function LocationTable({ rows, rangeText }: { rows: ReturnType<typeof pnlByLocation>; rangeText: string }) {
  const th = "py-2 pl-4 text-right font-medium whitespace-nowrap";
  const td = "py-3 pl-4 text-right tabular-nums";
  const sum = rows.reduce((a, r) => ({ revenue: a.revenue + r.revenue, expenses: a.expenses + r.expenses }), { revenue: 0, expenses: 0 });
  return (
    <Card padding="lg">
      <CardHeader title="By location" subtitle={`Each row is that location's own P&L · ${rangeText}`} />
      {rows.length === 0 ? (
        <Empty>Create events to see profit per location.</Empty>
      ) : (
        <div className="-mx-2 overflow-x-auto px-2">
          <table data-testid="pnl-locations" className="w-full min-w-[620px] text-left text-sm">
            <thead className="text-xs text-ink-faint uppercase">
              <tr>
                <th className="py-2 font-medium">Location</th>
                <th className={th}>Revenue</th>
                <th className={th}>Expenses</th>
                <th className={th}>Profit</th>
                <th className={th}>Margin</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map((r) => (
                <tr key={r.id ?? r.name} data-testid="pnl-location-row">
                  <td className="py-3 font-semibold text-ink">
                    {r.name}
                    {r.id === null && (
                      <span className="ml-1 text-xs font-normal text-ink-faint">
                        {r.name === "General" ? "(costs not tied to a booth)" : "(shifts with no event)"}
                      </span>
                    )}
                  </td>
                  <td className={cn(td, "text-gold")}>{egp(r.revenue)}</td>
                  <td className={td}>{egp(r.expenses)}</td>
                  <td data-testid="pnl-location-profit" className={cn(td, "font-semibold", r.profit < -0.5 ? "text-danger" : "text-success")}>
                    {r.profit < -0.5 ? "−" : ""}{egp(Math.abs(r.profit))}
                  </td>
                  <td className={cn(td, "text-ink-muted")}>{r.margin == null ? "—" : pct(r.margin)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot className="border-t border-line-strong">
              <tr className="font-semibold">
                <td className="py-3 text-ink">Total</td>
                <td className={cn(td, "text-gold")}>{egp(sum.revenue)}</td>
                <td className={td}>{egp(sum.expenses)}</td>
                <td className={cn(td, sum.revenue - sum.expenses < -0.5 ? "text-danger" : "text-success")}>
                  {sum.revenue - sum.expenses < -0.5 ? "−" : ""}{egp(Math.abs(sum.revenue - sum.expenses))}
                </td>
                <td className={td} />
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </Card>
  );
}

/* ─────────────── Expense entry + lists ─────────────── */
function ExpenseManager({ s, label }: { s: PnlSummary; label: string }) {
  const p = usePnl();
  const [now] = useState(() => new Date());
  const eventName = (id: string | null) => (id ? p.events.find((e) => e.id === id)?.name ?? "Unknown event" : "General");
  // Monthly expenses that apply to this scope (all of them under Global).
  const recurring = p.recurring
    .filter((r) => p.scope === "global" || r.eventId === p.scope)
    .sort((a, b) => Number(isActive(b, now)) - Number(isActive(a, now)) || a.startMonth.localeCompare(b.startMonth));
  const shareOf = new Map(s.expenses.recurring.map((x) => [x.r.id, x.amount]));

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
      <AddExpense />
      <div className="flex min-w-0 flex-col gap-5">
        <Card padding="lg" data-testid="pnl-monthly">
          <CardHeader title="Monthly expenses" subtitle="Rent, salaries… spread over each month's days" />
          {recurring.length === 0 ? (
            <Empty>No monthly expenses yet.</Empty>
          ) : (
            <ul className="flex flex-col divide-y divide-line">
              {recurring.map((r) => (
                <RecurringRow key={r.id} r={r} where={eventName(r.eventId)} share={shareOf.get(r.id) ?? 0} now={now} />
              ))}
            </ul>
          )}
        </Card>
        <Card padding="lg" data-testid="pnl-oneoffs">
          <CardHeader title="One-off expenses" subtitle={label} />
          {s.expenses.oneOffs.length === 0 ? (
            <Empty>No one-off expenses in this range.</Empty>
          ) : (
            <ul className="flex flex-col divide-y divide-line">
              {s.expenses.oneOffs.map((e) => <OneOffRow key={e.id} e={e} where={eventName(e.eventId)} counted={s.expenses.oneOffAmounts[e.id] ?? e.amount} />)}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}

function LocationSelect({ id, value, onChange }: { id: string; value: string; onChange: (v: string) => void }) {
  const { events } = usePnl();
  return (
    <select id={id} value={value} onChange={(e) => onChange(e.target.value)} className={input}>
      <option value="">Choose…</option>
      {events.map((ev) => <option key={ev.id} value={ev.id}>{ev.name}{ev.status === "inactive" ? " (ended)" : ""}</option>)}
      <option value="general">General (not tied to one booth)</option>
    </select>
  );
}

function CategorySelect({ id, value, onChange }: { id: string; value: ExpenseCategory; onChange: (v: ExpenseCategory) => void }) {
  return (
    <select id={id} value={value} onChange={(e) => onChange(e.target.value as ExpenseCategory)} className={input}>
      {EXPENSE_CATEGORIES.map((c) => <option key={c} value={c}>{CATEGORY_LABEL[c]}</option>)}
    </select>
  );
}

const toEventId = (v: string) => (v === "general" ? null : v);
const fromEventId = (id: string | null) => id ?? "general";

const spanDaysOf = (s: ReturnType<typeof eventSpan>) => Math.max(1, Math.round((parseDay(s.endDate!).getTime() - parseDay(s.startDate!).getTime()) / 86_400_000) + 1);
const dateLabel = (k: string) => parseDay(k).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

function AddExpense() {
  const { scope, raw } = usePnl();
  const { profile } = useAuth();
  const toast = useToast();
  const [kind, setKind] = useState<"once" | "monthly" | "event">("once");
  const [where, setWhere] = useState(scope === "global" ? "" : scope);
  const [category, setCategory] = useState<ExpenseCategory>("other");
  const [amount, setAmount] = useState<number | null>(null);
  const [date, setDate] = useState(() => dayKey(new Date()));
  const [month, setMonth] = useState(() => monthKey(new Date()));
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // The chosen event's dates (whole-event expenses need both ends; monthly ones start on its start).
  const span = where && where !== "general" ? eventSpan(raw, where) : null;
  const eventReady = !!span?.startDate && !!span?.endDate;

  async function submit() {
    if (!where) return setError("Choose a location (or General).");
    if (kind === "event" && where === "general") return setError("A whole-event expense needs an event, not General.");
    if (kind === "event" && !eventReady) return setError("This event has no end date yet — use Monthly, or set its end date in Events.");
    if (!amount || amount <= 0) return setError("Enter an amount above 0.");
    setBusy(true);
    setError(null);
    try {
      if (kind === "once") await addExpense({ eventId: toEventId(where), date, amount, category, note }, profile?.uid ?? "");
      else if (kind === "event") await addExpense({ eventId: toEventId(where), date: span!.startDate!, amount, category, note, spread: "event" }, profile?.uid ?? "");
      else await addRecurring({ eventId: toEventId(where), category, note, startMonth: month, amount }, profile?.uid ?? "");
      toast(kind === "once" ? "Expense added" : kind === "event" ? "Event expense added" : "Monthly expense added", "success");
      setAmount(null);
      setNote("");
    } catch (e) {
      setError(authErrorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card padding="lg" data-testid="pnl-add" className="self-start">
      <CardHeader title="Add an expense" />
      <div role="tablist" aria-label="Expense type" className="mb-4 flex gap-1 relative rounded-inner border border-white/[0.06] well p-1">
        <SegThumb />
        {([["once", "One-off"], ["monthly", "Monthly"], ["event", "Whole event"]] as const).map(([k, l]) => (
          <button key={k} type="button" role="tab" aria-selected={kind === k} data-testid={`add-${k}`} onClick={() => setKind(k)}
            className={cn("relative z-[1] h-8 flex-1 rounded-inner px-3 text-sm font-semibold transition-colors", kind === k ? "text-on-primary" : "text-ink-muted hover:text-ink")}>
            {k === "monthly" && <Repeat className="mr-1.5 inline size-3.5 -translate-y-px" />}{l}
          </button>
        ))}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="exp-where" className={lbl}>Location</label>
          <LocationSelect id="exp-where" value={where} onChange={setWhere} />
        </div>
        <div>
          <label htmlFor="exp-category" className={lbl}>Category</label>
          <CategorySelect id="exp-category" value={category} onChange={setCategory} />
        </div>
        <div>
          <label htmlFor="exp-amount" className={lbl}>{kind === "once" ? "Amount (EGP)" : kind === "event" ? "Total for the event (EGP)" : "Per month (EGP)"}</label>
          <NumberInput id="exp-amount" value={amount} onChange={setAmount} className="h-11 text-base" />
        </div>
        <div>
          {kind === "once" ? (
            <>
              <label htmlFor="exp-date" className={lbl}>Date</label>
              <input id="exp-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} className={input} />
            </>
          ) : kind === "event" ? (
            <>
              <span className={lbl}>Event dates</span>
              <p data-testid="exp-event-dates" className="flex h-11 items-center gap-2 text-sm text-ink">
                <CalendarRange className="size-4 shrink-0 text-ink-faint" />
                {!span ? <span className="text-ink-faint">Choose an event</span>
                  : eventReady ? `${dateLabel(span.startDate!)} – ${dateLabel(span.endDate!)}`
                    : <span className="text-warning">No end date yet</span>}
              </p>
            </>
          ) : (
            <>
              <label htmlFor="exp-month" className={lbl}>Starting month</label>
              <input id="exp-month" type="month" value={month} onChange={(e) => setMonth(e.target.value)} className={input} />
            </>
          )}
        </div>
        <div className="sm:col-span-2">
          <label htmlFor="exp-note" className={lbl}>Note (optional)</label>
          <input id="exp-note" value={note} onChange={(e) => setNote(e.target.value)} placeholder={kind === "once" ? "e.g. 3 boxes of paper" : "e.g. booth rent"} className={input} />
        </div>
      </div>
      {kind === "monthly" && (
        <p className="mt-3 text-xs text-ink-faint">
          Counts every month from {monthLabel(month)} until you stop it, spread evenly over each month&apos;s days
          {span?.startDate && <> — and only while this event runs ({dateLabel(span.startDate)} → {span.endDate ? dateLabel(span.endDate) : "ongoing"}), so it stops by itself when you mark the event as ended</>}.
        </p>
      )}
      {kind === "event" && (
        <p className="mt-3 text-xs text-ink-faint">
          {span && !eventReady
            ? "This event is ongoing, so there's nothing to divide by yet. Use Monthly for rent you pay every month, or set its end date in Events."
            : span && amount
              ? <>Split evenly over the event&apos;s {spanDaysOf(span)} days: <b className="text-ink">{egp(amount / spanDaysOf(span))}</b> a day. If you change the event&apos;s dates, the split follows.</>
              : "One amount for the whole booking (e.g. the event fee), split evenly over the event's days."}
        </p>
      )}
      <div className="mt-3"><FormError>{error}</FormError></div>
      <Button className="mt-3 w-full" loading={busy} leftIcon={<Plus className="size-4" />} onClick={submit} data-testid="exp-save">
        {kind === "once" ? "Add expense" : kind === "event" ? "Add event expense" : "Add monthly expense"}
      </Button>
    </Card>
  );
}

function OneOffRow({ e, where, counted }: { e: Expense; where: string; counted: number }) {
  const { raw } = usePnl();
  const span = e.spread === "event" && e.eventId ? eventSpan(raw, e.eventId) : null;
  const toast = useToast();
  const [editing, setEditing] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [draft, setDraft] = useState<ExpenseInput>({ eventId: e.eventId, date: e.date, amount: e.amount, category: e.category, note: e.note, ...(e.spread ? { spread: e.spread } : {}) });
  const [busy, setBusy] = useState(false);

  if (editing) {
    return (
      <li className="grid gap-2 py-3 sm:grid-cols-2" data-testid="oneoff-edit">
        <LocationSelect id={`w-${e.id}`} value={fromEventId(draft.eventId)} onChange={(v) => setDraft({ ...draft, eventId: toEventId(v) })} />
        <CategorySelect id={`c-${e.id}`} value={draft.category} onChange={(v) => setDraft({ ...draft, category: v })} />
        <NumberInput id={`a-${e.id}`} aria-label="Amount" value={draft.amount} onChange={(v) => setDraft({ ...draft, amount: v ?? 0 })} className="h-11 text-base" />
        {e.spread === "event"
          ? <p className="flex items-center text-xs text-ink-faint">Split over the event&apos;s dates (change them in Events)</p>
          : <input type="date" aria-label="Date" value={draft.date} onChange={(ev) => setDraft({ ...draft, date: ev.target.value })} className={input} />}
        <input aria-label="Note" value={draft.note} onChange={(ev) => setDraft({ ...draft, note: ev.target.value })} className={cn(input, "sm:col-span-2")} placeholder="Note" />
        <div className="flex gap-2 sm:col-span-2">
          <Button size="sm" variant="secondary" onClick={() => setEditing(false)}>Cancel</Button>
          <Button size="sm" loading={busy} onClick={async () => {
            setBusy(true);
            try {
              await updateExpense(e.id, draft);
              toast("Expense updated", "success");
              setEditing(false);
            } catch (err) {
              toast(`Could not save: ${authErrorMessage(err)}`, "danger");
            } finally {
              setBusy(false);
            }
          }}>Save</Button>
        </div>
      </li>
    );
  }
  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-1 py-3 text-sm" data-testid="oneoff-row">
      <span className="w-24 shrink-0 text-xs text-ink-faint tabular-nums">
        {span?.startDate && span.endDate
          ? `${parseDay(span.startDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })} – ${parseDay(span.endDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })}`
          : parseDay(e.date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
      </span>
      <Tag tone="neutral">{CATEGORY_LABEL[e.category]}</Tag>
      {e.spread === "event" && <Tag tone="accent">Whole event</Tag>}
      <span className="min-w-0 flex-1 truncate text-ink-muted">{where}{e.note && ` · ${e.note}`}</span>
      <span className="text-right font-semibold text-ink tabular-nums">
        {egp(counted)}
        {Math.abs(counted - e.amount) > 0.5 && <span className="block text-[11px] font-normal text-ink-faint">of {egp(e.amount)} total</span>}
      </span>
      {confirm ? (
        <span className="flex items-center gap-2">
          <Button size="sm" variant="secondary" onClick={() => setConfirm(false)}>Keep</Button>
          <Button size="sm" variant="danger" loading={busy} onClick={async () => {
            setBusy(true);
            try {
              await deleteExpense(e.id);
              toast("Expense deleted", "success");
            } catch (err) {
              toast(`Could not delete: ${authErrorMessage(err)}`, "danger");
              setBusy(false);
            }
          }}>Delete</Button>
        </span>
      ) : (
        <span className="flex items-center gap-1">
          <button type="button" aria-label="Edit expense" onClick={() => setEditing(true)} className="grid size-8 place-items-center rounded-inner text-ink-faint hover:bg-surface-2 hover:text-ink"><Pencil className="size-3.5" /></button>
          <button type="button" aria-label="Delete expense" onClick={() => setConfirm(true)} className="grid size-8 place-items-center rounded-inner text-ink-faint hover:bg-danger-dim hover:text-danger"><Trash2 className="size-3.5" /></button>
        </span>
      )}
    </li>
  );
}

function RecurringRow({ r, where, share, now }: { r: RecurringExpense; where: string; share: number; now: Date }) {
  const toast = useToast();
  const [mode, setMode] = useState<"amount" | "delete" | null>(null);
  const [amount, setAmount] = useState<number | null>(currentAmount(r, now) || null);
  const [from, setFrom] = useState(() => monthKey(now));
  const [busy, setBusy] = useState(false);
  const active = isActive(r, now);
  const thisMonth = monthKey(now);

  async function run(fn: () => Promise<unknown>, ok: string) {
    setBusy(true);
    try {
      await fn();
      toast(ok, "success");
      setMode(null);
    } catch (e) {
      toast(`Could not save: ${authErrorMessage(e)}`, "danger");
    } finally {
      setBusy(false);
    }
  }

  return (
    <li className="py-3 text-sm" data-testid="monthly-row">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <Tag tone={active ? "accent" : "neutral"}>{CATEGORY_LABEL[r.category]}</Tag>
        <span className="min-w-0 flex-1 truncate text-ink">
          {where}{r.note && <span className="text-ink-muted"> · {r.note}</span>}
        </span>
        <span className="font-semibold text-ink tabular-nums">{egp(currentAmount(r, now))}<span className="font-normal text-ink-faint">/mo</span></span>
      </div>
      <p className="mt-1 text-xs text-ink-faint">
        {monthLabel(r.startMonth)} → {r.endMonth ? monthLabel(r.endMonth) : "ongoing"}
        {r.amounts.length > 1 && ` · ${r.amounts.map((a) => `${egp(a.amount)} from ${monthLabel(a.from)}`).join(", ")}`}
        {" · "}<span data-testid="monthly-share" className="text-ink-muted">{egp(share)} in this range</span>
      </p>
      {mode === "amount" ? (
        <div className="mt-2 grid gap-2 rounded-inner border border-line bg-surface-2 p-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
          <div>
            <label htmlFor={`amt-${r.id}`} className={lbl}>New amount / month</label>
            <NumberInput id={`amt-${r.id}`} value={amount} onChange={setAmount} className="h-11 text-base" />
          </div>
          <div>
            <label htmlFor={`from-${r.id}`} className={lbl}>From month</label>
            <input id={`from-${r.id}`} type="month" value={from} min={r.startMonth} onChange={(e) => setFrom(e.target.value)} className={input} />
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="secondary" onClick={() => setMode(null)}>Cancel</Button>
            <Button size="sm" loading={busy} data-testid="monthly-amount-save"
              onClick={() => amount && run(() => changeRecurringAmount(r, from, amount), "Amount updated from " + monthLabel(from))}>Save</Button>
          </div>
          <p className="text-xs text-ink-faint sm:col-span-3">Earlier months keep the amount they had.</p>
        </div>
      ) : mode === "delete" ? (
        <div className="mt-2 flex flex-wrap items-center gap-2 rounded-inner border border-danger/40 bg-danger-dim px-3 py-2 text-xs text-ink-muted">
          <span className="flex-1">Delete removes it from EVERY month, including past P&amp;L. To end it from now on, use Stop instead.</span>
          <Button size="sm" variant="secondary" onClick={() => setMode(null)}>Cancel</Button>
          <Button size="sm" variant="danger" loading={busy} onClick={() => run(() => deleteRecurring(r.id), "Monthly expense deleted")}>Delete</Button>
        </div>
      ) : (
        <div className="mt-2 flex flex-wrap gap-1">
          <Button size="sm" variant="ghost" data-testid="monthly-change" onClick={() => setMode("amount")}>Change amount</Button>
          {!r.endMonth ? (
            <Button size="sm" variant="ghost" loading={busy} data-testid="monthly-stop"
              onClick={() => run(() => setRecurringEnd(r.id, thisMonth < r.startMonth ? r.startMonth : thisMonth), "Stopped — it counts through " + monthLabel(thisMonth))}>
              Stop after this month
            </Button>
          ) : (
            <Button size="sm" variant="ghost" loading={busy} onClick={() => run(() => setRecurringEnd(r.id, null), "Resumed")}>Resume</Button>
          )}
          <Button size="sm" variant="ghost" onClick={() => setMode("delete")}><Trash2 className="size-3.5" /> Delete</Button>
        </div>
      )}
    </li>
  );
}
