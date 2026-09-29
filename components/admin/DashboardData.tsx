"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { watchDashboard } from "@/lib/admin/firestore";
import { parseStoredRange } from "@/lib/admin/range";
import { watchCosts, watchExpenses, watchFees, watchRecurring } from "@/lib/pnl/firestore";
import type { CostStep } from "@/lib/pnl/costs";
import type { FeeStep } from "@/lib/pnl/fees";
import type { Expense, RecurringExpense } from "@/lib/pnl/types";
import { scopeDashboard, type DateRange, type RawDashboard, type Scope, type ScopedDashboard } from "@/lib/admin/scope";
import { DEFAULT_SHEETS_PER_BOX, DEFAULT_SHEETS_PER_PACK, type PaperSettings } from "@/lib/shift/paper";
import { ensureStockDocs, watchEventLogs, watchEventStock } from "@/lib/inventory/firestore";
import { emptyInventory, STOCK_TYPES } from "@/lib/inventory/types";
import { scopeInventory, type ScopedInventory } from "@/lib/inventory/scope";
import type { EventInventory, EventRecord } from "@/lib/inventory/types";
import { authErrorMessage } from "@/lib/auth/errors";

/*
 * Dashboard state:
 *  - scope (Global / event id) + date range — the global switcher, persisted per browser
 *  - raw live data (one set of listeners for the whole dashboard)
 *  - scoped data = scopeDashboard(raw, scope, range) — what sections render
 */

const STORAGE_KEY = "bl.admin.scope.v1";

type Ctx = {
  scope: Scope;
  setScope: (s: Scope) => void;
  range: DateRange;
  setRange: (r: DateRange) => void;
  raw: RawDashboard;
  scoped: ScopedDashboard;
  events: EventRecord[];
  paper: PaperSettings;
  inventories: Map<string, EventInventory>;
  inventory: ScopedInventory;
  expenses: Expense[];
  recurring: RecurringExpense[];
  fees: FeeStep[];
  costs: CostStep[];
  pnlLoaded: boolean;
  loaded: boolean;
  error: string | null;
};

const DashboardContext = createContext<Ctx | null>(null);

function readStored(): { scope: Scope; range: DateRange } {
  try {
    const v = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null");
    const range = parseStoredRange(v?.range);
    if (v && typeof v.scope === "string" && range) return { scope: v.scope, range };
  } catch {
    // storage blocked / corrupt — use defaults
  }
  return { scope: "global", range: "week" };
}

