import { describe, expect, it } from "vitest";
import { autoSheetsPrice, cartSubtotal, emptyCart, FRAME_PRICES, stepQty } from "./pricing";

describe("autoSheetsPrice — round(sheets × 400), every 0.5 sheet = 200 EGP", () => {
  it.each([
    [0, 0], [0.5, 200], [1, 400], [1.5, 600], [2, 800], [2.5, 1000],
    [3, 1200], [3.5, 1400], [4, 1600], [4.5, 1800], [5, 2000],
  ])("%s sheets → %s EGP", (q, egp) => expect(autoSheetsPrice(q)).toBe(egp));
  it("never negative", () => expect(autoSheetsPrice(-1)).toBe(0));
});

describe("frames", () => {
  it("acrylic 400, magnetic 200", () => expect(FRAME_PRICES).toEqual({ Acrylic: 400, Magnetic: 200 }));
});

describe("stepQty", () => {
  it("0.5 steps, clamped at 0, no float drift", () => {
    let q = 0;
    for (let i = 0; i < 7; i++) q = stepQty(q, 0.5);
    expect(q).toBe(3.5);
    expect(stepQty(0, -0.5)).toBe(0);
  });
});

describe("cartSubtotal", () => {
  it("sheets auto + frames + custom", () => {
    const c = emptyCart();
    c.sheets = 1.5;
    c.frames = { Acrylic: 1, Magnetic: 2 };
    c.custom = [{ id: "a", name: "Keychain", price: 150 }];
    expect(cartSubtotal(c)).toBe(600 + 400 + 400 + 150);
  });
  it("manual sheets price override replaces the auto price", () => {
    const c = emptyCart();
    c.sheets = 2;
    c.sheetsPriceOverride = 700;
    expect(cartSubtotal(c)).toBe(700);
  });
  it("override is ignored when there are no sheets", () => {
    const c = emptyCart();
    c.sheetsPriceOverride = 700;
    expect(cartSubtotal(c)).toBe(0);
  });
});
