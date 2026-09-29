"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Tag } from "@/components/ui/Tag";
import { fmtTime, sortNewestFirst } from "@/lib/shift/summary";
import type { Entry } from "@/lib/shift/types";

/** LOCKED card #4 — "This shift": every entry logged this shift, newest first. */
export function ShiftLog({ entries, onDelete }: { entries: Entry[]; onDelete: (id: string) => Promise<void> }) {
  const sorted = sortNewestFirst(entries);
  return (
    <Card padding="md" data-testid="card-this-shift">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-display text-lg font-bold">This shift</h2>
        <span data-testid="entry-count" className="text-xs text-ink-faint">
          {sorted.length} {sorted.length === 1 ? "entry" : "entries"}
        </span>
      </div>
      {sorted.length === 0 ? (
        <p className="py-4 text-center text-sm text-ink-faint">No entries yet this shift.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-line">
          {sorted.map((e) => (
            <EntryRow key={e.id} entry={e} onDelete={onDelete} />
          ))}
        </ul>
      )}
    </Card>
  );
}

function EntryRow({ entry: e, onDelete }: { entry: Entry; onDelete: (id: string) => Promise<void> }) {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  return (
    <li className="flex items-start justify-between gap-3 py-3" data-testid="entry-row">
      <div className="min-w-0">
        <div className="text-xs text-ink-faint tabular-nums">{fmtTime(e.time)}</div>
        <div className="truncate text-sm font-medium text-ink">{e.desc}</div>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {e.type === "waste" ? (
            <Tag tone="danger">WASTE</Tag>
          ) : (
            <>
              {e.cash > 0 && <Tag tone="success">CASH {e.cash}</Tag>}
              {e.visa > 0 && <Tag tone="info">VISA {e.visa}</Tag>}
            </>
          )}
        </div>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-2">
        <span className="font-display font-bold tabular-nums text-ink">{e.total} EGP</span>
        {confirming ? (
          <div className="flex gap-1.5">
            <button type="button" onClick={() => setConfirming(false)}
              className="h-8 rounded-full border border-line px-3 text-xs text-ink-muted">Keep</button>
            <button type="button" disabled={busy}
              onClick={async () => { setBusy(true); try { await onDelete(e.id); } finally { setBusy(false); setConfirming(false); } }}
              className="h-8 rounded-full border border-danger/50 bg-danger-dim px-3 text-xs font-semibold text-danger">
              Delete
            </button>
          </div>
        ) : (
          <button type="button" aria-label={`Delete entry ${e.desc}`} onClick={() => setConfirming(true)}
            className="grid size-8 place-items-center rounded-full text-ink-faint hover:bg-danger-dim hover:text-danger">
            <Trash2 className="size-4" />
          </button>
        )}
      </div>
    </li>
  );
}