export function DashboardDataProvider({ children }: { children: ReactNode }) {
  const [pref, setPref] = useState<{ scope: Scope; range: DateRange }>(() =>
    typeof window === "undefined" ? { scope: "global", range: "week" } : readStored(),
  );
  const [raw, setRaw] = useState<RawDashboard>({
    users: [], shifts: [], entries: [], events: [], sheetsPerPack: DEFAULT_SHEETS_PER_PACK,
  });
  const [events, setEvents] = useState<EventRecord[]>([]);
  const [paper, setPaper] = useState<PaperSettings>({ sheetsPerPack: DEFAULT_SHEETS_PER_PACK, sheetsPerBox: DEFAULT_SHEETS_PER_BOX });
  const [inventories, setInventories] = useState<Map<string, EventInventory>>(new Map());
  const [loadedKeys, setLoadedKeys] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [recurring, setRecurring] = useState<RecurringExpense[]>([]);
  const [fees, setFees] = useState<FeeStep[]>([]);
  const [costs, setCosts] = useState<CostStep[]>([]);

  // P&L data (admin-only collections).
  useEffect(() => {
    const mark = (k: string) => setLoadedKeys((s) => (s.has(k) ? s : new Set(s).add(k)));
    const u1 = watchExpenses((e) => { setExpenses(e); mark("expenses"); }, (e) => setError(`Expenses: ${authErrorMessage(e)}`));
    const u2 = watchRecurring((r) => { setRecurring(r); mark("recurring"); }, (e) => setError(`Recurring expenses: ${authErrorMessage(e)}`));
    const u3 = watchFees(setFees, (e) => setError(`Card fees: ${authErrorMessage(e)}`));
    const u4 = watchCosts(setCosts, (e) => setError(`Product costs: ${authErrorMessage(e)}`));
    return () => { u1(); u2(); u3(); u4(); };
  }, []);

  useEffect(() => {
    const mark = (k: string) => setLoadedKeys((s) => (s.has(k) ? s : new Set(s).add(k)));
    return watchDashboard({
      users: (users) => { setRaw((r) => ({ ...r, users })); mark("users"); },
      shifts: (shifts) => { setRaw((r) => ({ ...r, shifts })); mark("shifts"); },
      entries: (entries) => { setRaw((r) => ({ ...r, entries })); mark("entries"); },
      events: (evs) => { setEvents(evs); setRaw((r) => ({ ...r, events: evs })); mark("events"); },
      paperSettings: (p) => { setPaper(p); setRaw((r) => ({ ...r, sheetsPerPack: p.sheetsPerPack })); },
      error: (label, e) => setError(`${label}: ${authErrorMessage(e)}`),
    });
  }, []);

  // Per-event inventory listeners (stock + logs), re-subscribed when the set of events changes.
  const eventIdsKey = events.map((e) => e.id).join("|");
  const sheetsPerBox = paper.sheetsPerBox;
  useEffect(() => {
    const ids = eventIdsKey ? eventIdsKey.split("|") : [];
    const patch = (id: string, p: Partial<EventInventory>) =>
      setInventories((m) => {
        const next = new Map(m);
        next.set(id, { ...(next.get(id) ?? emptyInventory()), ...p });
        return next;
      });
    const initialised = new Set<string>();
    const unsubs = ids.flatMap((id) => [
      watchEventStock(id, ({ fromServer, ...stock }) => {
        patch(id, stock);
        // Older events (before ink/frames were tracked) get their missing stock docs on first load.
        if (fromServer && STOCK_TYPES.some((t) => !stock[t]) && !initialised.has(id)) {
          initialised.add(id);
          ensureStockDocs(id, sheetsPerBox).catch((e) => setError(`Inventory setup: ${authErrorMessage(e)}`));
        }
      }),
      watchEventLogs(id, (logs) => patch(id, { logs })),
    ]);
    return () => unsubs.forEach((u) => u());
  }, [eventIdsKey, sheetsPerBox]);

  // Clock for the stock forecast window; refreshed every 5 minutes.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 5 * 60_000);
    return () => clearInterval(t);
  }, []);

  const loaded = ["users", "shifts", "entries", "events"].every((k) => loadedKeys.has(k));

  // A selected event that no longer exists falls back to Global.
  const scope: Scope =
    pref.scope !== "global" && loadedKeys.has("events") && !raw.events.some((e) => e.id === pref.scope)
      ? "global"
      : pref.scope;

  const update = (next: { scope: Scope; range: DateRange }) => {
    setPref(next);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // ignore — preference just won't persist
    }
  };

  const scoped = useMemo(() => scopeDashboard(raw, scope, pref.range), [raw, scope, pref.range]);
  // Inventory is NOT date-ranged (stock is a current quantity); only the event scope applies.
  const inventory = useMemo(
    () => scopeInventory(events, inventories, raw.shifts, scope, now),
    [events, inventories, raw.shifts, scope, now],
  );

  const value: Ctx = {
    scope,
    setScope: (s) => update({ scope: s, range: pref.range }),
    range: pref.range,
    setRange: (r) => update({ scope, range: r }),
    raw,
    scoped,
    events,
    paper,
    inventories,
    inventory,
    expenses,
    recurring,
    fees,
    costs,
    pnlLoaded: loadedKeys.has("expenses") && loadedKeys.has("recurring"),
    loaded,
    error,
  };
  return <DashboardContext.Provider value={value}>{children}</DashboardContext.Provider>;
}

function useDashboard() {
  const ctx = useContext(DashboardContext);
  if (!ctx) throw new Error("Must be used inside <DashboardDataProvider>");
  return ctx;
}

/** The switcher's state (top bar). */
export function useDashboardScope() {
  const { scope, setScope, range, setRange, events } = useDashboard();
  const scopeName = scope === "global" ? "Global" : events.find((e) => e.id === scope)?.name ?? "Event";
  return { scope, setScope, range, setRange, events, scopeName };
}

/** Scoped data — the ONLY data source for Overview, Staff, Shifts and Staff history. */
export function useScopedDashboard() {
  const { scoped, loaded, error, events } = useDashboard();
  return { ...scoped, events, loaded, error };
}

/** Pending approvals ONLY — deliberately unscoped (always global, per spec). */
export function usePendingUsers() {
  const { raw } = useDashboard();
  return raw.users.filter((u) => !u.approved).sort((a, b) => (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0));
}

/** Inventory under the switcher (Global = every location; event = that one) + paper units. */
export function useScopedInventory() {
  const { inventory, events, paper, raw, scope } = useDashboard();
  return { ...inventory, events, paper, scope, shifts: raw.shifts, entries: raw.entries };
}

/** Full event records (Events management screen). */
export function useEvents() {
  const { events, raw } = useDashboard();
  return { events, users: raw.users };
}

/**
 * Raw (unscoped) data + the current scope — ONLY for computations that must look outside
 * the selected date range but still apply the same scoping rules (e.g. "vs last period"
 * and the location comparison in Statistics). Sections should use useScopedDashboard.
 */
export function useDashboardRaw() {
  const { raw, scope, range } = useDashboard();
  return { raw, scope, range };
}

/** P&L inputs: every expense (scoped inside lib/pnl) + the raw dashboard + the switcher state. */
export function usePnl() {
  const { raw, scope, range, events, expenses, recurring, fees, costs, paper, pnlLoaded } = useDashboard();
  return { raw, scope, range, events, expenses, recurring, fees, costs, paper, pnlLoaded };
}
