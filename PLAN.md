# PLAN — P&L additions: card fees, product costs & profit per product, break-even

> Approved. Discount decision: **frames always count at full price (400 / 200), custom items
> at their own price; prints take any difference.** Sections 4–6 were added from the owner's
> answers (Resend, 9:00 Cairo, header pill, "mark event as ended").

## 1. Card fees (editable, stays until you change it)
- **Setting:** new admin-only `settings/fees` card inside P&L, called **"Card machine fees"**.
  You choose one of two ways the fee works:
  - **Percentage only** — e.g. 2.5% of every Visa amount.
  - **Percentage + fixed per transaction** — e.g. 2% + 3 EGP for each sale paid by card.
- **It stays until you change it:** the fee you save applies to every card sale from then
  on. Changing it later does **not** rewrite past months — each change is stored with the
  date it starts from, the same way monthly rent changes work. The card shows the fee
  history, e.g. "2.5% until Oct 3 · 2% + 3 EGP since".
- **How it's counted:**
  - The fee is charged on the **Visa part** of each sale; the cash part pays no fee.
  - A split cash + Visa sale counts as one card transaction, so the fixed amount is charged
    once.
  - Sales with no Visa amount pay nothing.
- **In the P&L:** a new expense line, **"Card fees"**, calculated automatically. It is
  included in Expenses, Profit, the category breakdown, the per-location table, the trend
  chart and "vs last period".
- **Starting point:** no fee (0%) until you set one, so nothing changes until then.

## 2. Product costs → profit per product + what waste costs
- **Setting:** new admin-only `settings/costs` card, called **"What things cost you"**:
  - cost of one **box of paper** (turned into a per-sheet cost using sheets per box — the
    BOX, never the pack);
  - cost of one **ink cartridge**;
  - cost of one **acrylic frame**;
  - cost of one **magnetic frame**.

  Like the card fee, each cost stays in force until you change it, and changes apply from
  their date only.
- **New P&L card, "Profit per product"**, for the selected location and date range:

  | Product | Sold | Revenue | Materials | Card fees | Profit | Per unit |
  |---|---|---|---|---|---|---|
  | Prints (per 0.5 sheet) | … | … | paper + ink | share | … | e.g. "200 → 131 EGP" |
  | Acrylic frames | … | … | frame cost | share | … | … |
  | Magnetic frames | … | … | frame cost | share | … | … |
  | Custom items | … | … | — | share | … | … |

  - **Paper:** each print uses 0.5 sheet at the per-sheet cost.
  - **Ink:** the ink cost per sheet comes from the ink cartridges staff actually logged in
    the range ÷ sheets printed. Wasted sheets used ink too, so they count.
- **"What waste cost you":** hadr sheets × (paper + ink per sheet) in EGP, next to the
  waste %. For example: "Waste cost you 1,340 EGP this month."
- **Important — no double counting:**
  - You already enter stock purchases as expenses. So the headline Profit stays
    **Revenue − Expenses − Card fees**, as today.
  - "Profit per product" and "waste cost" are an **analysis** of where the money comes from.
    They are not subtracted a second time.
  - The card says this in one line so it's never confusing.

## 3. Break-even per location
- **What it shows**, per location and under Global, for the selected range, e.g.
  **"City Stars needs about 1,450 EGP a day to cover its costs — it's averaging 2,100 a
  day ✓"**, with a bar showing how close it is.
- **How it's worked out:**
  - **Fixed costs per day** = monthly expenses (rent, salaries…) spread per day, plus
    one-off expenses averaged over the days in the range. Card fees and materials are not
    fixed — they grow with sales.
  - **Variable costs** = materials (from your product costs) + card fees, as a share of
    revenue in the range. For example, 30% of every sale goes to materials + fees.
  - **Break-even revenue per day** = fixed per day ÷ (1 − variable share).
  - **Also shown in prints:** "≈ 11 prints a day" (break-even ÷ what one print earns).
  - **Average per day** = revenue ÷ days in the range up to today.
