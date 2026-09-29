"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { watchDashboard } from "@/lib/admin/firestore";
import { scopeDashboard, type DateRange, type RawDashboard, type Scope, type ScopedDashboard } from "@/lib/admin/scope";
import { DEFAULT_SHEETS_PER_PACK } from "@/lib/shift/paper";
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
  loaded: boolean;
  error: string | null;
};

const DashboardContext = createContext<Ctx | null>(null);

function readStored(): { scope: Scope; range: DateRange } {
  try {
    const v = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null");
    if (v && typeof v.scope === "string" && ["week", "month", "all"].includes(v.range)) return v;
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
  const [loadedKeys, setLoadedKeys] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const mark = (k: string) => setLoadedKeys((s) => (s.has(k) ? s : new Set(s).add(k)));
    return watchDashboard({
      users: (users) => { setRaw((r) => ({ ...r, users })); mark("users"); },
      shifts: (shifts) => { setRaw((r) => ({ ...r, shifts })); mark("shifts"); },
      entries: (entries) => { setRaw((r) => ({ ...r, entries })); mark("entries"); },
      events: (events) => { setRaw((r) => ({ ...r, events })); mark("events"); },
      sheetsPerPack: (sheetsPerPack) => setRaw((r) => ({ ...r, sheetsPerPack })),
      error: (label, e) => setError(`${label}: ${authErrorMessage(e)}`),
    });
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

  const value: Ctx = {
    scope,
    setScope: (s) => update({ scope: s, range: pref.range }),
    range: pref.range,
    setRange: (r) => update({ scope, range: r }),
    raw,
    scoped,
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
  const { scope, setScope, range, setRange, raw } = useDashboard();
  const scopeName = scope === "global" ? "Global" : raw.events.find((e) => e.id === scope)?.name ?? "Event";
  return { scope, setScope, range, setRange, events: raw.events, scopeName };
}

/** Scoped data — the ONLY data source for Overview, Staff, Shifts and Staff history. */
export function useScopedDashboard() {
  const { scoped, loaded, error, raw } = useDashboard();
  return { ...scoped, events: raw.events, loaded, error };
}

/** Pending approvals ONLY — deliberately unscoped (always global, per spec). */
export function usePendingUsers() {
  const { raw } = useDashboard();
  return raw.users.filter((u) => !u.approved).sort((a, b) => (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0));
}
