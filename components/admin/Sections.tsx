"use client";

import { useState } from "react";
import { AlertTriangle, ArrowLeft, CheckCircle2, ChevronDown, ChevronRight, Globe2, Tags, UserCheck, UserX } from "lucide-react";
import { Card, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Tag } from "@/components/ui/Tag";
import { Avatar } from "@/components/ui/Avatar";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/cn";
import { authErrorMessage } from "@/lib/auth/errors";
import { approveUser, assignEvent, rejectUser, removeUser } from "@/lib/admin/firestore";
import type { StaffRow } from "@/lib/admin/scope";
import { rangeLabel } from "@/lib/admin/range";
import { fmtDateTime, fmtTime } from "@/lib/shift/summary";
import { fmtNum, formatEGP } from "@/lib/format";
import { useIsDesktop } from "@/lib/hooks/useIsDesktop";
import { useAuth } from "@/components/auth/AuthProvider";
import { ChartDefsHost } from "@/components/charts/ChartDefs";
import { useDashboardRaw, useDashboardScope, usePendingUsers, useScopedDashboard, useScopedInventory } from "./DashboardData";
import { MismatchIcon, ShiftColumnsHeader, ShiftRow, StatGrid } from "./ShiftPieces";
import { LowStockBanner } from "./InventorySection";
import { LocationComparison, RevenueTrend } from "./stats/RevenueCards";
import { TagShiftsTool } from "./TagShiftsTool";

export type Section = "overview" | "pending" | "staff" | "shifts" | "inventory" | "events" | "statistics" | "pnl";

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="rounded-inner border border-dashed border-line px-4 py-8 text-center text-sm text-ink-faint">{children}</p>;
}

const rangeWords = rangeLabel;

/* ─────────────────────────── Overview (scoped) ─────────────────────────── */
/*
 * Phones: alerts, then the combined stats (as before).
 * Desktop (lg+): a dashboard — KPI row across the top; revenue + locations on the left;
 * an alerts column on the right (low stock, paper mismatches, signups, on shift now).
 */
export function OverviewSection({ go }: { go: (s: Section) => void }) {
  const d = useScopedDashboard();
  const { raw } = useDashboardRaw();
  const { scope, range, scopeName } = useDashboardScope();
  const isDesktop = useIsDesktop();
  const [now] = useState(() => new Date());
  const label = `${scopeName} · ${rangeWords(range)}`;
  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(300px,360px)]" data-testid="section-overview">
      <Card padding="lg" className="order-2 lg:order-1 lg:col-span-2">
        <CardHeader title="Combined stats" subtitle={`${label} · ${fmtNum(d.shifts.length)} shift${d.shifts.length === 1 ? "" : "s"}`} />
        <StatGrid totals={d.overview} size="lg" />
      </Card>
      {isDesktop && (
        <div className="flex min-w-0 flex-col gap-5 lg:order-2">
          <ChartDefsHost />
          <RevenueTrend scoped={d} raw={raw} scope={scope} range={range} scopeLabel={label} now={now} />
          <LocationComparison raw={raw} scope={scope} range={range} now={now} rangeLabel={rangeWords(range)} />
        </div>
      )}
      <div className="order-1 flex min-w-0 flex-col gap-4 lg:order-3" data-testid="overview-alerts">
        <MismatchAlert go={go} />
        <LowStockBanner compact onOpen={() => go("inventory")} />
        <PendingAlert go={go} />
        <OnShiftNow />
        {isDesktop && <AllClear />}
      </div>
    </div>
  );
}

function MismatchAlert({ go }: { go: (s: Section) => void }) {
  const d = useScopedDashboard();
  if (d.mismatchCount === 0) return null;
  const list = d.shifts.filter((s) => s.recon?.warn).slice(0, 4);
  return (
    <div data-testid="mismatch-banner" className="rounded-card border border-warning/40 bg-warning-dim px-5 py-4 text-warning">
      <button type="button" onClick={() => go("shifts")} className="flex w-full items-center gap-3 text-left">
        <AlertTriangle className="size-5 shrink-0" />
        <span className="flex-1 font-semibold">
          {fmtNum(d.mismatchCount)} shift{d.mismatchCount > 1 ? "s" : ""} in this range {d.mismatchCount > 1 ? "don't" : "doesn't"} match
          paper counts
        </span>
        <span className="text-sm underline underline-offset-4">Review in Shifts</span>
      </button>
      <ul className="mt-2 hidden flex-col gap-1 text-sm text-ink-muted lg:flex">
        {list.map((s) => (
          <li key={s.shift.id} className="truncate">
            {new Date(s.shift.startTime).toLocaleDateString(undefined, { month: "short", day: "numeric" })} · {s.staffName}
            {s.eventName && ` · ${s.eventName}`}
          </li>
        ))}
        {d.mismatchCount > list.length && <li className="text-ink-faint">+ {fmtNum(d.mismatchCount - list.length)} more</li>}
      </ul>
    </div>
  );
}

