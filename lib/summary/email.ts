import type { DailySummary } from "./build";

/*
 * Renders the daily summary as email HTML (inline styles, tables — what email clients
 * understand) + a plain-text version. Dark header in the app's colours; body kept light so it
 * reads well in every mail app.
 */

const n = (v: number) => new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(Math.round(v));
const egp = (v: number) => `${v < 0 ? "−" : ""}${n(Math.abs(v))} EGP`;
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

const C = { ink: "#181316", muted: "#6b6480", line: "#e8e4f0", good: "#15803d", bad: "#b91c1c", gold: "#a16207", accent: "#7c3aed" };
const th = `style="text-align:left;padding:6px 8px;font-size:11px;letter-spacing:.04em;text-transform:uppercase;color:${C.muted};border-bottom:1px solid ${C.line}"`;
const thr = th.replace("text-align:left", "text-align:right");
const td = `style="padding:8px;border-bottom:1px solid ${C.line};font-size:14px;color:${C.ink}"`;
const tdr = `style="padding:8px;border-bottom:1px solid ${C.line};font-size:14px;color:${C.ink};text-align:right;white-space:nowrap"`;
const money = (v: number) => `<span style="color:${v < 0 ? C.bad : C.good};font-weight:600">${egp(v)}</span>`;

function change(cur: number, prev: number) {
  const diff = cur - prev;
  if (Math.abs(diff) < 0.5) return "same as the day before";
  return `${diff > 0 ? "▲" : "▼"} ${egp(Math.abs(diff))} vs the day before`;
}

function section(title: string, body: string) {
  return `<h2 style="margin:28px 0 8px;font-size:16px;color:${C.ink}">${title}</h2>${body}`;
}

export function renderSummaryEmail(s: DailySummary, appUrl?: string): { subject: string; html: string; text: string } {
  const subject = `Booth Log — ${s.dayLabel}: ${egp(s.totals.revenue)} revenue, ${s.totals.profit < 0 ? "loss" : "profit"} ${egp(Math.abs(s.totals.profit))}`;

  const kpi = (label: string, value: string, sub = "") =>
    `<td style="padding:12px 14px;background:#f6f4fa;border-radius:10px;width:33%"><div style="font-size:11px;color:${C.muted};text-transform:uppercase;letter-spacing:.04em">${label}</div><div style="font-size:20px;font-weight:700;color:${C.ink};margin-top:2px">${value}</div>${sub ? `<div style="font-size:12px;color:${C.muted};margin-top:2px">${sub}</div>` : ""}</td>`;

  const locations = s.locations.length
    ? `<table width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse"><tr><th ${th}>Location</th><th ${thr}>Revenue</th><th ${thr}>Expenses</th><th ${thr}>Profit</th></tr>${s.locations
        .map((l) => `<tr><td ${td}>${esc(l.name)}</td><td ${tdr}>${egp(l.revenue)}</td><td ${tdr}>${egp(l.expenses)}</td><td ${tdr}>${money(l.profit)}</td></tr>`)
        .join("")}</table>`
    : `<p style="color:${C.muted};font-size:14px">No sales or expenses.</p>`;

  const shifts = s.shifts.length
    ? `<table width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse"><tr><th ${th}>Staff</th><th ${th}>Location</th><th ${th}>Time</th><th ${thr}>Hours</th><th ${thr}>Total</th></tr>${s.shifts
        .map((x) => `<tr><td ${td}>${esc(x.staff)}</td><td ${td}>${esc(x.location)}</td><td ${td}>${x.start} → ${x.end ?? "still open"}</td><td ${tdr}>${x.hours}</td><td ${tdr}>${egp(x.total)}</td></tr>`)
        .join("")}</table>`
    : `<p style="color:${C.muted};font-size:14px">No shifts.</p>`;

  const month = `<p style="margin:0 0 8px;font-size:14px;color:${C.ink}">Revenue <b>${egp(s.month.revenue)}</b> · ${s.month.profit < 0 ? "Loss" : "Profit"} ${money(s.month.profit)}</p>${
    s.month.rows.length
      ? `<table width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse"><tr><th ${th}>Location</th><th ${thr}>Revenue</th><th ${thr}>Profit</th><th ${thr}>Break-even</th></tr>${s.month.rows
          .map((r) => `<tr><td ${td}>${esc(r.name)}</td><td ${tdr}>${egp(r.revenue)}</td><td ${tdr}>${money(r.profit)}</td><td ${tdr}>${
            r.needPerDay == null ? `<span style="color:${C.bad}">can't break even</span>`
              : `needs ${egp(r.needPerDay)}/day · avg ${egp(r.avgPerDay)} ${r.covered ? `<span style="color:${C.good}">✓</span>` : `<span style="color:${C.bad}">✗</span>`}`
          }</td></tr>`)
          .join("")}</table>`
      : ""
  }`;

  const alerts = s.alerts.length
    ? `<ul style="margin:0;padding-left:18px;font-size:14px;color:${C.ink}">${s.alerts.map((a) => `<li style="margin:4px 0">${esc(a)}</li>`).join("")}</ul>`
    : `<p style="color:${C.good};font-size:14px">All clear — nothing needs your attention.</p>`;

  const html = `<!doctype html><html><body style="margin:0;background:#f1eef7;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif">
