"use client";

import { useState, type FormEvent } from "react";
import { CalendarRange, MapPin, Pencil, Plus, Trash2 } from "lucide-react";
import { Card, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Tag } from "@/components/ui/Tag";
import { Field, FormError } from "@/components/ui/Field";
import { useToast } from "@/components/ui/Toast";
import { useAuth } from "@/components/auth/AuthProvider";
import { authErrorMessage } from "@/lib/auth/errors";
import { createEvent, deleteEvent, setEventStatus, updateEvent } from "@/lib/inventory/firestore";
import { SegThumb } from "@/components/ui/Segmented";
import { cn } from "@/lib/cn";
import { formatEGP } from "@/lib/format";
import type { EventRecord } from "@/lib/inventory/types";
import { fmtNum } from "@/lib/format";
import { dayKey, parseDay } from "@/lib/admin/range";
import { eventSpan } from "@/lib/pnl/eventSpan";
import { useDashboardRaw, useEvents, usePnl, useScopedInventory } from "./DashboardData";

/**
 * Events = physical booth locations (admin-only bookkeeping; staff never see them).
 * No hard delete — mark as ended instead (temporary events), so past shifts/stock history stay
 * attached. An ended event stops raising alerts (low stock, runs-out-soon, break-even) and
 * can't be assigned; "Reopen" undoes it. Stored as status "inactive".
 */
