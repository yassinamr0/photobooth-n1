"use client";

import { useState, type FormEvent } from "react";
import { CalendarRange, MapPin, Pencil, Plus } from "lucide-react";
import { Card, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Tag } from "@/components/ui/Tag";
import { Field, FormError } from "@/components/ui/Field";
import { useToast } from "@/components/ui/Toast";
import { useAuth } from "@/components/auth/AuthProvider";
import { authErrorMessage } from "@/lib/auth/errors";
import { createEvent, setEventStatus, updateEvent } from "@/lib/inventory/firestore";
import type { EventRecord } from "@/lib/inventory/types";
import { fmtNum } from "@/lib/format";
import { dayKey, parseDay } from "@/lib/admin/range";
import { eventSpan } from "@/lib/pnl/eventSpan";
import { useDashboardRaw, useEvents, useScopedInventory } from "./DashboardData";

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
          Leave &quot;Ends&quot; empty if you don&apos;t know yet — it stays ongoing until you mark it as ended (that sets the end date to that day). New events start with 0 paper, ink and frames; restock them from Inventory. Low-stock warning defaults to one box ({fmtNum(paper.sheetsPerBox)} sheets) for paper, 1 ink cartridge and 5 of each frame.
        </p>
      </Card>

      <Card padding="lg">
        <CardHeader title="Events" subtitle={`${events.length} location${events.length === 1 ? "" : "s"} · the list the top switcher uses`} />
        {events.length === 0 ? (
          <p className="empty-state">No events yet.</p>
        ) : (
          <ul className="flex flex-col gap-3 lg:gap-0 lg:divide-y lg:divide-line">
            {events.map((ev) => (
              <EventRow key={ev.id} ev={ev} assigned={assignedCount(ev.id)} />
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
  return `${f(start, start.slice(0, 4) !== end.slice(0, 4))} – ${f(end)}`;
}

function EventRow({ ev, assigned }: { ev: EventRecord; assigned: number }) {
  const toast = useToast();
  const { raw } = useDashboardRaw();
  const span = eventSpan(raw, ev.id);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(ev.name);
  const [notes, setNotes] = useState(ev.notes);
  // Older events have no saved start date: prefill the guess (first shift / creation day).
  const [startDate, setStartDate] = useState(ev.startDate ?? span.startDate ?? dayKey(new Date()));
  const [endDate, setEndDate] = useState(ev.endDate ?? "");
  const today = dayKey(new Date());
  const [confirmDeactivate, setConfirmDeactivate] = useState(false);
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
            <Button variant="secondary" onClick={() => { setEditing(false); setName(ev.name); setNotes(ev.notes); setStartDate(ev.startDate ?? span.startDate ?? today); setEndDate(ev.endDate ?? ""); }}>Cancel</Button>
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
              {ev.status === "active" ? <Tag tone="success" dot>Active</Tag> : <Tag tone="neutral" dot>Ended</Tag>}
            </p>
            <p data-testid="event-dates" className="mt-0.5 flex items-center gap-1.5 text-xs whitespace-nowrap text-ink-muted">
              <CalendarRange className="size-3.5 shrink-0" />
              {fmtSpan(span.startDate, span.endDate)}
            </p>
            {span.startGuessed && <p className="text-[11px] text-ink-faint">Start taken from its first shift — edit to change</p>}
            <p className="truncate text-xs text-ink-faint lg:hidden">
              {ev.notes || "No notes"} · {assigned} staff assigned
            </p>
          </div>
          <p className="hidden truncate text-sm text-ink-muted lg:block" title={ev.notes}>{ev.notes || <span className="text-ink-faint">No notes</span>}</p>
          <p className="hidden text-sm text-ink-muted lg:block">{fmtNum(assigned)} staff assigned</p>
          <div className="flex items-center gap-2 lg:justify-end">
          <Button size="sm" variant="ghost" leftIcon={<Pencil className="size-3.5" />} onClick={() => setEditing(true)}>Edit</Button>
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
