"use client";

import { useState } from "react";
import Image from "next/image";
import { Wallet, BarChart3, Boxes, CalendarClock, CalendarDays, ChevronDown, LayoutGrid, MapPin, UserCheck, Users } from "lucide-react";
import { PanelFrame } from "@/components/layout/PanelFrame";
import { SidebarRail } from "@/components/layout/SidebarRail";
import { ToastProvider } from "@/components/ui/Toast";
import { Spotlight } from "@/components/ui/Spotlight";
import { ThemePicker } from "@/components/ui/ThemePicker";
import { SegThumb } from "@/components/ui/Segmented";
import { LogoutButton } from "@/components/auth/LogoutButton";
import { useAuth } from "@/components/auth/AuthProvider";
import { cn } from "@/lib/cn";
import { isCustom, rangeChip, rangeLabel, type RangePreset } from "@/lib/admin/range";
import { CustomRangePicker } from "./CustomRangePicker";
import { DashboardDataProvider, useDashboardScope, usePendingUsers, useScopedDashboard } from "./DashboardData";
import { OverviewSection, PendingSection, ShiftsSection, StaffHistoryView, StaffSection, type Section } from "./Sections";
import { InventorySection } from "./InventorySection";
import { EventsSection } from "./EventsSection";
import { StatisticsSection } from "./stats/StatisticsSection";
import { PnlSection } from "./pnl/PnlSection";

export function AdminDashboard() {
  return (
    <ToastProvider>
      <Spotlight />
      <DashboardDataProvider>
        <DashboardInner />
      </DashboardDataProvider>
    </ToastProvider>
  );
}

