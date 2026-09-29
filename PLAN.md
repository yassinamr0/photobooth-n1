# PLAN — Phase 5: Events (Locations) + Per-Event Inventory

> Phases 1–4 are built and pushed (latest `93704f6`). Once you approve, this file replaces
> `PLAN.md`.

## Context
Admins need to manage booth locations (events) properly, and track paper and ink stock per
location. Paper changes three ways:
- **restocks** entered in **BOXES** (`settings/paper.sheetsPerBox`, default 108);
- **automatic deductions** when a shift ends;
- **stock-take corrections** in sheets.

Ink is manual only. These numbers are inventory-critical, so each unit rule is enforced in
code **and** in security rules.

**Decisions you made:**
1. **Deduction runs in the app, checked by rules.** It's one atomic write: the shift is marked
   as deducted, the stock goes down, and a log line is written. It happens once per shift,
   into that shift's own eventId. If it fails, the shift still ends, and admin gets
   "N ended shifts not yet deducted" with an **Apply now** button.
2. **Deleting a deducted shift puts its sheets back**, with a "+X — shift deleted" log line.
3. **"Correct count"** (stock-take) exists for paper (in sheets) and ink (in cartridges),
   labelled separately from restocks. Paper restocks stay **boxes only**.

**Unit rule (CLAUDE.md), enforced throughout:**
- Inventory uses `sheetsPerBox` only; `sheetsPerPack` is never used here.
- Stock is stored in raw sheets.
- The deduction amount is the shift's **actualUsed = sheets sold + hadr wasted**, NOT the
  "expected" reconciliation figure.

## 1. Data model
- **`/events/{id}`**: `{ name, notes, status: "active"|"inactive", createdAt, createdBy }`.
  Your manual `citystars` test doc keeps working: missing fields read as `notes ""` and
  `status "active"`, and it can be edited normally. Nothing needs replacing.
- **`/events/{id}/stock/{paper|ink}`**:
  - `{ currentQuantity, lowStockThreshold, updatedAt, trackingSince, lastShiftId? }`;
  - paper quantity is in sheets, ink in cartridges;
  - created together with the event;
  - for events that predate Phase 5, the admin dashboard creates missing stock docs on load
    (quantity 0, `trackingSince` = now).
- **`/events/{id}/stockLogs/{id}`**:
  - `{ stockType, delta, reason, kind, byUid, byName, createdAt }`;
  - `kind` is `restock`, `correction`, `shift` or `shiftReversal`;
  - restocks also store `boxes` and `sheetsPerBox` (the box count and the sheet delta are both
    logged, per spec);
  - shift logs store `shiftId`, and their doc id is `shift_{shiftId}` (at most one per shift).
- **`/shifts/{id}.stockDeduction`**: `{ eventId, sheets }`, set once when the deduction is
  applied.

## 2. Inventory logic — `lib/inventory/` (pure functions, unit-tested)
- **Boxes:** `boxesToSheets(boxes, sheetsPerBox)` and `sheetsToBoxes(sheets, sheetsPerBox)`
  (for "≈ 3.2 boxes").
- **Deduction amount:** `shiftActualUsed(entries)` = sheets sold + hadr, using the same
  `aggregate()` as reconciliation.
- **Pending deductions:** `pendingDeductions(shifts, stockByEvent)` returns shifts that:
  - have ended;
  - have a non-null eventId;
  - have no `stockDeduction`;
  - ended at or after that event's `trackingSince`, so pre-Phase-5 history is never
    back-deducted.
- **`unattributedShifts`**: ended shifts with no eventId. These are never deducted, and a note
  in the UI says so.
- **Forecast:** `forecast(logs, current, trackingSince, now)`:
  - rolling **14-day** average daily consumption from `shift` logs minus `shiftReversal`
    logs;
  - divided by `min(14, days since tracking started)`, at least 1;
  - result: "runs out in ≈ N days", or "not enough data yet".
