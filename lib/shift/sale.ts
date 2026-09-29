import { cartHasItems, cartSubtotal, type Cart } from "./pricing";

export type Payment = { cash: number; visa: number };

export type SaleCheck = {
  subtotal: number;
  paymentTotal: number;
  /** What will be stored as the entry's total. */
  total: number;
  canLog: boolean;
  /** Non-blocking heads-up for the staff member (null = nothing to say). */
  hint: { tone: "warning" | "info"; text: string } | null;
};

/**
 * Sale rules, ported exactly from the legacy app:
 * - Loggable if (items AND (subtotal is 0 OR a payment was entered)) OR (no items AND payment > 0).
 * - Stored total = cash + visa when a payment was entered, otherwise the items subtotal.
 * - Payment ≠ subtotal is allowed (discount / tip) but flagged.
 */
export function checkSale(cart: Cart, payment: Payment): SaleCheck {
  const subtotal = cartSubtotal(cart);
  const paymentTotal = payment.cash + payment.visa;
  const hasItems = cartHasItems(cart);
  const canLog = (hasItems && (subtotal === 0 || paymentTotal > 0)) || (!hasItems && paymentTotal > 0);
  const total = paymentTotal > 0 ? paymentTotal : subtotal;

  let hint: SaleCheck["hint"] = null;
  if (hasItems && paymentTotal > 0 && paymentTotal !== subtotal) {
    hint = {
      tone: "warning",
      text: `Heads up: payment (${paymentTotal}) doesn't match items subtotal (${subtotal}) — that's fine if intentional`,
    };
  } else if (!hasItems && paymentTotal > 0) {
    hint = { tone: "info", text: "Logging a payment with no items attached" };
  }
  return { subtotal, paymentTotal, total, canLog, hint };
}

export function saleDescription(cart: Cart): string {
  const parts: string[] = [];
  if (cart.sheets > 0) parts.push(`Sheets (${cart.sheets})`);
  if (cart.frames.Acrylic > 0) parts.push(`Acrylic x${cart.frames.Acrylic}`);
  if (cart.frames.Magnetic > 0) parts.push(`Magnetic x${cart.frames.Magnetic}`);
  cart.custom.forEach((c) => parts.push(c.name));
  return parts.length ? parts.join(", ") : "Payment (no items)";
}

/** Payment quick-fill buttons. */
export function quickFill(mode: "cash" | "visa" | "split" | "clear", subtotal: number): Payment {
  switch (mode) {
    case "cash":
      return { cash: subtotal, visa: 0 };
    case "visa":
      return { cash: 0, visa: subtotal };
    case "split": {
      const cash = Math.round(subtotal / 2);
      return { cash, visa: subtotal - cash };
    }
    case "clear":
      return { cash: 0, visa: 0 };
  }
}