const NAV: { id: Section; label: string; caption: string; icon: React.ReactNode }[] = [
  { id: "overview", label: "Overview", caption: "Overview", icon: <LayoutGrid /> },
  { id: "pending", label: "Pending approvals", caption: "Pending", icon: <UserCheck /> },
  { id: "staff", label: "Staff", caption: "Staff", icon: <Users /> },
  { id: "shifts", label: "Shifts", caption: "Shifts", icon: <CalendarClock /> },
  { id: "inventory", label: "Inventory", caption: "Inventory", icon: <Boxes /> },
  { id: "statistics", label: "Statistics", caption: "Statistics", icon: <BarChart3 /> },
  { id: "pnl", label: "Profit & loss", caption: "P&L", icon: <Wallet /> },
  { id: "events", label: "Events", caption: "Events", icon: <MapPin /> },
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
            <Image src="/icons/icon-192.png" alt="Memoire" width={48} height={48} priority
              data-testid="rail-logo" className="size-12 rounded-inner" />
          }
          items={NAV.map((n) => ({
            label: n.id === "pending" && pending.length ? `${n.label} (${pending.length})` : n.label,
            caption: n.caption,
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
      <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-6 lg:gap-5">
        {/* Top bar — the switcher is ALWAYS visible, above every section.
            Desktop: greeting · switcher · logout in one row. */}
        <header className={cn("flex flex-col gap-4 lg:flex-row lg:items-center",
          // Desktop: a translucent glass bar that stays put while content scrolls under it
          // (apple-design materials) — same elements, same order.
          "lg:sticky lg:top-0 lg:z-20 lg:-mx-8 lg:px-8 lg:py-3 lg:bg-canvas/65 lg:backdrop-blur-xl lg:backdrop-saturate-150",
          "lg:shadow-[0_1px_0_rgb(255_255_255/0.04),0_18px_30px_-24px_rgb(0_0_0/0.9)]")}>
          <div className="flex flex-wrap items-center justify-between gap-3 lg:contents">
            <div className="lg:order-1 lg:shrink-0">
              <h1 className="font-display text-[1.9rem] leading-none font-bold tracking-[-0.03em] lg:text-[1.7rem]">
                Hi, <span className="text-pearl">{profile?.name.split(" ")[0] || "admin"}</span>
              </h1>
            </div>
            <div className="flex items-center gap-1 lg:order-3"><ThemePicker compact /><LogoutButton /></div>
          </div>
          <div className="min-w-0 lg:order-2 lg:flex-1"><ScopeBar section={historyUid ? "staff" : section} /></div>
          {/* Phone-width nav (the rail is hidden below md) */}
          <nav aria-label="Sections" className="flex flex-wrap gap-2 md:hidden">
            {NAV.map((n) => (
              <button key={n.id} type="button" onClick={() => go(n.id)}
                className={cn("h-9 shrink-0 rounded-inner border px-4 text-sm font-semibold",
                  section === n.id && !historyUid ? "key-primary border-transparent bg-maroon text-on-primary" : "border-white/[0.08] bg-white/[0.02] text-ink-muted")}>
                {n.id === "pending" ? `Pending${pending.length ? ` (${pending.length})` : ""}` : n.id === "pnl" ? "P&L" : n.label}
              </button>
            ))}
          </nav>
        </header>

        {error && <p className="rounded-inner border border-danger/40 bg-danger-dim px-4 py-3 text-sm text-danger">Sync error — {error}</p>}

        {/* Re-keyed per section: each switch "develops" in, like a print in the tray. */}
        <div key={historyUid ? `history-${historyUid}` : section} className="animate-develop">
          {!loaded ? (
            <div aria-busy="true" aria-label="Loading" className="flex flex-col gap-5">
              <div className="skeleton h-36" />
              <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
                <div className="skeleton h-80" />
                <div className="skeleton h-40" />
              </div>
            </div>
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
          ) : section === "pnl" ? (
            <PnlSection />
          ) : (
            <ShiftsSection />
          )}
        </div>
      </div>
    </PanelFrame>
  );
}

const RANGES: { id: RangePreset; label: string; short: string }[] = [
  { id: "week", label: "This week", short: "Week" },
  { id: "month", label: "This month", short: "Month" },
  { id: "all", label: "All time", short: "All" },
];

/** Event scope switcher + date range. Pending approvals ignores both (always global). */
function ScopeBar({ section }: { section: Section }) {
  const { scope, setScope, range, setRange, events, scopeName } = useDashboardScope();
  const [picking, setPicking] = useState(false);
  const custom = isCustom(range);
  const note =
    section === "pending"
      ? "Pending approvals always show all locations"
      : section === "events"
        ? "Events list every location"
        : section === "inventory"
          ? null
          : undefined;
  return (
    <div className="relative flex flex-wrap items-center gap-3 rounded-card border border-white/[0.07] bg-white/[0.025] px-4 py-3 shadow-[inset_0_1px_0_rgb(255_255_255/0.05)] lg:py-2" data-testid="scope-bar">
      <label className="relative flex items-center">
        <span className="sr-only">Event scope</span>
        <span aria-hidden className="pointer-events-none absolute left-1.5 grid size-7 place-items-center rounded-full bg-maroon/60 shadow-[inset_0_1px_0_rgb(237_187_219/0.25)]"><MapPin className="size-3.5 text-pearl" /></span>
        <select
          data-testid="event-switcher"
          value={scope}
          onChange={(e) => setScope(e.target.value)}
          className="h-10 appearance-none rounded-inner border border-white/[0.06] well pr-9 pl-11 font-semibold text-ink outline-none focus:border-magenta/70 focus:ring-2 focus:ring-magenta/25"
        >
          <option value="global">Global — all locations</option>
          {events.map((ev) => (
            <option key={ev.id} value={ev.id}>{ev.name}{ev.status === "inactive" ? " (ended)" : ""}</option>
          ))}
          {/* Saved event while the events list is still loading — avoids flashing "Global". */}
          {scope !== "global" && !events.some((ev) => ev.id === scope) && <option value={scope}>Loading…</option>}
        </select>
        <ChevronDown className="pointer-events-none absolute right-3 size-4 text-ink-faint" />
      </label>
      <div role="tablist" aria-label="Date range" className="flex w-full gap-1 relative rounded-inner border border-white/[0.06] well p-1 sm:w-auto">
        <SegThumb />
        {RANGES.map((r) => (
          <button key={r.id} type="button" role="tab" aria-label={r.label} aria-selected={range === r.id} onClick={() => setRange(r.id)}
            className={cn("relative z-[1] h-8 flex-1 rounded-inner px-2 text-sm sm:px-3 font-semibold whitespace-nowrap transition-colors sm:flex-none",
              range === r.id ? "text-on-primary" : "text-ink-muted hover:text-ink")}>
            <span className="sm:hidden">{r.short}</span>
            <span className="hidden sm:inline">{r.label}</span>
          </button>
        ))}
        <button type="button" role="tab" aria-selected={custom} data-testid="range-custom" onClick={() => setPicking((p) => !p)}
          className={cn("relative z-[1] flex h-8 min-w-0 flex-[1.4] items-center justify-center gap-1.5 rounded-inner px-2 text-sm sm:flex-none sm:px-3 font-semibold whitespace-nowrap transition-colors sm:flex-none",
            custom ? "text-on-primary" : "text-ink-muted hover:text-ink")}>
          <CalendarDays className="size-3.5" />
          <span className="truncate">{custom ? rangeChip(range) : "Custom"}</span>
        </button>
      </div>
      {picking && (
        <CustomRangePicker range={range} onClose={() => setPicking(false)}
          onApply={(r) => { setRange(r); setPicking(false); }} />
      )}
      <span data-testid="scope-chip" className="ml-auto text-[13px] font-medium text-ink-faint">
        {note ?? (
          <>
            Showing: <span className="text-ink">{scopeName}</span>
            {note === null ? " · current stock (date range doesn't apply)" : ` · ${custom ? rangeLabel(range) : RANGES.find((r) => r.id === range)?.label}`}
          </>
        )}
      </span>
    </div>
  );
}
