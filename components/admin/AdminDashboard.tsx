"use client";

import { useState } from "react";
import { BarChart3, Boxes, CalendarClock, Camera, ChevronDown, LayoutGrid, MapPin, UserCheck, Users } from "lucide-react";
import { PanelFrame } from "@/components/layout/PanelFrame";
import { SidebarRail } from "@/components/layout/SidebarRail";
import { Spinner } from "@/components/ui/Button";
import { ToastProvider } from "@/components/ui/Toast";
import { LogoutButton } from "@/components/auth/LogoutButton";
import { useAuth } from "@/components/auth/AuthProvider";
import { cn } from "@/lib/cn";
import type { DateRange } from "@/lib/admin/scope";
import { DashboardDataProvider, useDashboardScope, usePendingUsers, useScopedDashboard } from "./DashboardData";
import { OverviewSection, PendingSection, ShiftsSection, StaffHistoryView, StaffSection, type Section } from "./Sections";
import { InventorySection } from "./InventorySection";
import { EventsSection } from "./EventsSection";
import { StatisticsSection } from "./stats/StatisticsSection";

export function AdminDashboard() {
  return (
    <ToastProvider>
      <DashboardDataProvider>
        <DashboardInner />
      </DashboardDataProvider>
    </ToastProvider>
  );
}

const NAV: { id: Section; label: string; icon: React.ReactNode }[] = [
  { id: "overview", label: "Overview", icon: <LayoutGrid /> },
  { id: "pending", label: "Pending approvals", icon: <UserCheck /> },
  { id: "staff", label: "Staff", icon: <Users /> },
  { id: "shifts", label: "Shifts", icon: <CalendarClock /> },
  { id: "inventory", label: "Inventory", icon: <Boxes /> },
  { id: "statistics", label: "Statistics", icon: <BarChart3 /> },
  { id: "events", label: "Events", icon: <MapPin /> },
];

function DashboardInner() {
  const { profile } = useAuth();
  const { loaded, error } = useScopedDashboard();
  const pending = usePendingUsers();
  const [section, setSection] = useState<Section>("overview");
  const [historyUid, setHistoryUid] = useState<string | null>(null);

  const go = (s: Section) => {
    setHistoryUid(null);
    setSection(s);
  };

  return (
    <PanelFrame
      variant="dashboard"
      sidebar={
        <SidebarRail
          logo={
            <span className="grid size-11 place-items-center rounded-[12px] bg-gold text-[#1a1406]">
              <Camera className="size-5" />
            </span>
          }
          items={NAV.map((n) => ({
            label: n.id === "pending" && pending.length ? `${n.label} (${pending.length})` : n.label,
            icon: (
              <span className="relative">
                {n.icon}
                {n.id === "pending" && pending.length > 0 && (
                  <span className="absolute -top-2 -right-2.5 grid size-4 place-items-center rounded-full bg-pink text-[10px] font-bold text-white">
                    {pending.length}
                  </span>
                )}
              </span>
            ),
            active: section === n.id && !historyUid,
            onClick: () => go(n.id),
          }))}
        />
      }
    >
      <div className="flex flex-col gap-6">
        {/* Top bar — the switcher is ALWAYS visible, above every section */}
        <header className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm text-ink-muted">Admin dashboard</p>
              <h1 className="font-display text-3xl font-extrabold tracking-tight md:text-4xl">
                Hi, <span className="text-accent-gradient">{profile?.name.split(" ")[0] || "admin"}</span>
              </h1>
            </div>
            <LogoutButton />
          </div>
          <ScopeBar section={historyUid ? "staff" : section} />
          {/* Phone-width nav (the rail is hidden below md) */}
          <nav aria-label="Sections" className="-mx-1 flex gap-2 overflow-x-auto px-1 md:hidden">
            {NAV.map((n) => (
              <button key={n.id} type="button" onClick={() => go(n.id)}
                className={cn("h-9 shrink-0 rounded-full border px-4 text-sm font-semibold",
                  section === n.id && !historyUid ? "border-ink bg-ink text-canvas" : "border-line text-ink-muted")}>
                {n.id === "pending" ? `Pending${pending.length ? ` (${pending.length})` : ""}` : n.label}
              </button>
            ))}
          </nav>
        </header>

        {error && <p className="rounded-inner border border-danger/40 bg-danger-dim px-4 py-3 text-sm text-danger">Sync error — {error}</p>}

        {!loaded ? (
          <div className="grid place-items-center py-24"><Spinner className="size-8 border-[3px] text-magenta" /></div>
        ) : historyUid ? (
          <StaffHistoryView uid={historyUid} back={() => setHistoryUid(null)} />
        ) : section === "overview" ? (
          <OverviewSection go={go} />
        ) : section === "pending" ? (
          <PendingSection />
        ) : section === "staff" ? (
          <StaffSection openHistory={(uid) => { setSection("staff"); setHistoryUid(uid); }} />
        ) : section === "inventory" ? (
          <InventorySection />
        ) : section === "events" ? (
          <EventsSection />
        ) : section === "statistics" ? (
          <StatisticsSection />
        ) : (
          <ShiftsSection />
        )}
      </div>
    </PanelFrame>
  );
}

