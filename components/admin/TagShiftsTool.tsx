"use client";

import { useMemo, useState } from "react";
import { Info, X } from "lucide-react";
import { Card, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { authErrorMessage } from "@/lib/auth/errors";
import { tagShiftsWithEvent } from "@/lib/admin/firestore";
import { formatEGP } from "@/lib/format";
import { aggregate, fmtTime } from "@/lib/shift/summary";
import { useDashboardRaw, useEvents } from "./DashboardData";

const localDay = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/**
 * One-time admin tool: give shifts that have NO event (logged in the legacy app) an event,
 * e.g. District 5. Only no-event shifts are ever listed or touched — a real eventId snapshot
 * is never changed. Tagged shifts are stock-exempt: they count toward that event's revenue
 * and stats but never touch its inventory.
 */
export function TagShiftsTool({ close }: { close: () => void }) {
  const { raw } = useDashboardRaw();
  const { events } = useEvents();
  const toast = useToast();
  const [day, setDay] = useState(() => localDay(new Date()));
  const [eventId, setEventId] = useState("");
  const [skip, setSkip] = useState<Set<string>>(new Set());
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);

  const candidates = useMemo(
    () =>
      raw.shifts
        .filter((s) => !s.eventId && localDay(new Date(s.startTime)) === day)
        .sort((a, b) => a.startTime.localeCompare(b.startTime))
        .map((s) => ({ shift: s, total: aggregate(raw.entries.filter((e) => e.shiftId === s.id)).total })),
    [raw.shifts, raw.entries, day],
  );
  const chosen = candidates.filter((c) => !skip.has(c.shift.id));
  const eventName = events.find((e) => e.id === eventId)?.name;

  async function apply() {
    setBusy(true);
    try {
      await tagShiftsWithEvent(chosen.map((c) => c.shift.id), eventId);
      toast(`Tagged ${chosen.length} shift${chosen.length === 1 ? "" : "s"} with ${eventName}`, "success");
      setConfirming(false);
      setSkip(new Set());
    } catch (e) {
      toast(`Could not tag: ${authErrorMessage(e)}`, "danger");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card padding="lg" data-testid="tag-tool" className="border-magenta/35">
      <CardHeader
        title="Tag shifts with no event"
        subtitle="For shifts logged in the old app, which have no event. Pick a day and the event they belong to."
        action={
          <button type="button" onClick={close} aria-label="Close" className="text-ink-faint hover:text-ink">
            <X className="size-5" />
          </button>
        }
      />
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1.5 text-xs font-medium tracking-wide text-ink-faint uppercase">
          Day
          <input type="date" data-testid="tag-day" value={day} onChange={(e) => { setDay(e.target.value); setSkip(new Set()); setConfirming(false); }}
            className="h-10 rounded-inner border border-line bg-surface-2 px-3 text-sm text-ink normal-case outline-none [color-scheme:dark] focus:border-magenta/70" />
        </label>
        <label className="flex flex-col gap-1.5 text-xs font-medium tracking-wide text-ink-faint uppercase">
          Event
          <select data-testid="tag-event" value={eventId} onChange={(e) => { setEventId(e.target.value); setConfirming(false); }}
            className="h-10 min-w-[200px] rounded-inner border border-line bg-surface-2 px-3 text-sm text-ink normal-case outline-none focus:border-magenta/70">
            <option value="">Choose an event…</option>
            {events.map((ev) => (
              <option key={ev.id} value={ev.id}>{ev.name}{ev.status === "inactive" ? " (inactive)" : ""}</option>
            ))}
          </select>
        </label>
      </div>

      {candidates.length === 0 ? (
        <p data-testid="tag-empty" className="mt-4 rounded-inner border border-dashed border-line px-4 py-6 text-center text-sm text-ink-faint">
          No shifts without an event on this day.
        </p>
      ) : (
        <ul className="mt-4 flex flex-col divide-y divide-line rounded-inner border border-line">
          {candidates.map(({ shift, total }) => (
            <li key={shift.id} data-testid="tag-candidate">
              <label className="flex cursor-pointer items-center gap-3 px-4 py-2.5 text-sm">
                <input type="checkbox" className="size-4 accent-[#d946ef]" checked={!skip.has(shift.id)}
                  onChange={(e) => {
                    setConfirming(false);
                    setSkip((prev) => {
                      const next = new Set(prev);
                      if (e.target.checked) next.delete(shift.id);
                      else next.add(shift.id);
                      return next;
                    });
                  }} />
                <span className="font-semibold text-ink tabular-nums">
                  {fmtTime(shift.startTime)} → {shift.endTime ? fmtTime(shift.endTime) : "now"}
                </span>
                <span className="min-w-0 flex-1 truncate text-ink-muted">{shift.staffName}</span>
                <span className="font-semibold text-gold tabular-nums">{formatEGP(total)}</span>
              </label>
            </li>
          ))}
        </ul>
      )}

      <p className="mt-3 flex items-start gap-2 text-xs text-ink-faint">
        <Info className="mt-px size-3.5 shrink-0" />
        Tagged shifts count toward that event&apos;s revenue and statistics, but never change its inventory. Shifts that already
        have an event are never changed.
      </p>

      {candidates.length > 0 && (
        confirming ? (
          <div data-testid="tag-confirm" className="mt-4 flex flex-wrap items-center gap-3 rounded-inner border border-warning/40 bg-warning-dim/60 px-4 py-3 text-sm">
            <span className="flex-1 text-ink">
              Tag {chosen.length} shift{chosen.length === 1 ? "" : "s"} with <b>{eventName}</b>? This can&apos;t be undone from the app.
            </span>
            <Button size="sm" variant="secondary" onClick={() => setConfirming(false)}>Cancel</Button>
            <Button size="sm" loading={busy} data-testid="tag-apply" onClick={apply}>Tag shifts</Button>
          </div>
        ) : (
          <Button className="mt-4" size="sm" data-testid="tag-next" disabled={!eventId || chosen.length === 0} onClick={() => setConfirming(true)}>
            Tag {chosen.length} shift{chosen.length === 1 ? "" : "s"}{eventName ? ` with ${eventName}` : ""}
          </Button>
        )
      )}
    </Card>
  );
}
