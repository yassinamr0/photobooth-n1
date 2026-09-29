import { dayKey } from "@/lib/admin/range";
import type { ScopedDashboard } from "@/lib/admin/scope";
import { FRAME_PRICES } from "@/lib/shift/pricing";
import { costsOn, paperPerSheet, type CostStep } from "./costs";
import { feeOn, saleFee, type FeeStep } from "./fees";

/*
 * Profit per product — ANALYSIS ONLY (never subtracted from the headline P&L again).
 * A sale stores only its total paid, so revenue is split per sale:
 *   - frames always count at full price (Acrylic 400, Magnetic 200 — owner's decision);
 *   - custom items at their own price;
 *   - prints take whatever is left (so discounts / price overrides land on prints);
 *   - a sale with no prints puts any difference in "Adjustments".
 * The sale's card fee is shared between its products by revenue.
 * Materials: per printed sheet = box price ÷ sheets per BOX (the box includes its ink) for
 * prints; frame cost for frames.
 * Costs/fees use the settings in force on the day the sale's SHIFT started.
 */

export type ProductKey = "prints" | "acrylic" | "magnetic" | "custom" | "adjust";
export type ProductRow = {
  key: ProductKey;
  label: string;
  units: number; // prints = 0.5-sheet prints; frames = pieces; custom = items; adjust = sales
  revenue: number;
  fees: number;
  materials: number | null; // null = cost not set
  profit: number | null;
};

export type ProductBreakdown = {
  rows: ProductRow[];
  materials: number | null; // total, null when any sold product's cost is missing
  missingCosts: boolean;
  waste: { sheets: number; cost: number | null };
};

export function productBreakdown(
  d: ScopedDashboard,
  fees: FeeStep[],
  costs: CostStep[],
  sheetsPerBox: number,
): ProductBreakdown {
  const startDay = new Map(d.shifts.map((s) => [s.shift.id, dayKey(new Date(s.shift.startTime))]));
  const dayOf = (shiftId: string, time: string) => startDay.get(shiftId) ?? dayKey(new Date(time || Date.now()));
  const acc: Record<ProductKey, { units: number; revenue: number; fees: number; materials: number; missing: boolean }> = {
    prints: { units: 0, revenue: 0, fees: 0, materials: 0, missing: false },
    acrylic: { units: 0, revenue: 0, fees: 0, materials: 0, missing: false },
    magnetic: { units: 0, revenue: 0, fees: 0, materials: 0, missing: false },
    custom: { units: 0, revenue: 0, fees: 0, materials: 0, missing: false },
    adjust: { units: 0, revenue: 0, fees: 0, materials: 0, missing: false },
  };
  const perSheet = (day: string) => paperPerSheet(costsOn(costs, day), sheetsPerBox);
  let wasteSheets = 0;
  let wasteCost: number | null = 0;

  for (const e of d.entries) {
    const day = dayOf(e.shiftId, e.time);
    if (e.type === "waste") {
      wasteSheets += e.hadr || 0;
      const ps = perSheet(day);
      wasteCost = ps == null || wasteCost == null ? null : wasteCost + (e.hadr || 0) * ps;
      continue;
    }
    const a = e.frames?.Acrylic || 0;
    const m = e.frames?.Magnetic || 0;
    const parts: Record<ProductKey, number> = {
      acrylic: a * FRAME_PRICES.Acrylic,
      magnetic: m * FRAME_PRICES.Magnetic,
      custom: (e.custom ?? []).reduce((s, c) => s + (c.price || 0), 0),
      prints: 0,
      adjust: 0,
    };
    const rest = (e.total || 0) - parts.acrylic - parts.magnetic - parts.custom;
    if ((e.sheets || 0) > 0) parts.prints = rest;
    else if (Math.abs(rest) > 0.004) parts.adjust = rest;

    const fee = saleFee(feeOn(fees, day), e.visa || 0);
    const positive = (Object.keys(parts) as ProductKey[]).filter((k) => parts[k] > 0);
    const posSum = positive.reduce((s, k) => s + parts[k], 0);
    for (const k of Object.keys(parts) as ProductKey[]) {
      acc[k].revenue += parts[k];
      if (posSum > 0 && parts[k] > 0) acc[k].fees += (fee * parts[k]) / posSum;
    }
    if (posSum === 0 && fee > 0) acc.adjust.fees += fee;

    const c = costsOn(costs, day);
    if ((e.sheets || 0) > 0) {
      acc.prints.units += (e.sheets || 0) / 0.5;
      const ps = perSheet(day);
      if (ps == null) acc.prints.missing = true;
      else acc.prints.materials += (e.sheets || 0) * ps;
    }
    if (a > 0) {
      acc.acrylic.units += a;
      if (c?.acrylic == null) acc.acrylic.missing = true;
      else acc.acrylic.materials += a * c.acrylic;
    }
    if (m > 0) {
      acc.magnetic.units += m;
      if (c?.magnetic == null) acc.magnetic.missing = true;
      else acc.magnetic.materials += m * c.magnetic;
    }
    acc.custom.units += (e.custom ?? []).length;
    if (parts.adjust !== 0) acc.adjust.units += 1;
  }

  const LABEL: Record<ProductKey, string> = {
    prints: "Prints (0.5 sheet)", acrylic: "Acrylic frames", magnetic: "Magnetic frames", custom: "Custom items", adjust: "Adjustments",
  };
  const rows: ProductRow[] = (Object.keys(acc) as ProductKey[])
    .filter((k) => acc[k].units > 0 || Math.abs(acc[k].revenue) > 0.004)
    .map((k) => {
      const x = acc[k];
      const materials = x.missing ? null : x.materials;
      return { key: k, label: LABEL[k], units: x.units, revenue: x.revenue, fees: x.fees, materials, profit: materials == null ? null : x.revenue - x.fees - materials };
    });
  const missingCosts = rows.some((r) => r.materials == null);
  return {
    rows,
    materials: missingCosts ? null : rows.reduce((s, r) => s + (r.materials ?? 0), 0),
    missingCosts,
    waste: { sheets: wasteSheets, cost: wasteCost },
  };
}
