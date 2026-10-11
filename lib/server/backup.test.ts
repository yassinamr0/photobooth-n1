import { describe, expect, it } from "vitest";
import { backupFilename, serialize } from "./backup";

const ts = (iso: string) => ({ toDate: () => new Date(iso) });

describe("backup serialize", () => {
  it("turns Firestore Timestamps into ISO strings", () => {
    expect(serialize(ts("2026-10-11T08:30:00.000Z"))).toBe("2026-10-11T08:30:00.000Z");
    expect(serialize(new Date("2026-10-11T00:00:00.000Z"))).toBe("2026-10-11T00:00:00.000Z");
  });

  it("walks nested maps and arrays, leaving primitives alone", () => {
    const doc = {
      name: "Nour",
      amount: 800,
      ok: true,
      empty: null,
      createdAt: ts("2026-10-10T12:00:00.000Z"),
      frames: { Acrylic: 1, Magnetic: 0 },
      steps: [{ from: "2026-01", at: ts("2026-01-01T00:00:00.000Z") }],
    };
    expect(serialize(doc)).toEqual({
      name: "Nour",
      amount: 800,
      ok: true,
      empty: null,
      createdAt: "2026-10-10T12:00:00.000Z",
      frames: { Acrylic: 1, Magnetic: 0 },
      steps: [{ from: "2026-01", at: "2026-01-01T00:00:00.000Z" }],
    });
  });

  it("round-trips through JSON (no non-serialisable values left)", () => {
    const out = serialize({ t: ts("2026-10-11T00:00:00.000Z"), xs: [1, "a", { t: ts("2026-10-11T00:00:00.000Z") }] });
    expect(JSON.parse(JSON.stringify(out))).toEqual(out);
  });

  it("filenames are dated", () => {
    expect(backupFilename(new Date("2026-10-11T23:00:00.000Z"))).toBe("booth-log-backup-2026-10-11.json");
  });
});