- **Global:** includes General costs.
- **Missing information:** if product costs aren't set yet, it says so and leaves out
  materials (shown as "costs not set").

## 4. Mark an event as ended (temporary events)
- **Wording:** Events → "Deactivate" becomes **"Mark as ended"**, and the badge reads
  **"Ended"**. This reuses the existing `inactive` status, so no data changes. **"Reopen"**
  undoes it.
- **What an ended event stops showing:**
  - low-stock alerts (site banners, the Overview alerts column, the email);
  - break-even;
  - "runs out soon" warnings.
- **What it keeps:** its history. Revenue, P&L, shifts, the location tables and the
  switcher still include it; the switcher labels it "(ended)".
- **Staff:** ended events can't be assigned, same as today's inactive rule.

## 5. Offline mode for staff
- **Local saving:** Firestore's persistent local cache is turned on. Sales, waste, paper/ink
  taps and ending a shift save on the phone first and sync when the connection is back.
  Staff screens don't wait for the server any more, so nothing hangs on "Logging…" offline.
- **Reopening offline:** a small service worker caches the app itself, so it still opens
  when there's no signal. Already signed-in staff stay signed in.
- **What staff see:** a small pill in the header, next to Log out — an amber
  **"Offline · 3 changes waiting to sync"**, then a brief "Synced ✓".
  **No section of the locked shift screen is moved or changed.**
- **Shift end offline:** the stock deduction is queued. If it can't be applied (e.g. the
  staff member was reassigned while offline), the shift shows as "not yet deducted" and
  the admin's "Apply now" handles it, as today.
- **Admins:** nothing changes for admins; the dashboard needs a connection.

## 6. Daily summary email (Resend, 9:00 AM Cairo, about the previous day)
- **Sections:**
  - **Revenue & profit** — per location + total, vs the day before (with card fees).
  - **Shifts** — who worked where, hours, each shift's total.
  - **Month so far** — revenue, profit and break-even per location.
  - **Alerts** — low stock (not marked as read) and paper mismatches; ended events are
    skipped.
- **How it's sent:** a Vercel cron job calls a server route, `/api/daily-summary`. That
  route reads Firestore with the Firebase **Admin SDK** and sends through Resend. The P&L
  maths is shared with the site's code, so the numbers match exactly.
- **What you set up once in Vercel** (the README gets step-by-step instructions):
  - `RESEND_API_KEY`;
  - `SUMMARY_EMAIL_TO` (your email);
  - `FIREBASE_SERVICE_ACCOUNT` — a key from Firebase console → Project settings → Service
    accounts;
  - `CRON_SECRET` — so only Vercel can trigger it.
- **Testing:** a **"Send test email now"** button in P&L (admin only) sends today's summary
  immediately.
- **WhatsApp:** later, once you have a number (needs a WhatsApp Business account).

## Security
- `settings/fees` and `settings/costs`: **admins only**, read and write. Staff can't see
  your costs or fees.
- Other `settings/*` docs (like paper units) keep their current rules.
- The summary route checks the cron secret, or for the test button a signed-in admin's ID
  token. The service-account key only ever lives in Vercel env vars, never in the repo or
  the browser.
- Rules tests cover it. Re-paste `firestore.rules` afterwards.

## Verification
- **Unit tests:**
  - percentage vs percentage + fixed fees;
  - split cash/Visa sales and sales with no Visa amount;
  - a fee change applies only from its date;
  - per-sheet cost from box cost ÷ sheets per box (the box, never the pack);
  - ink per sheet;
  - discount splitting;
  - break-even formula, incl. no costs set / no revenue;
  - everything still adds up to the headline.
- **Rules tests:** admin allowed; staff, pending and signed-out users denied for fees/costs.
- **Browser run:**
  - set fees → P&L drops by the expected amount;
  - change fees → past months unchanged;
  - set costs → per-product table + waste cost + break-even match hand-worked numbers;
  - phone + desktop screenshots.
- **Then:** commit and push, and remind you to re-paste the rules.
