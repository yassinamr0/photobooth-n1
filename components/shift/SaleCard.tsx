"use client";

import { useState } from "react";
import { Minus, Plus, X } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Tag } from "@/components/ui/Tag";
import { cn } from "@/lib/cn";
import {
  autoSheetsPrice,
  emptyCart,
  FRAME_PRICES,
  FRAME_TYPES,
  framesLinePrice,
  sheetsLinePrice,
  stepQty,
  type Cart,
  type FrameType,
} from "@/lib/shift/pricing";
import { checkSale, quickFill, type Payment, type SaleCheck } from "@/lib/shift/sale";
import { Chip, NumberInput, Stepper } from "./Stepper";
import { fmtNum } from "@/lib/format";

const SHEET_PRESETS = [0.5, 1, 1.5, 2, 3];

function newId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

/** LOCKED card #2 — "New sale". */
export function SaleCard({
  onLog,
}: {
  onLog: (cart: Cart, payment: Payment, check: SaleCheck) => Promise<boolean>;
}) {
  const [cart, setCart] = useState<Cart>(emptyCart);
  const [cash, setCash] = useState<number | null>(0);
  const [visa, setVisa] = useState<number | null>(0);
  const [customOpen, setCustomOpen] = useState(false);
  const [customName, setCustomName] = useState("");
  const [customPrice, setCustomPrice] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);

  const payment: Payment = { cash: cash ?? 0, visa: visa ?? 0 };
  const check = checkSale(cart, payment);

  // Changing the quantity resets any manual price back to the formula (legacy behaviour).
  const setSheets = (sheets: number) => setCart((c) => ({ ...c, sheets, sheetsPriceOverride: null }));
  const setFrame = (t: FrameType, n: number) =>
    setCart((c) => ({ ...c, frames: { ...c.frames, [t]: Math.max(0, n) } }));

  function addCustom() {
    const name = customName.trim();
    if (!name || customPrice === null || customPrice < 0) return;
    setCart((c) => ({ ...c, custom: [...c.custom, { id: newId(), name, price: customPrice }] }));
    setCustomName("");
    setCustomPrice(null);
  }

  function fill(mode: "cash" | "visa" | "split" | "clear") {
    const p = quickFill(mode, check.subtotal);
    setCash(p.cash);
    setVisa(p.visa);
  }

  async function log() {
    if (!check.canLog || busy) return;
    setBusy(true);
    try {
      if (await onLog(cart, payment, check)) {
        setCart(emptyCart());
        setCash(0);
        setVisa(0);
      }
    } finally {
      setBusy(false);
    }
  }

  const sheetsPrice = cart.sheetsPriceOverride ?? autoSheetsPrice(cart.sheets);

  const lines: { label: string; price: number; customId?: string }[] = [];
  if (cart.sheets > 0) lines.push({ label: `Sheets (${cart.sheets})`, price: sheetsLinePrice(cart) });
  FRAME_TYPES.forEach((t) => {
    if (cart.frames[t] > 0) lines.push({ label: `${t} frame x${cart.frames[t]}`, price: framesLinePrice(t, cart.frames[t]) });
  });
  cart.custom.forEach((c) => lines.push({ label: c.name, price: c.price, customId: c.id }));

  const subLabel = "text-xs font-medium tracking-wide text-ink-faint uppercase";

  return (
    <Card padding="md" data-testid="card-new-sale">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-display text-lg font-bold">New sale</h2>
        <Tag tone="accent">Sheets</Tag>
      </div>

      {/* Sheets */}
      <Stepper label="sheets" unit="sheets" value={cart.sheets} onStep={(d) => setSheets(stepQty(cart.sheets, d))} />
      <div className="mt-3 flex items-center gap-3">
        <label htmlFor="sheets-price" className={subLabel}>Price</label>
        <NumberInput
          id="sheets-price"
          value={sheetsPrice}
          onChange={(v) => setCart((c) => ({ ...c, sheetsPriceOverride: v ?? 0 }))}
          disabled={cart.sheets <= 0}
          className="flex-1"
        />
        <span className="text-sm text-ink-muted">EGP</span>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {SHEET_PRESETS.map((p) => (
          <Chip key={p} onClick={() => setSheets(p)} active={cart.sheets === p}>{p}</Chip>
        ))}
        <Chip onClick={() => setSheets(0)}>clear</Chip>
      </div>

      {/* Frames */}
      <h3 className={cn(subLabel, "mt-6 mb-2")}>Frames</h3>
      <div className="grid grid-cols-2 gap-3">
        {FRAME_TYPES.map((t) => {
          const n = cart.frames[t];
          return (
            <div
              key={t}
              role="button"
              tabIndex={0}
              aria-label={`Add ${t} frame`}
              onClick={() => setFrame(t, n + 1)}
              onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && setFrame(t, n + 1)}
              className={cn(
                "cursor-pointer rounded-card border p-3 transition-colors select-none",
                n > 0 ? "border-magenta/60 bg-accent-dim" : "border-line bg-surface-2 hover:border-line-strong",
              )}
            >
              <div className="font-display font-bold">{t}</div>
              <div className="text-sm text-gold">{fmtNum(FRAME_PRICES[t])} EGP</div>
              <div className="mt-2 flex items-center justify-between">
                <button type="button" aria-label={`Remove ${t} frame`} disabled={n <= 0}
                  onClick={(e) => { e.stopPropagation(); setFrame(t, n - 1); }}
                  className="grid size-9 place-items-center rounded-full border border-line-strong bg-canvas/60 disabled:opacity-40">
                  <Minus className="size-4" />
                </button>
                <span data-testid={`${t}-qty`} className="font-display text-xl font-bold tabular-nums">{n}</span>
                <button type="button" aria-label={`Add one ${t} frame`}
                  onClick={(e) => { e.stopPropagation(); setFrame(t, n + 1); }}
                  className="grid size-9 place-items-center rounded-full border border-line-strong bg-canvas/60">
                  <Plus className="size-4" />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Custom item */}
      <button type="button" onClick={() => setCustomOpen((o) => !o)}
        className="mt-4 text-sm font-semibold text-magenta hover:underline">
        + Add custom item
      </button>
      {customOpen && (
        <div className="mt-2 flex gap-2">
          <input aria-label="Custom item name" placeholder="Item name" value={customName}
            onChange={(e) => setCustomName(e.target.value)}
            className="h-12 min-w-0 flex-[2] rounded-inner border border-line bg-surface-2 px-3 text-ink outline-none focus:border-magenta/70" />
          <NumberInput id="custom-price" aria-label="Custom item price" placeholder="EGP" value={customPrice}
            onChange={setCustomPrice} className="flex-1" />
          <Button variant="secondary" size="lg" onClick={addCustom}
            disabled={!customName.trim() || customPrice === null}>Add</Button>
        </div>
      )}

      {/* Cart */}
      <div className="mt-4 rounded-inner border border-line bg-canvas/50 p-3" data-testid="cart">
        {lines.length === 0 ? (
          <p className="py-1 text-center text-sm text-ink-faint">Nothing added yet</p>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {lines.map((l) => (
              <li key={l.customId ?? l.label} className="flex items-center justify-between gap-3 text-sm">
                <span className="truncate text-ink">{l.label}</span>
                <span className="flex items-center gap-2 tabular-nums text-ink-muted">
                  {fmtNum(l.price)} EGP
                  {l.customId && (
                    <button type="button" aria-label={`Remove ${l.label}`}
                      onClick={() => setCart((c) => ({ ...c, custom: c.custom.filter((x) => x.id !== l.customId) }))}
                      className="grid size-6 place-items-center rounded-full text-ink-faint hover:bg-danger-dim hover:text-danger">
                      <X className="size-3.5" />
                    </button>
                  )}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
      <p className="mt-2 text-right text-sm text-ink-muted">
        Items subtotal: <span data-testid="subtotal" className="font-semibold text-ink tabular-nums">{fmtNum(check.subtotal)} EGP</span>
      </p>

      {/* Payment */}
      <div className="mt-4 grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="pay-cash" className={cn(subLabel, "mb-1.5 block text-success/80")}>Cash EGP</label>
          <NumberInput id="pay-cash" value={cash} onChange={setCash} tone="cash" />
        </div>
        <div>
          <label htmlFor="pay-visa" className={cn(subLabel, "mb-1.5 block text-info/80")}>Visa EGP</label>
          <NumberInput id="pay-visa" value={visa} onChange={setVisa} tone="visa" />
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <Chip onClick={() => fill("cash")}>All cash</Chip>
        <Chip onClick={() => fill("visa")}>All visa</Chip>
        <Chip onClick={() => fill("split")}>Split 50/50</Chip>
        <Chip onClick={() => fill("clear")}>Clear</Chip>
      </div>
      {check.hint && (
        <p data-testid="payment-hint"
          className={cn("mt-3 rounded-inner px-3 py-2 text-sm",
            check.hint.tone === "warning" ? "bg-warning-dim text-warning" : "bg-surface-2 text-ink-muted")}>
          {check.hint.text}
        </p>
      )}

      <div className="mt-5 flex items-baseline justify-between">
        <span className="text-sm text-ink-muted">Logging</span>
        <span data-testid="logging-total" className="font-display text-3xl font-extrabold text-gold tabular-nums">{fmtNum(check.total)} EGP</span>
      </div>
      <Button size="lg" className="mt-3 w-full" disabled={!check.canLog} loading={busy} onClick={log}>
        Log sale
      </Button>
    </Card>
  );
}