- **Low stock:** `isLow(stock)` = `currentQuantity < lowStockThreshold`.
- **Tests:**
  - 3 boxes × 108 = 324;
  - a snapshot-free conversion from a changed `sheetsPerBox`;
  - actualUsed ≠ expected;
  - pending excludes shifts before tracking started, no-event shifts and already-deducted
    shifts;
  - forecast maths and edge cases;
  - a unit guard: inventory code never imports or reads `sheetsPerPack` (a test greps
    `lib/inventory`).

## 3. Writes — `lib/inventory/firestore.ts`
- **`applyShiftDeduction(shift, entries, by)`** is one batch:
  - the shift gets `stockDeduction {eventId: shift.eventId, sheets: X}`;
  - `events/{shift.eventId}/stock/paper` gets `currentQuantity: increment(−X)`, `updatedAt`
    and `lastShiftId`;
  - the log `shift_{id}` is created: `{stockType:"paper", delta:−X, kind:"shift", reason:"Shift ended", shiftId}`.
  - The eventId **always comes from the shift doc**, never from the user profile.
- **Staff end-shift flow:** `endShift()` runs first and must succeed. Then
  `applyShiftDeduction` runs, using the shift's live entries. A failure is only logged (no
  scary UI), and the shift simply stays in the admin's pending list. Shifts without an
  eventId are skipped.
- **Admin "Apply now":** the same function, recomputing X from that shift's entries.
- **`restockPaper(eventId, boxes, sheetsPerBox)`**: adds `boxes × sheetsPerBox` sheets and
  logs `{kind:"restock", boxes, sheetsPerBox, delta}`.
- **`restockInk(eventId, n)`** adds cartridges.
- **`correctCount(eventId, type, counted, reason)`**: `delta = counted − current`, and logs a
  `correction`.
- **`setThreshold(eventId, type, n)`.**
- **`deleteShiftAndEntries`** (from Phase 4) is extended: if the shift has a
  `stockDeduction`, the final batch also adds `+sheets` back to that event's paper and logs a
  `shiftReversal` line.
- **Events CRUD:** `createEvent` (event + both stock docs in one batch; the default paper
  threshold is **one box**, i.e. `sheetsPerBox` from settings; the ink threshold is 1),
  `updateEvent` (name, notes) and `setEventStatus`. There's no hard delete, so history stays
  intact.
- **Paper settings editor:** `sheetsPerPack` and `sheetsPerBox` are two separate, clearly
  labelled fields. Changing the pack size affects new shifts only (Phase 4 snapshot).

## 4. Dashboard UI (`components/admin/`)
- **Events section** (new rail item):
  - list of events with a status tag (Active / Inactive), notes, and the number of staff
    assigned;
  - **New event** form (name, notes);
  - inline edit;
  - Deactivate / Reactivate. Deactivating warns if staff are still assigned; their next shift
    still stamps that event until they're reassigned.
  - Inactive events stay in the switcher (labelled "inactive", for history) but are hidden
    from the Staff assignment dropdown.
- **Inventory section** (new rail item), scoped by the switcher:
  - **Event view:**
    - **Paper card**: sheets remaining, "≈ N boxes", threshold (editable), a low-stock
      warning in the same amber treatment as paper mismatches, and "at this rate runs out in
      ≈ N days".
    - Actions: **Restock (boxes)**, whose input is boxes only, with a live preview
      "3 boxes = 324 sheets"; and **Correct count (sheets)**.
    - **Ink card**: cartridges, Restock (cartridges), Correct count, threshold, warning.
    - A **pending-deductions** notice with Apply now.
    - A note: "N shifts with no event don't affect any location's inventory."
    - **Stock log history**, most recent first: date, type, kind tag, delta (a restock also
      shows "3 boxes"), reason, by whom.
  - **Global view:**
    - a side-by-side comparison table of every event: paper sheets, boxes, threshold, status,
      days left, ink;
    - a low-stock banner if ANY location is under its threshold;
    - pending deductions across all events;
    - the Paper settings card (pack vs box).
