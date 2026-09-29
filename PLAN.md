# PLAN — Owner feedback batch (after Phase 6)

## Context
The owner asked for 8 changes after using the app. Their answers:
- **Frames:** deducted automatically when a shift ends, restocked by piece.
- **Low-stock "mark as read":** hidden for everyone until the stock is fixed and then drops
  low again.
- **District 5:** tag today's legacy shifts only; don't touch its stock, because the event
  has ended.
- **Desktop:** redo the admin screens for desktop; phones stay as they are, and the staff
  shift screen stays locked.

## 1. Frames in inventory (acrylic + magnetic), deducted automatically
- **Stock types:** `stock/{paper|ink|acrylic|magnetic}`; frames are counted in pieces.
  - `createEvent` and `ensureStockDocs` create all four.
  - The default frame warning level is **5**, editable per location.
  - Older events get the missing docs automatically, the same way ink and paper did.
- **Shift end:** the same single write also deducts the shift's acrylic and magnetic sold,
  added up from its sale entries.
  - `stockDeduction` gains `{acrylic, magnetic}`.
  - One log line per type, with a fixed id (`shiftacr_<id>`, `shiftmag_<id>`), only written
    when the count is above 0.
- The frame counts also flow through:
  - **Apply now**;
  - **reversal when a shift is deleted**;
  - pending detection;
  - the low-stock banner;
  - the 14-day "runs out in" forecast (reusing `forecastStock`).
- **UI:**
  - The Inventory event view gets Acrylic and Magnetic cards (Restock by piece, Correct
    count, Set warning level).
  - The Global table and the Statistics burn-rate table get frame columns.
  - Expanded shifts show the frames deducted.
- **Security rules.** Firestore allows at most 10 document lookups per checked write, and
  adding two more stock types to the current design would go over that limit on the shift
  write. So the checks are regrouped, with the same guarantees:
  - **Shift write:** checks each type with a non-zero amount has its log line in the same
    batch.
  - **Log line:** checks the shift (own shift, ended, this event, first deduction) and that
    this type's stock dropped by exactly the logged amount.
  - **Stock update:** checks the same pair.
  - One generic helper `isValidStockDeduction(eventId, shiftId, type, amount)` replaces the
    separate paper and ink checks.
  - Ink keeps its extra check that cartridges equal the shift's `inkChanges`.
  - Staff still can't restock, correct, or touch another shift's or event's stock.
- **Tests:** unit tests for the frame amounts and pending detection; the rules suites are
  extended so every attack case also covers acrylic and magnetic, and the old paper/ink
  suites are rerun.

## 2. Low-stock "Mark as read"
- **Where it's stored:** a new field `alertDismissed` on each stock doc, written by admins
  only. The alert shows when `isLow && !alertDismissed`.
- **Re-arming:** restock, correct-count and warning-level changes run as transactions. When
  the new quantity is **at or above** the warning level they clear `alertDismissed`, so the
  alert returns the next time the stock drops low. Shift deductions never touch the flag.
- **UI:**
  - Each location/item in the low-stock banner (Overview and Inventory) gets a **Mark as
    read** button.
  - A small "Show 2 read alerts" link brings dismissed ones back into view.
  - The item's card shows "Low stock · read" in grey instead of amber.
- **Unchanged:** paper mismatches keep their existing "Mark as checked".

## 3. Remove staff from the Staff section
- **Button:** **Remove** on each staff row (two-step confirm), which deletes the `/users`
  profile doc. Admins already have this permission in the rules.
  - You can't remove yourself.
  - The confirm text explains that past shifts and sales stay in history, and that the
    person's login must be deleted in the Firebase console (no Admin SDK).
- **Afterwards:** removed people drop out of the Staff list. They still appear, tagged
  "Removed", only when the selected date range includes shifts they worked, so history adds
  up.

## 4. One-time: tag old "no event" shifts (District 5)
- **Tool:** in Shifts, an admin tool **"Tag shifts with no event"**:
  1. Pick a date (default today).
  2. See the list of that day's shifts that have **no event**.
  3. Pick an event (inactive ones allowed, e.g. District 5).
  4. Confirm.
- **What it writes:** each shift gets `{eventId, stockExempt: true}`, in batches.
- **Only touches no-event shifts.** It never changes a shift that already has an event, so
  CLAUDE.md's snapshot rule still holds for real snapshots.
