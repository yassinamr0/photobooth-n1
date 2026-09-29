"use client";

import { useState } from "react";
import { AlertTriangle, ArrowLeft, ChevronDown, ChevronRight, Globe2, UserCheck, UserX } from "lucide-react";
import { Card, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Tag } from "@/components/ui/Tag";
import { Avatar } from "@/components/ui/Avatar";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/cn";
import { authErrorMessage } from "@/lib/auth/errors";
import { approveUser, assignEvent, rejectUser } from "@/lib/admin/firestore";
import { fmtDateTime } from "@/lib/shift/summary";
import { useDashboardScope, usePendingUsers, useScopedDashboard } from "./DashboardData";
import { MismatchIcon, ShiftRow, StatGrid } from "./ShiftPieces";

export type Section = "overview" | "pending" | "staff" | "shifts";

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="rounded-inner border border-dashed border-line px-4 py-8 text-center text-sm text-ink-faint">{children}</p>;
}

function rangeWords(range: string) {
  return range === "week" ? "this week" : range === "month" ? "this month" : "all time";
}

/* ─────────────────────────── Overview (scoped) ─────────────────────────── */
export function OverviewSection({ go }: { go: (s: Section) => void }) {
  const d = useScopedDashboard();
  const { range, scopeName } = useDashboardScope();
  const pending = usePendingUsers();
  return (
    <div className="flex flex-col gap-5" data-testid="section-overview">
      {d.mismatchCount > 0 && (
        <button
          type="button"
          data-testid="mismatch-banner"
          onClick={() => go("shifts")}
          className="flex items-center gap-3 rounded-card border border-warning/40 bg-warning-dim px-5 py-4 text-left text-warning"
        >
          <AlertTriangle className="size-5 shrink-0" />
          <span className="flex-1 font-semibold">
            {d.mismatchCount} shift{d.mismatchCount > 1 ? "s" : ""} in this range {d.mismatchCount > 1 ? "don't" : "doesn't"} match
            paper counts
          </span>
          <span className="text-sm underline underline-offset-4">Review in Shifts</span>
        </button>
      )}
      {pending.length > 0 && (
        <button type="button" onClick={() => go("pending")}
          className="flex items-center gap-3 rounded-card border border-magenta/35 bg-accent-dim px-5 py-3 text-left text-sm text-[#f0abfc]">
          <UserCheck className="size-4" /> {pending.length} signup{pending.length > 1 ? "s" : ""} waiting for approval
          <ChevronRight className="ml-auto size-4" />
        </button>
      )}
      <Card padding="lg">
        <CardHeader title="Combined stats" subtitle={`${scopeName} · ${rangeWords(range)} · ${d.shifts.length} shift${d.shifts.length === 1 ? "" : "s"}`} />
        <StatGrid totals={d.overview} size="lg" />
      </Card>
    </div>
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
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold text-ink">{u.name || "(no name)"}</p>
                <p className="truncate text-xs text-ink-faint">
                  {u.email}
                  {u.createdAt && ` · signed up ${fmtDateTime(u.createdAt.toDate().toISOString())}`}
                </p>
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
  const toast = useToast();

  async function changeAssignment(uid: string, eventId: string | null) {
    try {
      await assignEvent(uid, eventId);
      toast("Assignment updated — applies to their next shift", "success");
    } catch (e) {
      toast(`Could not update: ${authErrorMessage(e)}`, "danger");
    }
  }

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
                  <p className="text-xs text-ink-faint">{r.shiftCount} shift{r.shiftCount === 1 ? "" : "s"} in scope</p>
                </div>
                <span data-testid="staff-total" className="font-display text-xl font-bold text-gold tabular-nums">{r.totals.total} EGP</span>
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs sm:grid-cols-6">
                {([["Cash", r.totals.cash], ["Visa", r.totals.visa], ["Sheets", r.totals.sheets], ["Hadr", r.totals.hadr], ["Acrylic", r.totals.acrylic], ["Magnetic", r.totals.magnetic]] as const).map(([l, v]) => (
                  <div key={l} className="rounded-[10px] bg-surface-2 px-2 py-1.5">
                    <div className="font-semibold text-ink tabular-nums">{v}</div>
                    <div className="text-ink-faint">{l}</div>
                  </div>
                ))}
              </div>
              <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                {!r.removed ? (
                  <label className="flex items-center gap-2 text-sm text-ink-muted">
                    Assigned event
                    <select
                      aria-label={`Assigned event for ${r.name}`}
                      value={r.assignedEventId ?? ""}
                      onChange={(e) => changeAssignment(r.uid, e.target.value || null)}
                      className="h-9 rounded-full border border-line bg-surface-2 px-3 text-sm text-ink outline-none focus:border-magenta/70"
                    >
                      <option value="">No event</option>
                      {d.events.map((ev) => (
                        <option key={ev.id} value={ev.id}>{ev.name}</option>
                      ))}
                      {r.assignedEventId && !d.events.some((ev) => ev.id === r.assignedEventId) && (
                        <option value={r.assignedEventId}>Unknown event</option>
                      )}
                    </select>
                  </label>
                ) : (
                  <span className="text-xs text-ink-faint">No account — history only</span>
                )}
                <Button size="sm" variant="secondary" rightIcon={<ChevronRight className="size-4" />} onClick={() => openHistory(r.uid)}>
                  View history
                </Button>
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
  const fmtHeading = (key: string) => {
    const [y, m, day] = key.split("-").map(Number);
    return new Date(y, m - 1, day).toLocaleDateString(undefined, { weekday: "short", month: "long", day: "numeric", year: "numeric" });
  };
  return (
    <Card padding="lg" data-testid="section-shifts">
      <CardHeader
        title="Shifts"
        subtitle={scope === "global" ? `All locations · ${rangeWords(range)}` : `${scopeName} only · ${rangeWords(range)}`}
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
                  <span className="ml-auto text-xs text-ink-faint">{g.shifts.length} shift{g.shifts.length === 1 ? "" : "s"}</span>
                  <span className="font-semibold text-gold tabular-nums">{g.totals.total} EGP</span>
                  <ChevronDown className={cn("size-4 text-ink-faint transition-transform", isOpen && "rotate-180")} />
                </button>
                {isOpen && (
                  <div className="flex flex-col gap-2 px-3 pb-3">
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
  );
}
