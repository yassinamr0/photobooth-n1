# PLAN — Phase 3: Staff Shift Flow

> Phases 1–2 are built and pushed (`6ee8e0d`, `81bd895`). Once you approve, this file replaces
> `PLAN.md`.

## Context
Approved staff need the live shift screen: start a shift, log sales and waste, track paper
packs, and end the shift. Several details feed money and paper reconciliation, so they must
be exact:
- the pricing formula;
- packs, never boxes;
- the one-time eventId snapshot;
- midnight rollover.

The screen layout is **locked** to the legacy app's order (SPEC Phase 3). The logic is ported
from `legacy/index.html`, lines 779–1262, which the owner already uses.

**Decisions you made:**
1. Reuse the legacy `/shifts` and `/entries` collections, so the two apps interoperate.
2. Only admins can delete shifts.
3. The rules enforce the eventId snapshot.
4. `/settings/*`: approved users read, admins write.

Out of scope: admin views and reconciliation display (Phase 4), events and inventory
(Phase 5). Admins keep the Phase 2 placeholder.

## 1. Business logic — pure functions in `lib/shift/`, unit-tested
- `pricing.ts`
  - `SHEET_PRICE_PER_SHEET = 400`, `FRAME_PRICES = { Acrylic: 400, Magnetic: 200 }`
  - `autoSheetsPrice(q) = q <= 0 ? 0 : Math.round(q * 400)`, so 0.5→200, 1→400, 1.5→600, 2→800
  - `cartSubtotal(cart)` = sheets price (the manual override if set, else auto) + frames ×
    unit price + sum of custom item prices
- `sale.ts` — `buildSaleEntry(cart, payment)`, ported exactly from the legacy `logSale`:
  - you can log if (items exist and either subtotal is 0 or payment > 0), or (no items and
    payment > 0);
  - `total = cash + visa` if that's > 0, else subtotal;
  - `desc` is e.g. "Sheets (1.5), Acrylic x1, Keychain", or "Payment (no items)";
  - a mismatch warning (not a block) when payment ≠ subtotal: "Heads up: payment (X) doesn't
    match items subtotal (Y) — that's fine if intentional".
- `summary.ts` — `aggregate(entries)`, identical to legacy:
  - total, cash, visa, sheets and frames are summed from **sale** entries only;
  - hadr is summed from **waste** entries;
  - waste cost is NOT added to revenue.
  - `buildShiftSummaryText(name, shift, entries)` produces the legacy's plain-text format.
- `time.ts` — `resolveShiftTimes(baseDateISO, startHHMM, endHHMM)`:
  - both times are placed on the shift's start date, in device local time;
  - **if end < start, add 24h** to end (CLAUDE.md).
  - Note: the legacy code used `<=`, which turned end == start into a 24h shift. I'm following
    CLAUDE.md's strict `<`, so equal times give a 0-minute duration.
- `paper.ts`:
  - `DEFAULT_SHEETS_PER_PACK = 18`, `DEFAULT_SHEETS_PER_BOX = 108`;
  - `usePaperSettings()` listens to `/settings/paper` and falls back to the defaults.
  - Staff code only ever touches `sheetsPerPack`; `sheetsPerBox` is only exported for Phase 5.
  - `expectedPaperUsed(shift, sheetsPerPack)` is defined now, for Phase 4:
    `start + changes × sheetsPerPack − end`.
- **Tests:** add `vitest` with `lib/shift/*.test.ts`, covering:
  - the price table from 0.5 to 5;
  - override vs auto price;
  - `total` and log-ability for every legacy case;
  - aggregate sums;
  - midnight: 18:00→02:00 is 8h, 09:00→17:00 is 8h, 10:00→10:00 is 0h;
  - summary text snapshot.

## 2. Data layer (`lib/shift/firestore.ts`) — all live data through `listen()` (Phase 2 registry)
- **Active shift:** `query(shifts, where uid == me, where endTime == null)`, the same as the
  legacy query.
- **My entries this shift:** `query(entries, where uid == me, where shiftId == activeId)`.
  Equality-only, so no composite index is needed.
- **`startShift(profile, startPaperCount)`:**
  - `addDoc` with `{ uid, staffName, eventId: profile.assignedEventId, startTime: now ISO,
    endTime: null, startPaperCount, paperChanges: 0, endPaperCount: null, createdAt }`;
  - `profile` is the live value from the Phase 2 profile listener, so it holds the current
    assignedEventId at that instant;
  - the rules also check it (§4), and it's written once and never recomputed.
- `setStartPaperCount(id, n)` and `adjustPaperChanges(id, current, ±1)`: the value is clamped
  at 0 and nothing is written if it's already 0.
- `endShift(id, startISO, endISO, endPaperCount)`.
- `logSale`, `logWaste` (`{ type: "waste", hadr, desc: "Hadr waste (n)", total: cost || 0,
  cash: 0, visa: 0 }`), and `deleteEntry`.
- Entries store no eventId, per spec.

## 3. Staff shift screen — `components/shift/` (mobile `PanelFrame`, Phase 1 components)
**LOCKED order, as separate stacked cards, top to bottom:**
1. **Your shift** (`ShiftCard`):
   - with no active shift, a big "Start shift" `ActionButton`;
   - when active, the status bar in this order:
     - Started time;
     - Paper loaded (tap to edit inline, 0 or more);
     - pack counter "Changed N×" with **−** and **+ Paper change**, sublabel "1 pack =
       {sheetsPerPack} sheets";
     - **End shift**;
   - **directly followed, in the same card**, by the summary grid: Total EGP (gold), Cash
     (green), Visa (blue), Sheets sold, Hadr wasted, Acrylic sold, Magnetic sold. Current
     shift only, updating live.
