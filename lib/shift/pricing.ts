/*
 * Pricing — money-critical. See CLAUDE.md "Non-negotiable business rules".
 *   Sheets:   price = round(sheetsQty * 400)  → every 0.5 sheet = 200 EGP
 *   Acrylic frame = 400 EGP each, Magnetic frame = 200 EGP each
 */

export const SHEET_PRICE_EGP = 400;

export const FRAME_PRICES = { Acrylic: 400, Magnetic: 200 } as const;
export type FrameType = keyof typeof FRAME_PRICES;
export const FRAME_TYPES: FrameType[] = ["Acrylic", "Magnetic"];

/** Sheets are sold (and wasted) in 0.5 increments. */
export const SHEET_STEP = 0.5;

export function autoSheetsPrice(sheetsQty: number): number {
  if (sheetsQty <= 0) return 0;
  return Math.round(sheetsQty * SHEET_PRICE_EGP);
}

/** Add/subtract a step, never below 0, rounded to avoid float drift (0.1 precision). */
export function stepQty(qty: number, delta: number): number {
  return Math.max(0, Math.round((qty + delta) * 10) / 10);
}

export type CustomItem = { id: string; name: string; price: number };

export type Cart = {
  sheets: number;
  /** Staff override of the auto sheets price; null = use autoSheetsPrice(). */
  sheetsPriceOverride: number | null;
  frames: Record<FrameType, number>;
  custom: CustomItem[];
};

export const emptyCart = (): Cart => ({
  sheets: 0,
  sheetsPriceOverride: null,
  frames: { Acrylic: 0, Magnetic: 0 },
  custom: [],
});

export function sheetsLinePrice(cart: Cart): number {
  if (cart.sheets <= 0) return 0;
  return cart.sheetsPriceOverride ?? autoSheetsPrice(cart.sheets);
}

export function framesLinePrice(type: FrameType, count: number): number {
  return count * FRAME_PRICES[type];
}

export function cartSubtotal(cart: Cart): number {
  const frames = FRAME_TYPES.reduce((s, t) => s + framesLinePrice(t, cart.frames[t]), 0);
  const custom = cart.custom.reduce((s, c) => s + c.price, 0);
  return sheetsLinePrice(cart) + frames + custom;
}

export function cartHasItems(cart: Cart): boolean {
  return cart.sheets > 0 || cart.frames.Acrylic > 0 || cart.frames.Magnetic > 0 || cart.custom.length > 0;
}
