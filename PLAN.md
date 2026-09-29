# PLAN — P&L additions: card fees, product costs & profit per product, break-even

> Custom range + P&L are built and pushed (`73b3a1d`). This plan needs approval before any
> code is written.

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

## Needs your OK — one money decision
Sales store the **total paid**, not a price per item. When staff give a discount (payment
lower than the item prices) or change the sheets price, "Profit per product" has to decide
which product loses that money. Options:
- **(Recommended) Spread it proportionally** — a 10% discount on a print + frame sale
  lowers both by 10%.
- **Put it all on prints** — frames always count at full price (400 / 200) and prints take
  any difference.

This only affects the per-product split. Totals, Revenue and Profit are the same either way.

## Security
- `settings/fees` and `settings/costs`: **admins only**, read and write. Staff can't see
  your costs or fees.
- Other `settings/*` docs (like paper units) keep their current rules.
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
