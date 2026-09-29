import { describe, expect, it } from "vitest";
import { fmtDuration, resolveShiftTimes } from "./time";

const HOUR = 3600_000;
// Local-time base so the test is timezone-independent.
const base = new Date(2026, 8, 29, 18, 3).toISOString();

describe("resolveShiftTimes — midnight rollover", () => {
  it("normal same-day shift", () => {
    const r = resolveShiftTimes(base, "09:00", "17:00");
    expect(r.durationMs).toBe(8 * HOUR);
    expect(r.crossesMidnight).toBe(false);
  });
  it("end < start → +24h (18:00 → 02:00 is 8h, ends next day)", () => {
    const r = resolveShiftTimes(base, "18:00", "02:00");
    expect(r.durationMs).toBe(8 * HOUR);
    expect(r.crossesMidnight).toBe(true);
    expect(r.start.getDate()).toBe(29);
    expect(r.end.getDate()).toBe(30);
  });
  it("end == start is NOT a rollover (strict <, per CLAUDE.md) → 0h", () => {
    const r = resolveShiftTimes(base, "10:00", "10:00");
    expect(r.durationMs).toBe(0);
    expect(r.crossesMidnight).toBe(false);
  });
  it("23:30 → 00:15 is 45 minutes", () => {
    expect(resolveShiftTimes(base, "23:30", "00:15").durationMs).toBe(45 * 60_000);
  });
  it("never negative", () => {
    expect(resolveShiftTimes(base, "12:01", "12:00").durationMs).toBe(24 * HOUR - 60_000);
  });
  it("formats duration", () => expect(fmtDuration(8 * HOUR + 5 * 60_000)).toBe("8h 05m"));
});
