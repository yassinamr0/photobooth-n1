import { describe, expect, it } from "vitest";
import { emptyCart } from "./pricing";
import { checkSale, quickFill, saleDescription } from "./sale";

const cartWith = (sheets: number, acrylic = 0) => ({
  ...emptyCart(),
  sheets,
  frames: { Acrylic: acrylic, Magnetic: 0 },
});

describe("checkSale", () => {
  it("items + matching payment → total = payment, no hint", () => {
    const r = checkSale(cartWith(1.5, 1), { cash: 1000, visa: 0 });
    expect(r).toMatchObject({ subtotal: 1000, total: 1000, canLog: true, hint: null });
  });
  it("items but no payment → cannot log", () => {
    expect(checkSale(cartWith(1), { cash: 0, visa: 0 }).canLog).toBe(false);
  });
  it("split cash/visa in any combination", () => {
    expect(checkSale(cartWith(2), { cash: 300, visa: 500 })).toMatchObject({ total: 800, canLog: true, hint: null });
  });
  it("payment ≠ subtotal is allowed but flagged; total = payment", () => {
    const r = checkSale(cartWith(1), { cash: 350, visa: 0 });
    expect(r.canLog).toBe(true);
    expect(r.total).toBe(350);
    expect(r.hint?.tone).toBe("warning");
  });
  it("payment with no items is allowed with an info hint", () => {
    const r = checkSale(emptyCart(), { cash: 100, visa: 0 });
    expect(r).toMatchObject({ canLog: true, total: 100 });
    expect(r.hint?.tone).toBe("info");
  });
  it("nothing at all → cannot log", () => {
    expect(checkSale(emptyCart(), { cash: 0, visa: 0 }).canLog).toBe(false);
  });
  it("items with a zero subtotal (e.g. free custom item) can log without payment", () => {
    const c = { ...emptyCart(), custom: [{ id: "x", name: "Free print", price: 0 }] };
    expect(checkSale(c, { cash: 0, visa: 0 })).toMatchObject({ canLog: true, total: 0 });
  });
});

describe("saleDescription", () => {
  it("lists items", () => {
    const c = { ...cartWith(1.5, 1), custom: [{ id: "k", name: "Keychain", price: 50 }] };
    expect(saleDescription(c)).toBe("Sheets (1.5), Acrylic x1, Keychain");
  });
  it("payment only", () => expect(saleDescription(emptyCart())).toBe("Payment (no items)"));
});

describe("quickFill", () => {
  it("split 50/50 rounds cash, visa gets the remainder", () => {
    expect(quickFill("split", 1000)).toEqual({ cash: 500, visa: 500 });
    expect(quickFill("split", 1001)).toEqual({ cash: 501, visa: 500 });
  });
});