<table width="100%" cellspacing="0" cellpadding="0"><tr><td align="center" style="padding:24px 12px">
<table width="640" cellspacing="0" cellpadding="0" style="max-width:640px;width:100%;background:#fff;border-radius:16px;overflow:hidden">
<tr><td style="background:#181316;padding:20px 24px;color:#f4f1fa"><div style="font-size:12px;color:#b9b1cc">Booth Log · daily summary</div><div style="font-size:22px;font-weight:800;margin-top:4px">${esc(s.dayLabel)}</div></td></tr>
<tr><td style="padding:20px 24px">
<table width="100%" cellspacing="8" cellpadding="0"><tr>${kpi("Revenue", egp(s.totals.revenue), s.previous ? change(s.totals.revenue, s.previous.revenue) : "")}${kpi("Expenses", egp(s.totals.expenses))}${kpi(s.totals.profit < 0 ? "Loss" : "Profit", egp(Math.abs(s.totals.profit)), s.previous ? change(s.totals.profit, s.previous.profit) : "")}</tr></table>
${section("Revenue &amp; profit by location", locations)}
${section("Shifts", shifts)}
${section(`Month so far — ${esc(s.month.label)}`, month)}
${section("Alerts", alerts)}
${appUrl ? `<p style="margin:28px 0 0"><a href="${esc(appUrl)}" style="display:inline-block;background:${C.accent};color:#fff;text-decoration:none;padding:10px 18px;border-radius:999px;font-weight:600;font-size:14px">Open Booth Log</a></p>` : ""}
<p style="margin:24px 0 0;font-size:12px;color:${C.muted}">Expenses include card fees; monthly costs are spread per day. Ended events are left out of alerts and break-even.</p>
</td></tr></table></td></tr></table></body></html>`;

  const lines = [
    `Booth Log — ${s.dayLabel}`,
    `Revenue ${egp(s.totals.revenue)} · Expenses ${egp(s.totals.expenses)} · ${s.totals.profit < 0 ? "Loss" : "Profit"} ${egp(Math.abs(s.totals.profit))}`,
    "",
    "BY LOCATION",
    ...(s.locations.length ? s.locations.map((l) => `- ${l.name}: revenue ${egp(l.revenue)}, expenses ${egp(l.expenses)}, profit ${egp(l.profit)}`) : ["- none"]),
    "",
    "SHIFTS",
    ...(s.shifts.length ? s.shifts.map((x) => `- ${x.staff} @ ${x.location} ${x.start}–${x.end ?? "open"} (${x.hours}h): ${egp(x.total)}`) : ["- none"]),
    "",
    `MONTH SO FAR (${s.month.label}): revenue ${egp(s.month.revenue)}, profit ${egp(s.month.profit)}`,
    ...s.month.rows.map((r) => `- ${r.name}: ${egp(r.revenue)}, profit ${egp(r.profit)}${r.needPerDay == null ? "" : `, needs ${egp(r.needPerDay)}/day (avg ${egp(r.avgPerDay)})`}`),
    "",
    "ALERTS",
    ...(s.alerts.length ? s.alerts.map((a) => `- ${a}`) : ["- All clear"]),
  ];
  return { subject, html, text: lines.join("\n") };
}
