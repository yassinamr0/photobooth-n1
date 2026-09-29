# PLAN — Custom date range + P&L

> The previous batch (frames, mark as read, remove staff, tag tool, desktop layouts, commas)
> is built and pushed (`e9352c8`). This plan needs approval before any code is written.

## Owner's answers
- **Expenses:** one-off, plus recurring monthly (e.g. rent).
- **Paper / ink / frame purchases:** entered as normal expenses by hand. Restocking stays
  count-only.
- **Staff pay:** entered as normal expenses (one-off or recurring).
- **"vs last period" for a custom range:** compares with the same length of time just before
  it.

## 1. Custom date range
- **Range switcher:** the top switcher becomes **This week · This month · All time · Custom**.
- **Custom** opens a small picker with three modes:
  - **Day:** one date.
  - **Week:** pick any date and get that Mon–Sun week, with ‹ › to step between weeks.
  - **Range:** a from date and a to date, both inclusive.
- **Chip:** the picked range shows as a chip, e.g. "Sep 10 – Sep 16". It is saved like the
  other ranges, so it's still there after a reload.
- **Applies everywhere the current range applies:** Overview, Staff, Shifts, staff history,
  Statistics and the new P&L. Inventory stock and burn-rate stay as "now", as today.
- **Data:** `DateRange` gains `{ kind: "custom", from, to }` (local dates). A shift counts when
  its start date falls in the range, the same rule as today.
- **Trend granularity:** up to 31 days → daily points; up to about 6 months → weekly;
  longer → monthly.
- **"vs last period":** compares with the same number of days just before. For example,
  Sep 10–16 compares with Sep 3–9, and a single day compares with the day before. Week and
  Month keep "same point last week/month".
- **Locations compared** follows the custom range too.

## 2. P&L (profit & loss)
- **Where:** its own sidebar item, **P&L**, next to Statistics. It has entry forms, so it's
  easier to find there than buried inside Statistics.
- **Scope:** it follows the event switcher and date range like everything else.

### Expenses
- **One-off expense:** date, amount (EGP), category, location, note.
  - **Category** is one of: Rent · Staff pay · Stock purchases · Transport · Maintenance ·
    Marketing · Other.
  - **Location** is an event, or **General**, for costs not tied to one booth (e.g.
    accounting). General costs only count under Global.
- **Recurring expense (monthly):**
  - **Fields:** amount, category, location, day of the month, start month, optional end month,
    and a Stop button.
  - **When it counts:** it counts the full amount once per month, on its day, whenever that
    day falls in the selected range. It isn't spread across days, so a single-week view only
    includes rent if the rent day is in that week. If the day is 31 and the month is shorter,
    it counts on the month's last day.
  - **Changing the amount** (e.g. a rent increase) applies from the month you change it. Past
    months keep the old amount, because each change is stored with the month it starts from.
- **Managing expenses:** you can edit or delete any expense, and there's a list of every
  expense in the range, newest first.

### What the P&L shows
- **Headline:** Revenue (sales, same figure as Overview) − Expenses = **Net profit/loss**,
  plus margin %.
  - A loss shows in red, a profit in green.
  - It includes "vs last period" for both profit and expenses.
- **Expenses by category:** amount and share of the total.
- **Trend chart:** revenue vs expenses per period, with the profit line on top, using the
  same granularity as the date range.
- **Under Global:** a per-location table with revenue, expenses, profit and margin, plus a
  **General** row. Every row adds up to the Global total.
- **Not counted:** the optional "cost" staff can type on a hadr waste entry. It stays out of
  the P&L, because that paper is already paid for through your stock purchases.

### Data + security
- **Collections:** `/expenses/{id}` (one-offs) and `/recurringExpenses/{id}` (monthly
  templates, including their amount history).
- **Access:** admins only (read and write). Staff and pending signups can't see them.
- **Tests:** rules tests prove staff can't read or write either collection.
- **After it ships:** re-paste `firestore.rules` into the Firebase console.

## Files (main)
New:
- `lib/pnl/{types,recurring,pnl}.ts` + tests
- `lib/pnl/firestore.ts`
- `components/admin/pnl/*`
- `components/admin/CustomRangePicker.tsx`

Modified:
- `lib/admin/scope.ts`, `lib/stats/{waste,revenue}.ts` (range handling)
- `AdminDashboard.tsx` (switcher + nav)
- `DashboardData.tsx` (listen to expenses)
- `firestore.rules`
- `SPEC.md`, `README.md`

## Verification
- **Unit tests:**
  - custom range boundaries, including a shift at 23:59 on the last day;
  - the same-length previous window;
  - recurring months, including day 31 in February, start/end months and amount changes;
  - P&L sums, with per-location + General = Global.
- **Rules tests:** admin allowed; staff and pending signups denied for both collections.
- **Browser run against the emulators:**
  - pick a Day, a Week and a Range, and check the totals match hand-computed numbers;
  - add rent (recurring) + a one-off, and check profit per location and Global;
  - check that changing the rent amount only affects later months;
  - screenshots at desktop and phone widths.
- **Then:** commit and push, and remind you to re-paste the rules.
