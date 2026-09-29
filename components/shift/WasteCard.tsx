"use client";

import { useState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Tag } from "@/components/ui/Tag";
import { stepQty } from "@/lib/shift/pricing";
import { NumberInput, Stepper } from "./Stepper";

/** LOCKED card #3 — "Waste" (hadr). Cost is optional and never counted as revenue. */
export function WasteCard({ onLog }: { onLog: (hadr: number, cost: number) => Promise<boolean> }) {
  const [hadr, setHadr] = useState(0);
  const [cost, setCost] = useState<number | null>(0);
  const [busy, setBusy] = useState(false);

  async function log() {
    if (hadr <= 0 || busy) return;
    setBusy(true);
    try {
      if (await onLog(hadr, cost ?? 0)) {
        setHadr(0);
        setCost(0);
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card padding="md" data-testid="card-waste">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-display text-lg font-bold">Hadr</h2>
        <Tag tone="danger">Waste</Tag>
      </div>
      <Stepper label="hadr" unit="sheets" tone="pink" value={hadr} onStep={(d) => setHadr(stepQty(hadr, d))} />
      <div className="mt-3 flex items-center gap-3">
        <label htmlFor="hadr-cost" className="text-xs font-medium tracking-wide text-ink-faint uppercase">
          Cost (optional)
        </label>
        <NumberInput id="hadr-cost" value={cost} onChange={setCost} tone="pink" className="flex-1" />
        <span className="text-sm text-ink-muted">EGP</span>
      </div>
      <Button variant="danger" size="lg" className="mt-4 w-full" disabled={hadr <= 0} loading={busy} onClick={log}>
        Log waste
      </Button>
    </Card>
  );
}
