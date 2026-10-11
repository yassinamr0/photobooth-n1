import { NextResponse, type NextRequest } from "next/server";
import { adminAuth, adminDb } from "@/lib/server/admin";
import { backupFilename, exportAll } from "@/lib/server/backup";

/*
 * Full-data backup (one JSON file: everything in Firestore).
 *
 * POST — "Download backup" button in P&L. Authorised by a signed-in, approved ADMIN's ID
 *        token (like the daily-summary test button). Returns the JSON as a file download.
 * GET  — Vercel Cron (vercel.json), weekly (Mondays). Authorised by CRON_SECRET. Emails the
 *        backup to BACKUP_EMAIL_TO || SUMMARY_EMAIL_TO as a .json attachment via Resend.
 *        Deduped per day via settings/backupLog so a same-day re-call never double-sends.
 * Env (Vercel): FIREBASE_SERVICE_ACCOUNT, CRON_SECRET (GET), RESEND_API_KEY + SUMMARY_EMAIL_TO
 *   (GET email) — all already used by the daily summary. Optional BACKUP_EMAIL_TO.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const backupTo = () => process.env.BACKUP_EMAIL_TO || process.env.SUMMARY_EMAIL_TO;

function missingEmailEnv(): string[] {
  const missing: string[] = [];
  if (!process.env.RESEND_API_KEY) missing.push("RESEND_API_KEY");
  if (!backupTo()) missing.push("SUMMARY_EMAIL_TO");
  if (!process.env.FIRESTORE_EMULATOR_HOST && !process.env.FIREBASE_SERVICE_ACCOUNT) missing.push("FIREBASE_SERVICE_ACCOUNT");
  return missing;
}

const today = () => new Date().toISOString().slice(0, 10);

/** Download the backup (admins only). */
export async function POST(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace(/^Bearer /, "");
  if (!token) return NextResponse.json({ error: "Sign in as an admin" }, { status: 401 });
  if (!process.env.FIRESTORE_EMULATOR_HOST && !process.env.FIREBASE_SERVICE_ACCOUNT) {
    return NextResponse.json({ error: "Backups aren't set up yet — FIREBASE_SERVICE_ACCOUNT is missing in Vercel" }, { status: 500 });
  }
  try {
    const { uid } = await adminAuth().verifyIdToken(token);
    const me = await adminDb().doc(`users/${uid}`).get();
    if (me.data()?.role !== "admin" || me.data()?.approved !== true) return NextResponse.json({ error: "Admins only" }, { status: 403 });
  } catch {
    return NextResponse.json({ error: "Sign in as an admin" }, { status: 401 });
  }
  try {
    const backup = await exportAll();
    const name = backupFilename();
    return new NextResponse(JSON.stringify(backup, null, 2), {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="${name}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

/** Weekly cron: email the backup as an attachment. */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const missing = missingEmailEnv();
  if (missing.length) return NextResponse.json({ error: `Backups aren't set up yet — missing ${missing.join(", ")}` }, { status: 500 });

  const day = today();
  const log = adminDb().doc("settings/backupLog");
  if ((await log.get()).data()?.lastSentDay === day) return NextResponse.json({ skipped: "Already sent today" });

  try {
    const backup = await exportAll();
    const name = backupFilename();
    const content = Buffer.from(JSON.stringify(backup, null, 2), "utf8").toString("base64");
    const c = backup.counts;
    const summary = `${c.users} staff · ${c.events} events · ${c.shifts} shifts · ${c.entries} sale/waste entries · ${c.expenses} one-off + ${c.recurringExpenses} monthly expenses`;
    const res = await fetch(process.env.RESEND_API_URL || "https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: process.env.SUMMARY_EMAIL_FROM || "Booth Log <onboarding@resend.dev>",
        to: backupTo()!.split(",").map((s) => s.trim()).filter(Boolean),
        subject: `Booth Log — weekly data backup (${day})`,
        text: `Your weekly Booth Log backup is attached as ${name}.\n\n${summary}.\n\nKeep this file somewhere safe. To restore it one day, send it back to whoever manages the app.`,
        attachments: [{ filename: name, content }],
      }),
    });
    if (!res.ok) throw new Error(`Resend refused the email (${res.status}): ${(await res.text()).slice(0, 300)}`);
    await log.set({ lastSentDay: day, counts: backup.counts, sentAt: new Date() }, { merge: true });
    return NextResponse.json({ sent: true, counts: backup.counts });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
}
