# PLAN — Phase 6: Statistics

> Phases 1–5, plus the ink follow-up, are built and pushed (latest `fcaccf0`). Once you
> approve, this file replaces `PLAN.md`.

## Context
Add a **Statistics** section to the admin dashboard with **exactly three stats**, per SPEC
and your instruction; nothing else gets added without asking:
1. Busiest hours
2. Waste rate: a per-staff ranked list plus an adaptive-granularity trend chart
3. Inventory burn-rate projection

Like every other section, Statistics consumes only scoped data, so it respects the event
switcher (and the date range where one applies). It never reads raw Firestore data directly.

## 1. Where the data comes from (reusing what exists)
- **`useScopedDashboard()`** (Phase 4) already gives `shifts` and `entries` filtered by event
  and date range. Entries belong to their shift's event and count toward the range their
  shift started in.
- **`useScopedInventory()`** (Phase 5) already gives per-location rows with `forecast` (paper)
  and `inkForecast`, using the same 14-day computation shown on Inventory.
- All new maths goes in **`lib/stats/`** as pure, unit-tested functions.

## 2. Stat 1 — Busiest hours (`lib/stats/busiest.ts`)
- **What it counts:** sale entries in scope (event + date range), bucketed by each entry's own
  timestamp (per spec) into a **7 × 24 grid** of weekday × hour (Mon–Sun, device-local time).
  - Each cell holds the number of sales and the EGP taken.
  - Waste entries are excluded: this measures sales activity only.
- **UI:**
  - a heatmap using the violet→magenta sequential scale from the chart tokens (empty = the
    track colour);
  - per-hour totals as a bar strip under the grid, and per-weekday totals down the right;
  - a callout, e.g. "Busiest: Fri 18:00–19:00 (12 sales, 4,800 EGP)";
  - each cell has a hover/focus title with the exact numbers;
  - on phones the grid scrolls horizontally inside its card, never the whole page.

## 3. Stat 2 — Waste rate (`lib/stats/waste.ts`)
- **Definition:** `wasteRate = hadr ÷ (sheets sold + hadr)`, from scoped entries. When
  nothing was used the rate is `null` (shown as "—"), never 0%.
- **Headline:** the overall waste rate for the scope and range, e.g. "4.2% — 3 of 71 sheets
  wasted".
- **Per-staff ranked list:**
  - every staff member with sheets used in scope, ranked **highest waste first**;
  - each row shows rate %, hadr / used, and a small bar relative to the others;
  - "most" and "least" are marked at the top and bottom.
- **Adaptive trend chart**, bucketed by the **shift start date** (the same rule that decides
  which range a shift belongs to):
  - **This week:** daily points, Monday → today.
  - **This month:** weekly points (Monday-start weeks, clipped to the month).
  - **All time:** monthly points, from the first month with data to now.
  - Empty buckets leave a gap in the line; they are never plotted as 0%.
- **Warning treatment** (amber, the same as mismatch and low-stock warnings):
  - **High staff member:** rate ≥ **1.5×** the scope's overall rate, AND at least **2
    percentage points** above it, AND at least **10 sheets** used. The minimum usage stops
    one bad print looking like a crisis.
  - **High trend point:** the same test against the range's overall rate.
  - **Climbing:** the last **3** non-empty points each strictly higher than the one before.
    This shows a "Waste rate climbing" tag on the chart.
  - The thresholds live as named constants at the top of `waste.ts`, so they're easy to
    tweak later.
- The chart is hand-drawn SVG, reusing the Phase 1 chart tokens and `ChartDefs` gradient. No
  new chart library is needed for these three simple charts.

## 4. Stat 3 — Inventory burn-rate projection
- It reuses the **Phase 5 figure** (`forecastStock`, 14-day rolling average) exactly, so it
  can't disagree with the Inventory screen.
- **Under an event:** that location's paper card shows sheets left, average sheets per day,
  and "runs out in ≈ N days". Ink shows the same, since it now has a forecast too.
- **Under Global:** a combined table of every location, sorted soonest-to-run-out first. Any
  location running out within **7 days**, or already below its low-stock threshold, gets the
  amber treatment.
- The date range doesn't apply here: the projection is always "the last 14 days → from now".
  A note on the card says so.

## 5. UI
- **Placement:** a new rail item **Statistics** (a chart icon) plus the phone pill nav. The
  section has three cards in spec order: Busiest hours, Waste rate, Burn rate.
- **Scope chip:** the switcher chip shows "Showing: {event} · {range}". The Burn-rate card
  notes that the range doesn't apply to it.
- **Empty states:** each card has a clear empty state, e.g. "No sales in this range at City
  Stars".
- Before writing chart code I'll load the `dataviz` skill for the chart conventions.

## 6. Files
New:
- `lib/stats/{busiest,waste,burn}.ts` + `stats.test.ts`
- `components/admin/stats/{StatisticsSection,BusiestHours,WasteRate,BurnRate}.tsx`

Modified:
- `components/admin/AdminDashboard.tsx`: nav + section
- `components/admin/Sections.tsx`: `Section` type
- `README.md`

## 7. Verification
- **Unit tests:**
  - **Busiest hours:** bucketing, including local-time hour and weekday, Sunday → Mon-first
    index, and excluding waste entries.
  - **Waste rate:**
    - the rate maths and the `null` case;
    - staff ranking and high flags, including the ≥ 10-sheets minimum;
    - bucket boundaries for week (daily), month (weekly, clipped) and all time (monthly);
    - gaps for empty buckets;
    - "climbing" detection.
  - **Burn rate:** the table sort, and the ≤ 7-days warning.
- **Playwright against the emulators:**
  - seed two events with differently timed sales and different waste per staff member;
  - switch Global → Event A → Event B and assert each card's numbers change: heatmap peak cell
    and totals, overall waste %, staff list membership and order, trend point count per
    range (7 / weeks / months), and burn-rate rows;
  - screenshots at 1440 and 390 px.
- `npm test`, lint, build. Commit and push, then tell you how to check each stat's scoping.