export function EventsSection() {
  const { events, users } = useEvents();
  const { paper } = useScopedInventory();
  const { profile } = useAuth();
  const toast = useToast();
  const [name, setName] = useState("");
  const [notes, setNotes] = useState("");
  const [startDate, setStartDate] = useState(() => dayKey(new Date()));
  const [endDate, setEndDate] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<"all" | "active" | "finished">("all");
  const today = dayKey(new Date());
  // Finished = marked as ended, or its end date has already passed.
  const finished = (ev: EventRecord) => ev.status === "inactive" || (!!ev.endDate && ev.endDate < today);
  const shown = events.filter((ev) => view === "all" || (view === "finished") === finished(ev));
  const counts = { all: events.length, active: events.filter((e) => !finished(e)).length, finished: events.filter(finished).length };

  async function create(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return setError("Give the location a name.");
    if (!startDate) return setError("Pick the day it starts.");
    if (endDate && endDate < startDate) return setError("The end date can't be before the start date.");
    if (!profile) return;
    setBusy(true);
    setError(null);
    try {
      await createEvent(name, notes, { uid: profile.uid, name: profile.name }, paper.sheetsPerBox, { startDate, endDate: endDate || null });
      toast(`${name.trim()} created`, "success");
      setName("");
      setNotes("");
      setEndDate("");
    } catch (err) {
      setError(authErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  const assignedCount = (id: string) => users.filter((u) => u.approved && u.assignedEventId === id).length;

  return (
    <div className="flex flex-col gap-5" data-testid="section-events">
      <Card padding="lg">
        <CardHeader title="New event" subtitle="A physical booth location with its own printer and supply" />
        <form onSubmit={create} className="grid gap-3 md:grid-cols-2 xl:grid-cols-[1.2fr_1.6fr_1fr_1fr_auto] xl:items-end" noValidate>
          <Field id="ev-name" label="Name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. City Stars Mall" />
          <Field id="ev-notes" label="Notes (optional)" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Floor, contact, hours…" />
          <Field id="ev-start" label="Starts" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="[color-scheme:dark]" />
          <Field id="ev-end" label="Ends (optional)" type="date" value={endDate} min={startDate} onChange={(e) => setEndDate(e.target.value)} className="[color-scheme:dark]" />
          <Button type="submit" size="lg" loading={busy} leftIcon={<Plus className="size-4" />}>Create event</Button>
        </form>
        <div className="mt-3"><FormError>{error}</FormError></div>
        <p className="mt-2 text-xs text-ink-faint">
          &quot;Ends&quot; is the last day the booth runs (both the first and last day count). Leave it empty if you don&apos;t know yet — it stays ongoing until you mark it as ended (that sets the end date to that day). New events start with 0 paper, ink and frames; restock them from Inventory. Low-stock warning defaults to one box ({fmtNum(paper.sheetsPerBox)} sheets) for paper, 1 ink cartridge and 5 of each frame.
        </p>
      </Card>

      <Card padding="lg">
        <CardHeader title="Events" subtitle={`${events.length} location${events.length === 1 ? "" : "s"} · the list the top switcher uses`} />
        <div role="tablist" aria-label="Show events" className="relative mb-4 flex w-full gap-1 rounded-inner border border-white/[0.06] well p-1 sm:w-fit">
          <SegThumb />
          {([["all", "All"], ["active", "Active"], ["finished", "Finished"]] as const).map(([k, l]) => (
            <button key={k} type="button" role="tab" aria-selected={view === k} data-testid={`events-${k}`} onClick={() => setView(k)}
              className={cn("relative z-[1] h-8 flex-1 rounded-inner px-4 text-sm font-semibold transition-colors sm:flex-none", view === k ? "text-on-primary" : "text-ink-muted hover:text-ink")}>
              {l} <span className="ml-0.5 tabular-nums opacity-70">{counts[k]}</span>
            </button>
          ))}
        </div>
        {shown.length === 0 ? (
          <p className="empty-state">{events.length === 0 ? "No events yet." : view === "active" ? "No active events." : "No finished events."}</p>
        ) : (
          <ul className="flex flex-col gap-3 lg:gap-0 lg:divide-y lg:divide-line">
            {shown.map((ev) => (
              <EventRow key={ev.id} ev={ev} assigned={assignedCount(ev.id)} finished={finished(ev)} />
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

/** "12 Oct 2026 → ongoing" / "28 Sep – 5 Oct 2026". */
function fmtSpan(start: string | null, end: string | null) {
  const f = (k: string, year = true) => parseDay(k).toLocaleDateString("en-GB", { day: "numeric", month: "short", ...(year ? { year: "numeric" } : {}) });
  if (!start) return end ? `until ${f(end)}` : "No dates yet";
  if (!end) return `${f(start)} → ongoing`;
  // Both the first and the last day count: 28 Sep – 8 Oct = 11 days.
  const days = Math.round((parseDay(end).getTime() - parseDay(start).getTime()) / 86_400_000) + 1;
  return `${f(start, start.slice(0, 4) !== end.slice(0, 4))} – ${f(end)} · ${days} day${days === 1 ? "" : "s"}`;
}

function EventRow({ ev, assigned, finished }: { ev: EventRecord; assigned: number; finished: boolean }) {
  const toast = useToast();
  const { raw } = useDashboardRaw();
  const span = eventSpan(raw, ev.id);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(ev.name);
  const [notes, setNotes] = useState(ev.notes);
  // Older events have no saved start date: prefill the guess (first shift / creation day).
  const [startDate, setStartDate] = useState(ev.startDate ?? span.startDate ?? dayKey(new Date()));
  const [endDate, setEndDate] = useState(ev.endDate ?? (span.endGuessed ? span.endDate ?? "" : ""));
  const today = dayKey(new Date());
  const [confirmDeactivate, setConfirmDeactivate] = useState(false);
  const [deleting, setDeleting] = useState<null | "ask" | "all">(null);
  const { expenses, recurring } = usePnl();
  // What's logged against this event (decides how Delete asks).
  const shifts = raw.shifts.filter((s) => s.eventId === ev.id);
  const shiftIds = new Set(shifts.map((s) => s.id));
  const sales = raw.entries.filter((e) => e.type === "sale" && shiftIds.has(e.shiftId)).reduce((t, e) => t + (e.total || 0), 0);
  const expCount = expenses.filter((e) => e.eventId === ev.id).length + recurring.filter((r) => r.eventId === ev.id).length;
  const hasHistory = shifts.length > 0 || expCount > 0;
  const [busy, setBusy] = useState(false);

  async function run(fn: () => Promise<void>, ok: string) {
    setBusy(true);
    try {
      await fn();
      toast(ok, "success");
      return true;
    } catch (e) {
      toast(`Could not save: ${authErrorMessage(e)}`, "danger");
      return false;
    } finally {
      setBusy(false);
    }
  }

  return (
    <li data-testid="event-row" className="rounded-inner border border-line bg-surface-2/40 p-4 lg:rounded-none lg:border-0 lg:bg-transparent lg:px-0 lg:py-3">
      {editing ? (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[1.2fr_1.6fr_1fr_1fr_auto] xl:items-end">
          <Field id={`edit-name-${ev.id}`} label="Name" value={name} onChange={(e) => setName(e.target.value)} />
          <Field id={`edit-notes-${ev.id}`} label="Notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
          <Field id={`edit-start-${ev.id}`} label="Starts" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="[color-scheme:dark]" />
          <Field id={`edit-end-${ev.id}`} label="Ends (optional)" type="date" value={endDate} min={startDate} onChange={(e) => setEndDate(e.target.value)} className="[color-scheme:dark]" />
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => { setEditing(false); setName(ev.name); setNotes(ev.notes); setStartDate(ev.startDate ?? span.startDate ?? today); setEndDate(ev.endDate ?? (span.endGuessed ? span.endDate ?? "" : "")); }}>Cancel</Button>
            <Button loading={busy} disabled={!name.trim() || !startDate}
              onClick={async () => { if (await run(() => updateEvent(ev.id, { name, notes, startDate, endDate: endDate || null }), "Event updated")) setEditing(false); }}>
              Save
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-3 lg:grid lg:grid-cols-[40px_minmax(0,1fr)_minmax(0,1.4fr)_130px_auto] lg:gap-4">
          <span className="grid size-10 place-items-center rounded-inner bg-accent-dim text-magenta"><MapPin className="size-5" /></span>
          <div className="min-w-0 flex-1">
            <p className="flex flex-wrap items-center gap-2 font-semibold text-ink">
              <span data-testid="event-name">{ev.name}</span>
              {!finished ? <Tag tone="success" dot>Active</Tag> : <Tag tone="neutral" dot>{ev.status === "inactive" ? "Ended" : "Finished"}</Tag>}
            </p>
            <p data-testid="event-dates" className="mt-0.5 flex items-center gap-1.5 text-xs whitespace-nowrap text-ink-muted">
              <CalendarRange className="size-3.5 shrink-0" />
              {fmtSpan(span.startDate, span.endDate)}
            </p>
            {(span.startGuessed || span.endGuessed) && (
              <p className="text-[11px] text-ink-faint">
                {span.startGuessed && span.endGuessed ? "Start and end taken from its first and last shift"
                  : span.startGuessed ? "Start taken from its first shift" : "End taken from its last shift"} — edit to change
              </p>
            )}
            <p className="truncate text-xs text-ink-faint lg:hidden">
              {ev.notes || "No notes"} · {assigned} staff assigned
            </p>
          </div>
          <p className="hidden truncate text-sm text-ink-muted lg:block" title={ev.notes}>{ev.notes || <span className="text-ink-faint">No notes</span>}</p>
          <p className="hidden text-sm text-ink-muted lg:block">{fmtNum(assigned)} staff assigned</p>
          <div className="flex items-center gap-2 lg:justify-end">
          <Button size="sm" variant="ghost" leftIcon={<Pencil className="size-3.5" />} onClick={() => setEditing(true)}>Edit</Button>
          <Button size="sm" variant="ghost" aria-label={`Delete ${ev.name}`} data-testid="event-delete" onClick={() => setDeleting("ask")}
            className="hover:text-danger"><Trash2 className="size-3.5" /></Button>
          {ev.status === "active" ? (
            <Button size="sm" variant="secondary" onClick={() => (assigned > 0 ? setConfirmDeactivate(true) : run(() => setEventStatus(ev.id, "inactive", { today, endDate: ev.endDate }), `${ev.name} marked as ended`))}>
              Mark as ended
            </Button>
          ) : (
            <Button size="sm" variant="secondary" loading={busy} onClick={() => run(() => setEventStatus(ev.id, "active"), `${ev.name} reopened`)}>
              Reopen
            </Button>
          )}
          </div>
        </div>
      )}
      {deleting && (
        <div role="alertdialog" data-testid="event-delete-confirm" className="mt-3 rounded-inner border border-danger/40 bg-danger-dim px-4 py-3 text-sm text-ink">
          {!hasHistory ? (
            <>
              Delete <b>{ev.name}</b>? It has no shifts or expenses, so nothing else is affected. This can&apos;t be undone.
              <div className="mt-2 flex gap-2">
                <Button size="sm" variant="secondary" onClick={() => setDeleting(null)}>Cancel</Button>
                <Button size="sm" variant="danger" loading={busy} data-testid="event-delete-go"
                  onClick={() => run(() => deleteEvent(ev.id, "keep"), `${ev.name} deleted`)}>Delete</Button>
              </div>
            </>
          ) : deleting === "ask" ? (
            <>
              <b>{ev.name}</b> has {fmtNum(shifts.length)} shift{shifts.length === 1 ? "" : "s"} ({formatEGP(Math.round(sales))} in sales)
              {expCount > 0 && <> and {fmtNum(expCount)} expense{expCount === 1 ? "" : "s"}</>}. What should happen to them?
              <ul className="mt-2 list-disc pl-5 text-xs text-ink-muted">
                <li><b className="text-ink">Keep history:</b> past shifts and sales stay in your totals (shown as &quot;Deleted event&quot;), its expenses move to General. Past money totals don&apos;t change.</li>
                <li><b className="text-ink">Delete everything:</b> its shifts, sales, waste and expenses are deleted too. Past revenue and profit go down.</li>
              </ul>
              <p className="mt-1 text-xs text-ink-muted">Either way its stock counts are removed{assigned > 0 && " and its staff are unassigned"}.</p>
              <div className="mt-2 flex flex-wrap gap-2">
                <Button size="sm" variant="secondary" onClick={() => setDeleting(null)}>Cancel</Button>
                <Button size="sm" variant="secondary" loading={busy} data-testid="event-delete-keep"
                  onClick={() => run(() => deleteEvent(ev.id, "keep"), `${ev.name} deleted — history kept`)}>Delete, keep history</Button>
                <Button size="sm" variant="danger" data-testid="event-delete-all" onClick={() => setDeleting("all")}>Delete everything…</Button>
              </div>
            </>
          ) : (
            <>
              This permanently deletes <b>{ev.name}</b>, its {fmtNum(shifts.length)} shift{shifts.length === 1 ? "" : "s"} and their sales
              {expCount > 0 && <>, and {fmtNum(expCount)} expense{expCount === 1 ? "" : "s"}</>}. It can&apos;t be undone.
              <div className="mt-2 flex gap-2">
                <Button size="sm" variant="secondary" onClick={() => setDeleting("ask")}>Back</Button>
                <Button size="sm" variant="danger" loading={busy} data-testid="event-delete-all-go"
                  onClick={() => run(() => deleteEvent(ev.id, "all"), `${ev.name} and its history deleted`)}>Yes, delete everything</Button>
              </div>
            </>
          )}
        </div>
      )}
      {confirmDeactivate && (
        <div role="alertdialog" className="mt-3 rounded-inner border border-warning/40 bg-warning-dim px-4 py-3 text-sm text-warning">
          {assigned} staff member{assigned === 1 ? " is" : "s are"} still assigned here. Their next shift will still be tagged with {ev.name}
          until you reassign them in Staff.
          <div className="mt-2 flex gap-2">
            <Button size="sm" variant="secondary" onClick={() => setConfirmDeactivate(false)}>Cancel</Button>
            <Button size="sm" variant="danger" loading={busy}
              onClick={async () => { await run(() => setEventStatus(ev.id, "inactive", { today, endDate: ev.endDate }), `${ev.name} marked as ended`); setConfirmDeactivate(false); }}>
              Mark as ended anyway
            </Button>
          </div>
        </div>
      )}
    </li>
  );
}
