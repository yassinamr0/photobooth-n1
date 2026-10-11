import { adminDb } from "./admin";

/*
 * Full data backup (server only — admin-only download + weekly emailed backup).
 * One JSON file with every collection: users, events (+ their stock & stockLogs), shifts,
 * entries (sales/waste), expenses, recurringExpenses, and the settings docs.
 *
 * Not included: Firebase Auth login accounts (emails/passwords) — those live in Firebase
 * Auth, not Firestore, and can't be exported. The /users profile docs (name, role, approved,
 * assignedEventId) ARE included, which is what the business needs.
 */

export type Backup = {
  app: "Booth Log";
  version: 1;
  exportedAt: string;
  counts: Record<string, number>;
  collections: Record<string, Row[]>;
};

type Row = Record<string, unknown>;

/** A Firestore Timestamp (Admin SDK) — has toDate(); we avoid importing the type. */
function isTimestamp(v: unknown): v is { toDate: () => Date } {
  return !!v && typeof v === "object" && typeof (v as { toDate?: unknown }).toDate === "function";
}

/**
 * Plain, readable JSON: Firestore Timestamps become ISO strings; maps and arrays are walked
 * recursively; everything else is left as-is. Pure — unit-tested without the SDK.
 */
export function serialize(value: unknown): unknown {
  if (isTimestamp(value)) return value.toDate().toISOString();
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(serialize);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value as Row).map(([k, v]) => [k, serialize(v)]));
  }
  return value;
}

/** booth-log-backup-2026-10-11.json */
export function backupFilename(date = new Date()): string {
  return `booth-log-backup-${date.toISOString().slice(0, 10)}.json`;
}

export async function exportAll(): Promise<Backup> {
  const db = adminDb();
  const dump = async (path: string): Promise<Row[]> =>
    (await db.collection(path).get()).docs.map((d) => ({ id: d.id, ...(serialize(d.data()) as Row) }));

  const [users, events, shifts, entries, expenses, recurringExpenses, settings] = await Promise.all([
    dump("users"),
    dump("events"),
    dump("shifts"),
    dump("entries"),
    dump("expenses"),
    dump("recurringExpenses"),
    dump("settings"),
  ]);

  // Each event's per-booth stock + stock history.
  await Promise.all(
    events.map(async (ev) => {
      const id = ev.id as string;
      const [stock, stockLogs] = await Promise.all([dump(`events/${id}/stock`), dump(`events/${id}/stockLogs`)]);
      ev.stock = stock;
      ev.stockLogs = stockLogs;
    }),
  );

  const collections = { users, events, shifts, entries, expenses, recurringExpenses, settings };
  const counts = Object.fromEntries(Object.entries(collections).map(([k, rows]) => [k, rows.length]));
  return { app: "Booth Log", version: 1, exportedAt: new Date().toISOString(), counts, collections };
}
