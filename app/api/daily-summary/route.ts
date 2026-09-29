import { NextResponse, type NextRequest } from "next/server";
import { adminAuth, adminDb } from "@/lib/server/admin";
import { parseUserDoc } from "@/lib/users";
import { parseEntry, parseShift } from "@/lib/shift/firestore";
import { parsePaperSettings } from "@/lib/shift/paper";
import { parseEvent, parseStock } from "@/lib/inventory/firestore";
import { emptyInventory, STOCK_TYPES, type EventInventory, type StockType } from "@/lib/inventory/types";
import { parseCostSteps, parseExpense, parseFeeSteps, parseRecurring } from "@/lib/pnl/firestore";
import { buildDailySummary } from "@/lib/summary/build";
import { renderSummaryEmail } from "@/lib/summary/email";

/*
 * Daily summary email (Resend), about the previous day, at 9:00 Cairo time.
 *
 * GET  — called by Vercel Cron (vercel.json), authorised by CRON_SECRET. Two cron entries
 *        (06:00 and 07:00 UTC) cover Cairo summer/winter time; the route only sends once the
 *        Cairo clock has reached 9:00 and only once per day (settings/summaryLog).
 * POST — "Send test email now" in P&L, authorised by a signed-in, approved ADMIN's ID token.
 * Env (Vercel): RESEND_API_KEY, SUMMARY_EMAIL_TO, FIREBASE_SERVICE_ACCOUNT, CRON_SECRET,
 *   optional SUMMARY_EMAIL_FROM, APP_URL.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// All the day/month maths below runs in the booths' own time zone.
process.env.TZ = "Africa/Cairo";

const SEND_HOUR = 9;

function missingEnv(): string[] {
  const need = ["RESEND_API_KEY", "SUMMARY_EMAIL_TO"];
  if (!process.env.FIRESTORE_EMULATOR_HOST) need.push("FIREBASE_SERVICE_ACCOUNT");
  return need.filter((k) => !process.env[k]);
}

const cairoNow = () => {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: "Africa/Cairo", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", hour12: false }).formatToParts(new Date());
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return { day: `${get("year")}-${get("month")}-${get("day")}`, hour: Number(get("hour")) % 24 };
};

async function loadAndBuild() {
  const db = adminDb();
  const [users, shifts, entries, events, expenses, recurring, paper, fees, costs] = await Promise.all([
    db.collection("users").get(),
    db.collection("shifts").get(),
    db.collection("entries").get(),
    db.collection("events").get(),
    db.collection("expenses").get(),
    db.collection("recurringExpenses").get(),
    db.doc("settings/paper").get(),
    db.doc("settings/fees").get(),
    db.doc("settings/costs").get(),
  ]);
  const eventList = events.docs.map((d) => parseEvent(d.id, d.data()));
  const inventories = new Map<string, EventInventory>();
  await Promise.all(eventList.map(async (ev) => {
    const stock = await db.collection(`events/${ev.id}/stock`).get();
    const inv = emptyInventory();
    for (const d of stock.docs) if ((STOCK_TYPES as string[]).includes(d.id)) inv[d.id as StockType] = parseStock(d.id as StockType, d.data());
    inventories.set(ev.id, inv);
  }));
  const userList = users.docs.map((d) => parseUserDoc(d.id, d.data()));
  const paperSettings = parsePaperSettings(paper.data());
  const summary = buildDailySummary(
    {
      raw: {
        users: userList,
        shifts: shifts.docs.map((d) => parseShift(d.id, d.data())),
        entries: entries.docs.map((d) => parseEntry(d.id, d.data())),
        events: eventList,
        sheetsPerPack: paperSettings.sheetsPerPack,
      },
      expenses: expenses.docs.map((d) => parseExpense(d.id, d.data())),
      recurring: recurring.docs.map((d) => parseRecurring(d.id, d.data())),
      fees: parseFeeSteps(fees.data()),
      costs: parseCostSteps(costs.data()),
      sheetsPerBox: paperSettings.sheetsPerBox,
    },
    eventList,
    inventories,
    userList.filter((u) => !u.approved).length,
    new Date(),
  );
  return summary;
}

async function send(test: boolean) {
  const summary = await loadAndBuild();
  const { subject, html, text } = renderSummaryEmail(summary, process.env.APP_URL);
  const res = await fetch(process.env.RESEND_API_URL || "https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: process.env.SUMMARY_EMAIL_FROM || "Booth Log <onboarding@resend.dev>",
      to: process.env.SUMMARY_EMAIL_TO!.split(",").map((s) => s.trim()).filter(Boolean),
      subject: test ? `[Test] ${subject}` : subject,
      html,
      text,
    }),
  });
  if (!res.ok) throw new Error(`Resend refused the email (${res.status}): ${(await res.text()).slice(0, 300)}`);
  return summary.day;
}

/** Vercel Cron. */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const missing = missingEnv();
  if (missing.length) return NextResponse.json({ error: `Email isn't set up yet — missing ${missing.join(", ")}` }, { status: 500 });

  const { day, hour } = cairoNow();
  if (hour < SEND_HOUR) return NextResponse.json({ skipped: `Not ${SEND_HOUR}:00 in Cairo yet` });
  const log = adminDb().doc("settings/summaryLog");
  if ((await log.get()).data()?.lastSentDay === day) return NextResponse.json({ skipped: "Already sent today" });
  try {
    const about = await send(false);
    await log.set({ lastSentDay: day, about, sentAt: new Date() }, { merge: true });
    return NextResponse.json({ sent: true, about });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
}

/** "Send test email now" — admins only. */
export async function POST(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace(/^Bearer /, "");
  if (!token) return NextResponse.json({ error: "Sign in as an admin" }, { status: 401 });
  const missing = missingEnv();
  if (missing.length) return NextResponse.json({ error: `Email isn't set up yet — missing ${missing.join(", ")} in Vercel` }, { status: 500 });
  try {
    const { uid } = await adminAuth().verifyIdToken(token);
    const me = await adminDb().doc(`users/${uid}`).get();
    if (me.data()?.role !== "admin" || me.data()?.approved !== true) return NextResponse.json({ error: "Admins only" }, { status: 403 });
  } catch {
    return NextResponse.json({ error: "Sign in as an admin" }, { status: 401 });
  }
  try {
    const about = await send(true);
    return NextResponse.json({ sent: true, about, to: process.env.SUMMARY_EMAIL_TO });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
}