- **Overview:** adds a scoped low-stock banner (Global: any event; event: that event).
- **Shifts:** the expanded shift shows its stock status: "Deducted 2 sheets from City Stars",
  "Not yet deducted" with Apply now, or "No event — doesn't affect inventory".
- **Staff:** the assignment dropdown lists active events only (plus the current value if it's
  inactive).

## 5. Security rules
- **`/events/{id}`:** read by **approved** users (per spec; staff still never see events in
  the UI), write by admin only.
- **`stock/{type}` and `stockLogs/{id}`:** read by approved users, write by admin, **plus
  one narrow staff path for the shift-end deduction**. All three writes must land together in
  one batch:
  - **Shift update** (a new branch for the owner): the shift has already ended; it had no
    `stockDeduction`; only `stockDeduction` changes;
    `stockDeduction.eventId == resource.data.eventId != null`; `sheets` is a number ≥ 0; and
    `existsAfter(events/{eventId}/stockLogs/shift_{id})`.
  - **Stock paper update** by staff: only `currentQuantity`, `updatedAt` and `lastShiftId`
    change. `lastShiftId` names a shift the caller owns, which:
    - belongs to THIS event;
    - had no `stockDeduction` before the batch (`get`) and has one after (`getAfter`);
    - satisfies `old − new == getAfter(shift).stockDeduction.sheets`.
  - **Stock log create** by staff: the id is `shift_{shiftId}`; kind `shift`, stockType
    `paper`; `delta == −getAfter(shift).stockDeduction.sheets`; the event matches; the log
    didn't exist before (a create can't overwrite).
  - Staff cannot restock, correct, change thresholds, write ink, or touch another event or
    shift.
- The Phase 4 locked-key list for staff shift updates adds `stockDeduction`, so the general
  update path can't set it.

## 6. Files
New:
- `lib/inventory/{units,forecast,pending,firestore}.ts` + tests
- `components/admin/{EventsSection,InventorySection,StockCards,StockLog,PaperSettingsCard}.tsx`

Modified:
- `lib/admin/{scope,firestore}.ts`: events with status, stock and logs listeners, low-stock
  in scope, reversal on delete
- `components/admin/{AdminDashboard,DashboardData,Sections,ShiftPieces}.tsx`
- `components/shift/StaffShiftScreen.tsx`: deduction after end
- `lib/shift/types.ts`
- `firestore.rules`
- `README.md`

## 7. Verification
- **Unit tests** as in §2.
- **Emulator rules tests:**
  - a valid staff deduction passes;
  - denied cases:
    - a wrong eventId (e.g. the staff member's NEW assignment rather than the shift's);
    - a second deduction for the same shift;
    - a deduction on another user's shift;
    - a deduction on an open shift;
    - an amount that doesn't match between stock, log and shift;
    - skipping one of the three writes;
    - staff restock, staff ink write, or staff threshold change;
  - admin restock, correction and apply-now pass;
  - approved users can read events and pending users can't;
  - regression runs of the Phase 2–4 suites.
- **Playwright against the emulators:**
  1. Create an event in the UI; its stock docs exist.
  2. Assign staff.
  3. Restock 2 boxes → 216 sheets, with a log showing "2 boxes, +216".
  4. Staff shift: sell 1.5, waste 0.5, end → **214**, log `−2 · Shift ended`, and the shift
     shows "Deducted 2".
  5. **Reassign staff mid-shift** to event B → the shift still deducts from **A**; B is
     untouched.
  6. Delete that shift → stock is restored, with a reversal log.
  7. Correct count → delta logged.
  8. Ink restock and low-stock banner (Overview + Inventory Global).
  9. Seeded ended shift without a deduction → pending → Apply now.
  10. A no-event shift is never deducted, and the note is shown.
  11. The Global comparison table.
  12. Deactivate an event → it's hidden from the assign dropdown.
  13. Screenshots at 1440 and 390 px.
- `npm test`, lint, build. Commit and push. Stop before Phase 6.