2. **New sale** (`SaleCard`):
   - sheets stepper (±0.5) with presets 0.5/1/1.5/2/3/clear;
   - editable price that auto-fills from the formula and resets to auto when quantity changes;
   - Acrylic (400) and Magnetic (200) frame buttons with −/+;
   - "+ Add custom item" (name + price);
   - cart list, items subtotal;
   - Cash/Visa inputs with All cash / All visa / Split 50/50 / Clear;
   - mismatch heads-up, "Logging X EGP", and **Log sale**.
3. **Waste** (`WasteCard`): hadr stepper (±0.5), optional cost, **Log waste**.
4. **This shift** (`ShiftLog`):
   - entry count;
   - newest first, each row with time, description, badges (CASH n / VISA n / WASTE), total,
     and a delete button with a confirm step.
5. **Footer**: "Copy shift summary", which opens a sheet with the text and a Copy button
   (clipboard API, with a textarea fallback).

- Cards 2–4 are hidden until a shift is active, like the legacy app. The footer is always
  shown.
- **Start dialog:** "How many sheets are currently loaded in the printer?" A whole number,
  0 or more, is required.
- **End dialog:**
  - actual start time, defaulting to the stored start;
  - actual end time, defaulting to now;
  - sheets left in the printer, required;
  - a live preview line, e.g. "Shift length: 8h 00m (ends next day)", so a rollover is visible
    before confirming.
- A small `Toast` component gives feedback ("Sale logged", "Paper change logged", …).
- Double-submit is blocked (buttons disabled while writing).
- Staff never see anything about events.
- `ApprovedHome`: staff get the `StaffShiftScreen`; admins keep the placeholder.

## 4. Security rules — `firestore.rules`, replacing the `/entries` and `/shifts` blocks; adding `/settings`
Helper: `isApproved()` = signed in, has a user doc, and `approved == true`. The existing
`isApprovedStaff()` is renamed to this; admins are approved too.
```
match /shifts/{shiftId} {
  allow read: if isApproved();
  allow create: if isApproved()
    && request.resource.data.uid == request.auth.uid
    && request.resource.data.get('eventId', null)
         == myDoc().data.get('assignedEventId', null)          // snapshot enforced
    && request.resource.data.get('paperVerified', false) == false;
  allow update: if isAdmin() || (isApproved()
    && resource.data.uid == request.auth.uid
    && !request.resource.data.diff(resource.data).affectedKeys()
         .hasAny(['uid', 'eventId', 'paperVerified', 'createdAt']));
  allow delete: if isAdmin();                                   // your choice
}
match /entries/{entryId} {
  allow read: if isApproved();
  allow create: if isApproved()
    && request.resource.data.uid == request.auth.uid
    && get(/databases/$(database)/documents/shifts/$(request.resource.data.shiftId))
         .data.uid == request.auth.uid;                         // only into your own shift
  allow update, delete: if isAdmin() || (isApproved()
    && resource.data.uid == request.auth.uid
    && !request.resource.data.diff(resource.data).affectedKeys()   // (update only)
         .hasAny(['uid', 'shiftId', 'createdAt']));
}
match /settings/{docId} {
  allow read: if isApproved();
  allow write: if isAdmin();
}
```
- Entry update and delete are written as separate `allow` lines, because the `diff` check only
  applies to updates.
- **Legacy-compatible:**
  - legacy shifts have no `eventId`, which `get('eventId', null)` treats as null;
  - legacy entries already store the shift's uid;
  - the legacy admin "mark paper checked" still works, because it's admin-only.
- **Tightened beyond the spec wording**, flagged per CLAUDE.md:
  - staff can't change `uid`, `eventId`, `paperVerified` or `createdAt` on their own shift;
  - entries can only be created in your own shift;
  - staff can't move an entry to another shift or user.
  - Payment and price values are deliberately NOT validated in rules, since overrides and
    discounts are allowed.
- `/users` rules from Phase 2 are unchanged.

## 5. Files
New:
- `lib/shift/{pricing,sale,summary,time,paper,firestore}.ts` with tests
- `components/shift/{StaffShiftScreen,ShiftCard,SaleCard,WasteCard,ShiftLog,StartShiftDialog,EndShiftDialog,SummarySheet,Stepper}.tsx`
- `components/ui/{Toast,Sheet}.tsx`
- `vitest.config.ts`

Modified:
- `firestore.rules`
- `components/auth/StatusScreens.tsx` (staff → shift screen)
- `package.json` (vitest, `test` script)
- `README.md` (rules re-paste + test walkthrough)

## Verification
- `npm test` (pricing, midnight, aggregate and sale-builder unit tests), `npm run lint`,
  `npm run build`.
- Emulator rules tests:
  - pending user can't read shifts or entries;
  - staff creates own shift; wrong eventId is denied; eventId matching assignment is allowed;
  - staff can't change eventId, uid or paperVerified;
  - staff can't delete a shift; admin can;
  - staff can't create an entry in someone else's shift; can delete own entry, not others';
  - legacy-shaped shift create (no eventId) works when unassigned;
  - `/settings` read by approved users; write by admin only.
- Playwright against the emulators, full shift:
  1. Start with 50 sheets.
  2. Sale of 1.5 sheets + 1 Acrylic, all cash → 1000 EGP.
  3. Waste of 0.5.
  4. + Paper change twice, then − once → 1.
  5. Check the summary grid.
  6. Delete an entry.
  7. Copy summary.
  8. End shift at 18:00→02:00 with 20 left → endTime next day, `endPaperCount` 20.
  9. The doc has `eventId` from the profile.
  10. Screenshot each step; confirm the card order in the DOM.
- Commit, push, and give you the rule-paste instructions and a manual walkthrough. Stop
  before Phase 4.