- **`stockExempt`:** these shifts never appear as "not yet deducted" and never touch stock
  (as you asked). The expanded shift says "Tagged by admin later — doesn't affect
  inventory". The rules add `stockExempt` to the fields staff can't change.
- Revenue, stats, Overview and the location comparison count them under District 5 at once.

## 5. Desktop-first admin layouts (phones unchanged, staff shift screen unchanged)
- **Shell:** content max-width ~1440px; a tighter type scale at `lg:` (big figures 5xl→4xl,
  headings smaller); a compact scope bar in one row.
- **Overview** becomes a real dashboard on `lg:`:
  - a row of compact KPI tiles;
  - two columns: revenue chart plus locations table on the left; an alerts column on the
    right with low stock (with Mark as read), paper mismatches, pending signups with inline
    Approve, and **on shift now** (open shifts).
- **Staff:** a proper table on `lg:` with columns name, role, assigned event (dropdown),
  shifts, revenue, cash, visa, sheets, hadr, frames, actions (history, remove). Cards stay on
  phones.
- **Shifts:** column layout on `lg:` (time, staff, event, duration, revenue, paper status,
  stock status) under date headings; the expanded detail sits in two columns.
- **Pending:** a table on `lg:`.
- **Inventory:** four stock cards in one row on `xl:` (two on `lg:`); the stock log as a
  table.
- **Events:** a table on `lg:`.
- **Statistics:** revenue full width; Locations and Cash vs Visa side by side on `xl:`;
  Busiest hours full width; Waste rate and Burn rate side by side.

## 6. Commas in numbers
- One helper, `fmtNum(n)` (en-US grouping, up to 1 decimal), used for every displayed count
  and amount (1,000 · 14,400 · 1,234.5). `formatEGP` already does this.
- It's applied across the admin views, the staff summary grid, entry totals, cart and
  "Logging" totals, stock quantities, tables, chart labels and the copy-summary text.
- The number inputs themselves stay plain, so typing works normally.

## 7. Logo in the top-left square
- The sidebar logo square shows the Memoire logo (`/icons/icon-192.png`, rounded) instead of
  the camera icon.

## 8. Remove "By staff" from Waste rate
- The per-staff ranking and its "High" flags are removed. The overall rate and the trend
  chart stay, with the trend going full width.
- The now-unused `staffWaste` code and its tests are deleted.
- SPEC.md records this as an owner change, along with items 1, 2 and 4.

## Files (main)
New:
- `lib/format.ts` (`fmtNum`)
- `components/admin/TagShiftsTool.tsx`

Modified:
- `lib/inventory/{types,units,pending,scope,firestore}.ts`
- `lib/admin/{firestore,scope}.ts`
- `lib/stats/{waste,burn}.ts`
- `lib/shift/types.ts`
- `components/admin/*` (AdminDashboard, Sections, ShiftPieces, InventorySection,
  EventsSection, stats/*)
- `components/shift/*` (number formatting only)
- `components/layout/SidebarRail.tsx`
- `firestore.rules`
- `SPEC.md`, `README.md`

## Verification
- **Unit tests:** frames, alert re-arm logic, `stockExempt` pending exclusion, `fmtNum`, the
  waste suite without staff. The whole suite stays green.
- **Emulator rules suites:**
  - new frame deduction + attack cases;
  - `stockExempt` locked for staff;
  - the `alertDismissed` field is admin-only;
  - a regression run of every earlier suite.
- **Playwright against the emulators:**
  1. A shift sells 2 acrylic + 1 magnetic → that event's frame stock drops and the logs are
     written.
  2. Deleting the shift restores the frames.
  3. Low-stock Mark as read → hidden; restock above the warning level → re-armed; drop low
     → shown again.
  4. Remove staff → gone from Staff.
  5. Tag tool: no-event shifts become District 5, are exempt from stock, and revenue appears
     under District 5.
  6. Commas show (1,000 / 14,400).
  7. The logo is in the rail.
  8. Waste has no staff list.
  9. The earlier Phase 3–6 browser suites still pass (updated for commas).
  10. Screenshots at 1440 and 390 px.
- Commit and push. **Re-paste `firestore.rules`** afterwards (the rules change).