const RANGES: { id: DateRange; label: string }[] = [
  { id: "week", label: "This week" },
  { id: "month", label: "This month" },
  { id: "all", label: "All time" },
];

/** Event scope switcher + date range. Pending approvals ignores both (always global). */
function ScopeBar({ section }: { section: Section }) {
  const { scope, setScope, range, setRange, events, scopeName } = useDashboardScope();
  const note =
    section === "pending"
      ? "Pending approvals always show all locations"
      : section === "events"
        ? "Events list every location"
        : section === "inventory"
          ? null
          : undefined;
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-card border border-line bg-surface px-4 py-3" data-testid="scope-bar">
      <label className="relative flex items-center">
        <span className="sr-only">Event scope</span>
        <MapPin className="pointer-events-none absolute left-3 size-4 text-magenta" />
        <select
          data-testid="event-switcher"
          value={scope}
          onChange={(e) => setScope(e.target.value)}
          className="h-10 appearance-none rounded-full border border-line-strong bg-surface-2 pr-9 pl-9 font-semibold text-ink outline-none focus:border-magenta/70 focus:ring-2 focus:ring-magenta/25"
        >
          <option value="global">Global — all locations</option>
          {events.map((ev) => (
            <option key={ev.id} value={ev.id}>{ev.name}{ev.status === "inactive" ? " (inactive)" : ""}</option>
          ))}
          {/* Saved event while the events list is still loading — avoids flashing "Global". */}
          {scope !== "global" && !events.some((ev) => ev.id === scope) && <option value={scope}>Loading…</option>}
        </select>
        <ChevronDown className="pointer-events-none absolute right-3 size-4 text-ink-faint" />
      </label>
      <div role="tablist" aria-label="Date range" className="flex w-full gap-1 rounded-full border border-line bg-surface-2 p-1 sm:w-auto">
        {RANGES.map((r) => (
          <button key={r.id} type="button" role="tab" aria-selected={range === r.id} onClick={() => setRange(r.id)}
            className={cn("h-8 flex-1 rounded-full px-3 text-sm font-semibold whitespace-nowrap transition-colors sm:flex-none",
              range === r.id ? "bg-ink text-canvas" : "text-ink-muted hover:text-ink")}>
            {r.label}
          </button>
        ))}
      </div>
      <span data-testid="scope-chip" className="ml-auto text-xs text-ink-faint">
        {note ?? (
          <>
            Showing: <span className="text-ink-muted">{scopeName}</span>
            {note === null ? " · current stock (date range doesn't apply)" : ` · ${RANGES.find((r) => r.id === range)?.label}`}
          </>
        )}
      </span>
    </div>
  );
}
