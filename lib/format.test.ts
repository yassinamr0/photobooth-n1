import { describe, expect, it } from "vitest";
import { fmtNum, formatEGP } from "./format";

describe("number formatting — thousands separators", () => {
  it("groups with commas, up to 1 decimal", () => {
    expect(fmtNum(1000)).toBe("1,000");
    expect(fmtNum(14400)).toBe("14,400");
    expect(fmtNum(1234.5)).toBe("1,234.5");
    expect(fmtNum(0.5)).toBe("0.5");
    expect(fmtNum(999)).toBe("999");
    expect(fmtNum(-2)).toBe("-2");
  });
  it("EGP amounts too", () => expect(formatEGP(14400)).toBe("14,400 EGP"));
});