function PendingAlert({ go }: { go: (s: Section) => void }) {
  const pending = usePendingUsers();
  const toast = useToast();
  const [busy, setBusy] = useState<string | null>(null);
  if (pending.length === 0) return null;
  return (
    <div data-testid="pending-alert" className="rounded-card border border-magenta/35 bg-accent-dim px-5 py-3 text-sm text-[#f0abfc]">
      <button type="button" onClick={() => go("pending")} className="flex w-full items-center gap-3 py-1 text-left">
        <UserCheck className="size-4" /> {fmtNum(pending.length)} signup{pending.length > 1 ? "s" : ""} waiting for approval
        <ChevronRight className="ml-auto size-4" />
      </button>
      <ul className="mt-1 hidden flex-col divide-y divide-magenta/20 lg:flex">
        {pending.slice(0, 3).map((u) => (
          <li key={u.uid} className="flex items-center gap-2 py-2">
            <span className="min-w-0 flex-1 truncate text-ink">{u.name || u.email || "(no name)"}</span>
            <Button size="sm" loading={busy === u.uid} data-testid="overview-approve"
              onClick={async () => {
                setBusy(u.uid);
                try {
                  await approveUser(u.uid);
                  toast(`${u.name || "User"} approved`, "success");
                } catch (e) {
                  toast(`Could not approve: ${authErrorMessage(e)}`, "danger");
                } finally {
                  setBusy(null);
                }
              }}>
              Approve
            </Button>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Open shifts in the current scope — who's working right now. */
function OnShiftNow() {
  const d = useScopedDashboard();
  const live = d.shifts.filter((s) => !s.shift.endTime);
  if (live.length === 0) return null;
  return (
    <Card padding="md" data-testid="on-shift-now">
      <h3 className="mb-2 flex items-center gap-2 font-display text-sm font-semibold text-ink">
        <span className="size-2 rounded-full bg-success" /> On shift now ({fmtNum(live.length)})
      </h3>
      <ul className="flex flex-col divide-y divide-line text-sm">
        {live.map((s) => (
          <li key={s.shift.id} className="flex items-center gap-2 py-2">
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold text-ink">{s.staffName}</p>
              <p className="truncate text-xs text-ink-faint">{s.eventName ?? "No event"} · since {fmtTime(s.shift.startTime)}</p>
            </div>
            <span className="font-semibold text-gold tabular-nums">{formatEGP(s.totals.total)}</span>
          </li>
        ))}
      </ul>
    </Card>
  );
}

function AllClear() {
  const d = useScopedDashboard();
  const { alerts } = useScopedInventory();
  const pending = usePendingUsers();
  if (d.mismatchCount || alerts.length || pending.length || d.shifts.some((s) => !s.shift.endTime)) return null;
  return (
    <Card padding="md" className="flex items-center gap-3 text-sm text-ink-muted">
      <CheckCircle2 className="size-5 text-success" /> All clear — no alerts right now.
    </Card>
  );
}

/* ─────────────────── Pending approvals (ALWAYS GLOBAL) ─────────────────── */
export function PendingSection() {
  const pending = usePendingUsers(); // deliberately unscoped
  const toast = useToast();
  const [confirm, setConfirm] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  async function act(uid: string, fn: () => Promise<void>, ok: string) {
    setBusy(uid);
    try {
      await fn();
      toast(ok, "success");
    } catch (e) {
      toast(`Could not update: ${authErrorMessage(e)}`, "danger");
    } finally {
      setBusy(null);
      setConfirm(null);
    }
  }

  return (
    <Card padding="lg" data-testid="section-pending">
      <CardHeader
        title="Pending approvals"
        subtitle="New signups waiting for access"
        action={<Tag tone="neutral" icon={<Globe2 />}>All locations</Tag>}
      />
      {pending.length === 0 ? (
        <Empty>No pending signups.</Empty>
      ) : (
        <ul className="flex flex-col divide-y divide-line">
          {pending.map((u) => (
            <li key={u.uid} data-testid="pending-row" className="flex flex-wrap items-center gap-3 py-3">
              <Avatar name={u.name || u.email || "?"} />
              <div className="min-w-0 flex-1 lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)_180px] lg:items-center lg:gap-4">
                <p className="truncate font-semibold text-ink">{u.name || "(no name)"}</p>
                <p className="truncate text-xs text-ink-faint lg:text-sm lg:text-ink-muted">
                  {u.email}
                  <span className="lg:hidden">{u.createdAt && ` · signed up ${fmtDateTime(u.createdAt.toDate().toISOString())}`}</span>
                </p>
                <p className="hidden text-sm text-ink-faint lg:block">{u.createdAt ? fmtDateTime(u.createdAt.toDate().toISOString()) : "—"}</p>
              </div>
              {confirm === u.uid ? (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-ink-muted">Reject {u.name?.split(" ")[0] || "this signup"}?</span>
                  <Button size="sm" variant="secondary" onClick={() => setConfirm(null)}>Cancel</Button>
                  <Button size="sm" variant="danger" loading={busy === u.uid}
                    onClick={() => act(u.uid, () => rejectUser(u.uid), "Signup rejected")}>Reject</Button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <Button size="sm" variant="ghost" leftIcon={<UserX className="size-4" />} onClick={() => setConfirm(u.uid)}>Reject</Button>
                  <Button size="sm" loading={busy === u.uid} leftIcon={<UserCheck className="size-4" />}
                    onClick={() => act(u.uid, () => approveUser(u.uid), `${u.name || "User"} approved`)}>Approve</Button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

/* ─────────────────────────── Staff (scoped) ─────────────────────────── */
export function StaffSection({ openHistory }: { openHistory: (uid: string) => void }) {
  const d = useScopedDashboard();
  const { scope, scopeName, range } = useDashboardScope();
  const isDesktop = useIsDesktop();
  const toast = useToast();

  async function changeAssignment(uid: string, eventId: string | null) {
    try {
      await assignEvent(uid, eventId);
      toast("Assignment updated — applies to their next shift", "success");
    } catch (e) {
      toast(`Could not update: ${authErrorMessage(e)}`, "danger");
    }
  }
  const picker = (r: StaffRow) => (
    <select
      aria-label={`Assigned event for ${r.name}`}
      value={r.assignedEventId ?? ""}
      onChange={(e) => changeAssignment(r.uid, e.target.value || null)}
      className="h-9 max-w-[180px] rounded-full border border-line bg-surface-2 px-3 text-sm text-ink outline-none focus:border-magenta/70"
    >
      <option value="">No event</option>
      {/* Only ACTIVE events can be assigned (keep showing the current one if it was deactivated). */}
      {d.events.filter((ev) => ev.status === "active" || ev.id === r.assignedEventId).map((ev) => (
        <option key={ev.id} value={ev.id}>{ev.name}{ev.status === "inactive" ? " (inactive)" : ""}</option>
      ))}
      {r.assignedEventId && !d.events.some((ev) => ev.id === r.assignedEventId) && (
        <option value={r.assignedEventId}>Unknown event</option>
      )}
    </select>
  );

  return (
    <Card padding="lg" data-testid="section-staff">
      <CardHeader
        title="Staff"
        subtitle={
          scope === "global"
            ? `All approved staff · totals ${rangeWords(range)}`
            : `Staff with shifts at ${scopeName} ${rangeWords(range)} · totals from ${scopeName} shifts only`
        }
      />
      {d.staffRows.length === 0 ? (
        <Empty>{scope === "global" ? "No approved staff yet." : `No shifts at ${scopeName} in this range.`}</Empty>
      ) : isDesktop ? (
        <div className="-mx-2 overflow-x-auto px-2">
          <table data-testid="staff-table" className="w-full text-left text-sm">
            <thead className="text-xs text-ink-faint uppercase">
              <tr>
                <th className="py-2 font-medium">Name</th>
                <th className="py-2 pl-3 font-medium">Assigned event</th>
                {["Shifts", "Revenue", "Cash", "Visa", "Sheets", "Hadr", "Acrylic", "Magnetic"].map((h) => (
                  <th key={h} className="py-2 pl-3 text-right font-medium">{h}</th>
                ))}
                <th className="py-2 pl-3"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {d.staffRows.map((r) => (
                <tr key={r.uid} data-testid="staff-row" className="align-middle">
                  <td className="py-3">
                    <div className="flex items-center gap-3">
                      <Avatar name={r.name} size="sm" />
                      <div className="min-w-0">
                        <p className="flex flex-wrap items-center gap-1.5 font-semibold text-ink">
                          <span data-testid="staff-name">{r.name}</span>
                          {r.removed && <Tag tone="neutral">Removed</Tag>}
                          {r.role === "admin" && <Tag tone="accent">Admin</Tag>}
                        </p>
                        {r.email && <p className="truncate text-xs text-ink-faint">{r.email}</p>}
                      </div>
                    </div>
                  </td>
                  <td className="py-3 pl-3">{r.removed ? <span className="text-xs text-ink-faint">No account</span> : picker(r)}</td>
                  <td className="py-3 pl-3 text-right tabular-nums">{fmtNum(r.shiftCount)}</td>
                  <td data-testid="staff-total" className="py-3 pl-3 text-right font-semibold whitespace-nowrap text-gold tabular-nums">{formatEGP(r.totals.total)}</td>
                  <td className="py-3 pl-3 text-right tabular-nums">{fmtNum(r.totals.cash)}</td>
                  <td className="py-3 pl-3 text-right tabular-nums">{fmtNum(r.totals.visa)}</td>
                  <td className="py-3 pl-3 text-right tabular-nums">{fmtNum(r.totals.sheets)}</td>
                  <td className="py-3 pl-3 text-right tabular-nums">{fmtNum(r.totals.hadr)}</td>
                  <td className="py-3 pl-3 text-right tabular-nums">{fmtNum(r.totals.acrylic)}</td>
                  <td className="py-3 pl-3 text-right tabular-nums">{fmtNum(r.totals.magnetic)}</td>
                  <td className="py-3 pl-3">
                    <div className="flex items-center justify-end gap-1">
                      <Button size="sm" variant="secondary" onClick={() => openHistory(r.uid)}>History</Button>
                      <RemoveStaff row={r} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {d.staffRows.map((r) => (
            <li key={r.uid} data-testid="staff-row" className="rounded-inner border border-line bg-surface-2/40 p-4">
              <div className="flex flex-wrap items-center gap-3">
                <Avatar name={r.name} />
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-2 font-semibold text-ink">
                    <span data-testid="staff-name">{r.name}</span>
                    {r.removed && <Tag tone="neutral">Removed</Tag>}
                    {r.role === "admin" && <Tag tone="accent">Admin</Tag>}
                  </p>
                  <p className="text-xs text-ink-faint">{fmtNum(r.shiftCount)} shift{r.shiftCount === 1 ? "" : "s"} in scope</p>
                </div>
                <span data-testid="staff-total" className="font-display text-xl font-bold text-gold tabular-nums">{formatEGP(r.totals.total)}</span>
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs sm:grid-cols-6">
                {([["Cash", r.totals.cash], ["Visa", r.totals.visa], ["Sheets", r.totals.sheets], ["Hadr", r.totals.hadr], ["Acrylic", r.totals.acrylic], ["Magnetic", r.totals.magnetic]] as const).map(([l, v]) => (
                  <div key={l} className="rounded-[10px] bg-surface-2 px-2 py-1.5">
                    <div className="font-semibold text-ink tabular-nums">{fmtNum(v)}</div>
                    <div className="text-ink-faint">{l}</div>
                  </div>
                ))}
              </div>
              <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                {!r.removed ? (
                  <label className="flex items-center gap-2 text-sm text-ink-muted">Assigned event {picker(r)}</label>
                ) : (
                  <span className="text-xs text-ink-faint">No account — history only</span>
                )}
                <div className="flex flex-wrap items-center gap-2">
                  <RemoveStaff row={r} />
                  <Button size="sm" variant="secondary" rightIcon={<ChevronRight className="size-4" />} onClick={() => openHistory(r.uid)}>
                    View history
                  </Button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-4 text-xs text-ink-faint">
        Changing an assignment only affects shifts started afterwards — past and in-progress shifts keep the event they were stamped with.
      </p>
    </Card>
  );
}

/**
 * Remove a staff member from the app (deletes their /users profile). History stays. Their
 * Firebase login has to be deleted in the Firebase console — the app has no Admin SDK.
 */
function RemoveStaff({ row }: { row: StaffRow }) {
  const { profile } = useAuth();
  const toast = useToast();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  if (row.removed || row.uid === profile?.uid) return null;
  if (!confirming) {
    return (
      <Button size="sm" variant="ghost" data-testid="remove-staff" leftIcon={<UserX className="size-4" />} onClick={() => setConfirming(true)}>
        Remove
      </Button>
    );
  }
  return (
    <div data-testid="remove-staff-confirm" className="flex max-w-[420px] flex-col gap-2 rounded-inner border border-danger/40 bg-danger-dim px-3 py-2 text-left text-xs text-ink-muted">
      <p>
        Remove <b className="text-ink">{row.name}</b> from the app? Their past shifts and sales stay in history. Also delete their
        login under Firebase console → Authentication, or they could sign up again.
      </p>
      <div className="flex gap-2">
        <Button size="sm" variant="secondary" onClick={() => setConfirming(false)}>Cancel</Button>
        <Button size="sm" variant="danger" loading={busy} data-testid="remove-staff-yes"
          onClick={async () => {
            setBusy(true);
            try {
              await removeUser(row.uid);
              toast(`${row.name} removed`, "success");
            } catch (e) {
              toast(`Could not remove: ${authErrorMessage(e)}`, "danger");
              setBusy(false);
            }
          }}>
          Remove
        </Button>
      </div>
    </div>
  );
}

/* ─────────────── Staff history — SEPARATE read-only view (scoped) ─────────────── */
export function StaffHistoryView({ uid, back }: { uid: string; back: () => void }) {
  const d = useScopedDashboard();
  const { scope, scopeName, range } = useDashboardScope();
  const row = d.staffRows.find((r) => r.uid === uid);
  const theirShifts = d.shifts.filter((s) => s.shift.uid === uid);
  const name = row?.name ?? theirShifts[0]?.staffName ?? "Staff member";
  return (
    <div className="flex flex-col gap-5" data-testid="section-history">
      <button type="button" onClick={back} className="flex items-center gap-2 self-start text-sm text-ink-muted hover:text-ink">
        <ArrowLeft className="size-4" /> Back to Staff
      </button>
      <Card padding="lg">
        <CardHeader title={`${name}’s shift history`} subtitle={`Read-only · ${scopeName} · ${rangeWords(range)}`} />
        {row && <StatGrid totals={row.totals} size="lg" />}
      </Card>
      {theirShifts.length === 0 ? (
        <Empty>No shifts {scope === "global" ? "" : `at ${scopeName} `}in this range.</Empty>
      ) : (
        <div className="flex flex-col gap-2">
          {theirShifts.map((s) => (
            <ShiftRow key={s.shift.id} s={s} showEvent={scope === "global"} showDate readOnly />
          ))}
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────── Shifts (scoped) ─────────────────────────── */
export function ShiftsSection() {
  const d = useScopedDashboard();
  const { scope, scopeName, range } = useDashboardScope();
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [tagging, setTagging] = useState(false);
  const isDesktop = useIsDesktop();
  const fmtHeading = (key: string) => {
    const [y, m, day] = key.split("-").map(Number);
    return new Date(y, m - 1, day).toLocaleDateString(undefined, { weekday: "short", month: "long", day: "numeric", year: "numeric" });
  };
  return (
    <div className="flex flex-col gap-5">
    {tagging && <TagShiftsTool close={() => setTagging(false)} />}
    <Card padding="lg" data-testid="section-shifts">
      <CardHeader
        title="Shifts"
        subtitle={scope === "global" ? `All locations · ${rangeWords(range)}` : `${scopeName} only · ${rangeWords(range)}`}
        action={!tagging && (
          <Button size="sm" variant="ghost" data-testid="open-tag-tool" leftIcon={<Tags className="size-4" />} onClick={() => setTagging(true)}>
            Tag shifts with no event
          </Button>
        )}
      />
      {d.dateGroups.length === 0 ? (
        <Empty>No shifts in this range.</Empty>
      ) : (
        <div className="flex flex-col gap-2">
          {d.dateGroups.map((g) => {
            const isOpen = !!open[g.key];
            return (
              <div key={g.key} data-testid="date-group" className="rounded-card border border-line bg-surface-2/40">
                <button
                  type="button"
                  aria-expanded={isOpen}
                  onClick={() => setOpen((o) => ({ ...o, [g.key]: !o[g.key] }))}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left"
                >
                  <span className="font-semibold text-ink">{fmtHeading(g.key)}</span>
                  {g.hasMismatch && <MismatchIcon title="A shift this day has a paper mismatch" />}
                  <span className="ml-auto text-xs text-ink-faint">{fmtNum(g.shifts.length)} shift{g.shifts.length === 1 ? "" : "s"}</span>
                  <span className="font-semibold text-gold tabular-nums">{formatEGP(g.totals.total)}</span>
                  <ChevronDown className={cn("size-4 text-ink-faint transition-transform", isOpen && "rotate-180")} />
                </button>
                {isOpen && (
                  <div className="flex flex-col gap-2 px-3 pb-3">
                    {isDesktop && <ShiftColumnsHeader showEvent={scope === "global"} />}
                    {g.shifts.map((s) => (
                      <ShiftRow key={s.shift.id} s={s} showEvent={scope === "global"} />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </Card>
    </div>
  );
}
