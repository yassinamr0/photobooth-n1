# Booth Log — Full Rebuild Spec

Internal management tool for a photobooth business. Full rebuild of an existing single-file
HTML/Firebase app, expanded with new features and a custom design. All money is in EGP
(Egyptian Pounds).

Build and confirm each phase below before starting the next one. Each phase section is
written to be mostly self-contained — read the phase you're on, plus the Global Context
below, rather than the entire file at once.

---

## GLOBAL CONTEXT (applies to every phase)

### Tech stack
- Next.js 16+ (App Router), TypeScript — use `next@latest` at setup time
- Tailwind CSS — a genuinely custom design system (see Phase 1), not default shadcn/Tailwind
  starter look
- Firebase: Firestore (database) + Firebase Authentication (email/password)
- Firebase Admin SDK inside Next.js API routes (or Cloud Functions) for anything requiring
  elevated privileges — e.g. fully deleting a staff member's login credentials, not just
  their Firestore profile
- Deployed on Vercel. All Firebase config values read from environment variables, never
  hardcoded in source.

### Roles
Two roles: "staff" and "admin." New signups always start as unapproved staff — only an
existing admin can approve or promote someone from inside the app. The first admin is
bootstrapped manually via the Firebase console (editing their own user doc's role/approved
fields directly) — document this as a one-time setup step in the README.

### Pricing (exact — do not deviate)
- Sheets: price = round(sheetsQty * 400). Every 0.5 sheet = 200 EGP. Staff can manually
  override the computed price per sale if needed (auto-fills but stays editable).
- Acrylic frame: 400 EGP each. Magnetic frame: 200 EGP each.
- Custom items: staff enters a free-text name + manual price.
- Sale entries split between cash/visa in any combination — doesn't have to match the item
  subtotal (flag it as a heads-up, but still allow it; could be an intentional discount/tip).

### Paper units — TWO separate, independently-editable settings (see CLAUDE.md for the
### full rule; do not conflate them anywhere in the app)
`/settings/paper`: `{ sheetsPerPack (default 18), sheetsPerBox (default 108) }`
- A **pack** (18 sheets) is what staff log during a shift via "+ Paper change" (Phase 3) and
  what the paper reconciliation formula uses.
- A **box** (108 sheets) is what the admin logs when restocking Inventory (Phase 5).
- Both live in the same settings doc but are never interchanged.

---

## PHASE 1 — Scaffold + Design System

**Deliverable:** a working Next.js project with a small style-guide/showcase page
demonstrating the design tokens and base components below, BEFORE any real feature screens
are built. Confirm the look here first — retrofitting a design system onto already-built
screens is much more expensive than establishing it up front.

### Visual direction
- Dark-mode data dashboard, close in spirit to premium SaaS analytics products. Base
  background is a very dark, near-black charcoal with a faint purple/blue undertone — not a
  flat pure black.
- The whole app renders as a rounded-corner panel with generous outer padding, sitting on
  top of a soft pastel gradient (blush pink → lavender → soft blue) that stays visible in the
  margin around the panel — a dark floating card resting on a colorful surface, not an
  edge-to-edge dark page. This framing device is a deliberate, key part of the look.
  - OWNER CHANGE (after Phase 6): the pastel border was removed — the app is now an
    edge-to-edge dark canvas on every screen. Do not reintroduce the gradient frame.
- Inside the dark panel: individual cards use a slightly lighter dark shade than the base
  background, rounded corners (12–16px), thin subtle borders, soft drop shadows.
- Primary accent: a vivid violet-to-magenta/pink gradient, used specifically for data
  visualization — chart bars, progress rings, donut charts, trend lines. For texture, mix
  solid gradient fills with a subtle diagonal hatch/stripe pattern on some chart segments
  rather than flat fills everywhere — reads as custom-designed, not templated.
- Bold, large, confident sans-serif display type for headers/greetings.
- Minimal, icon-only left sidebar navigation for the admin dashboard.
  - OWNER CHANGE (after Phase 6): every sidebar icon has a short visible text label under it
    (icon-only made sections like Statistics hard to find); the phone nav wraps instead of
    scrolling sideways.
- Pill-shaped buttons and small rounded status/category tags throughout (role badges, event
  status, the paper-mismatch warning flag, low-stock warnings).
- Rounded-square avatar treatment for staff profile photos if/when added; stacked, slightly
  overlapping avatar groups when showing multiple staff at a glance.
- Secondary accent: warm gold (#FFC93C), carried over from the existing app's brand — used
  for money/total figures and key highlight numbers, alongside the violet-magenta gradient as
  the primary accent for charts/data viz. Blend the two; don't replace one with the other.
- Staff-facing MOBILE screens (used one-handed during a live shift) share the same palette
  and typography but use a simpler, higher-contrast interaction pattern: large tappable
  pill-shaped action buttons, generous spacing, minimal chrome. The admin dashboard
  (desktop-first, chart/table-dense) and the staff mobile flow (simple, large-touch-target)
  are two different interaction modes wearing the same visual identity, not the same dense
  layout squeezed onto a smaller screen.

### Base components to build here
Button (primary/secondary/pill/danger variants), Card, Tag/Badge, the chart color tokens,
the panel-on-gradient page frame, and the mobile action-button style. Put these behind a
`/style-guide` route so they can be reviewed before Phase 2 starts.

---

## PHASE 2 — Auth & Roles

### Signup flow
1. User creates a Firebase Auth account (email + password) and enters first/last name.
2. Immediately after, a Firestore profile doc is created at `/users/{uid}`:
   `{ uid, name, email, role: "staff", approved: false, assignedEventId: null, createdAt }`
3. New accounts always start as unapproved staff.
4. **Self-healing signup** (see Global Context / CLAUDE.md rule) — creating the Auth account
   and writing the Firestore profile are two separate network calls. If interrupted, the user
   ends up with a valid login but no profile doc. Detect this and offer a "finish setting up"
   screen rather than leaving the account permanently stuck.
5. Signed-in-but-unapproved users see a "Waiting for approval" screen that updates
   automatically via a live Firestore listener the moment an admin approves them.
6. On logout: unsubscribe every active Firestore listener BEFORE calling signOut() (see
   CLAUDE.md rule — this prevents a trailing permission-denied error during logout).

### Data model
`/users/{uid}`: `{ uid, name, email, role: "staff"|"admin", approved: bool,
assignedEventId: string|null, createdAt }`

### Security rules
- Anyone signed in can read `/users/{uid}` docs (names need to resolve across the app).
- A user can create their own doc (role must be "staff", approved must be false).
- A user can update their own doc EXCEPT they can never change their own role, approved, or
  assignedEventId fields.
- Only an admin can update those three fields or delete a user doc entirely.

---

## PHASE 3 — Staff Shift Flow

### Data model
- `/shifts/{id}`: `{ uid, staffName, eventId (snapshot, see CLAUDE.md rule), startTime (ISO),
  endTime (ISO|null), startPaperCount (int), paperChanges (int, default 0),
  endPaperCount (int|null), paperVerified (bool, optional), createdAt }`
- `/entries/{id}`: `{ uid, staffName, shiftId, time (ISO), type: "sale"|"waste",
  -- sale: sheets (0.5 increments), frames: {Acrylic: int, Magnetic: int},
     custom: [{id, name, price}], desc, total, cash, visa
  -- waste: hadr (0.5 increments), desc, total (0 unless a cost entered)
  createdAt }`
  No eventId stored on entries — derive it by looking up the entry's shift.

### Screen layout — LOCKED, carried over from the previous app version as-is
The owner explicitly likes this exact top-to-bottom arrangement on the staff shift screen and
does not want it rearranged. Build it in this order, as separate stacked cards:
1. **"Your shift" card, at the very top of the screen.** Contains, in this order: the shift
   status bar (start time; editable "paper loaded" value; pack-change counter with +/− — see
   below; ink-change counter with +/−, one tap = one cartridge — owner-approved addition, see
   Phase 5; "End shift" action) directly followed by the live current-shift summary grid (total
   EGP, cash, visa, sheets sold, hadr wasted, acrylic sold, magnetic sold). This whole card,
   summary included, sits above everything else — it's the first thing staff see and should
   stay visible/reachable at the top, not buried under the sale-logging form.
2. **"New sale" card**, below that: sheets quantity stepper + price, frame buttons
   (Acrylic/Magnetic with quantity), custom item add, running cart list, subtotal, cash/visa
   payment split, "Log sale" action.
3. **"Waste" card**, below that: hadr quantity stepper, optional cost, "Log waste" action.
4. **"This shift" card**, below that: a list of every entry logged this shift (time,
   description, payment badges, total, delete button per entry).
5. **Footer action**: "Copy shift summary."
Do not merge the summary grid into a different card, move it below the sale form, or
reorder any of the above sections.

### Behavior
- Starting a shift asks "How many sheets are currently loaded in the printer?" (required)
  before creating the shift doc → becomes startPaperCount. Must be editable afterward (tap to
  correct a typo) while the shift is active.
- On shift creation, stamp eventId from the staff member's CURRENT assignedEventId at that
  exact moment (one-time snapshot, per CLAUDE.md rule).
- While active, a "+ Paper change" action increments paperChanges by 1 each time a new PACK
  (18 sheets by default, via settings/paper.sheetsPerPack — NOT the same as the 108-sheet box
  used in Inventory restocking, see CLAUDE.md) goes into the printer. MUST also have a way to
  decrement it (a − button, never below 0) — an accidental double-tap without an undo becomes
  a permanent, uncorrectable error that throws off the paper reconciliation math later.
- Ending a shift asks for: actual start time (editable, defaults to when they tapped start),
  actual end time (editable, defaults to now), and sheets left in the printer (required,
  becomes endPaperCount). Apply the midnight-rollover rule from CLAUDE.md if end < start.
- The paper reconciliation math this feeds (used in Phase 4) is:
  expectedUsed = startPaperCount + (paperChanges × sheetsPerPack) − endPaperCount
  — packs, not boxes. Boxes never appear anywhere in the staff-facing shift flow.
- While clocked in, show a live-updating summary of the CURRENT SHIFT ONLY (not all-time):
  total EGP, cash, visa, sheets sold, hadr wasted, acrylic sold, magnetic sold.
- "Copy shift summary" generates a plain-text summary (name, start time, totals, a
  line-by-line list of every entry with time + payment breakdown) copyable to clipboard.
- Staff can delete their own individual entries.
- Staff never see or choose an "event" — entirely invisible to them, admin-only bookkeeping
  happening in the background via the assignedEventId snapshot.

### Security rules
`/entries/{id}` and `/shifts/{id}`: read/write require an APPROVED user (not just any
signed-in user — a pending signup must not be able to read sales data). Create requires the
doc's uid field to match the requester's own uid. Update/delete: an admin can always do it; a
regular approved staff member can only touch their own entries/shifts.

---

## PHASE 4 — Admin Dashboard Shell (Overview, Staff, Shifts, Paper Reconciliation, Event
## Switcher)

### The global event scope switcher — the central navigation concept of the dashboard
A persistent event selector at the top of the admin dashboard, always visible. Options:
"Global" (default) plus one entry per event/location that exists (created in Phase 5 — if
testing this switcher before Phase 5 exists, manually add an `/events/{id}` doc via the
Firebase console to have something to switch to).

Switching this selector re-scopes EVERY section below it to that event, EXCEPT Pending
Approvals (always global):
- **Overview**: combined stats grid + warning banners recompute from only that event's
  shifts/entries/inventory (or everything, under "Global").
- **Staff**: under "Global," every approved staff member with overall totals. Under a
  specific event, only staff with at least one shift tagged with that event in the selected
  date range, totals scoped to just that event's shifts (can include staff no longer
  currently assigned there — their past shifts under that event still belong to it).
- **Shifts**: under "Global," all shifts across every location (small per-shift label
  showing which event, since locations are now mixed together). Under a specific event, only
  that event's shifts.
- Inventory and Statistics scoping is covered in Phases 5 and 6 respectively.

### Paper mismatch reconciliation (formula lives in CLAUDE.md / Global Context)
For any mismatched, unverified shift:
- Small warning icon on that shift's row, even collapsed.
- Bubbles up to whatever date/group heading contains it.
- A summary banner at the top of Overview ("N shifts in this range don't match paper
  counts") whenever count > 0, scoped to the current event/Global selection.
- Inside an expanded mismatched shift, show the breakdown in plain language, e.g.:
  "Printer: started with 40, refilled 2× (+36 sheets), 5 left over → expected 71 used"
  "Logged as sold + wasted: 65"
  "Off by 6 (less sold/wasted than the paper accounts for)"
  plus a "Mark as checked" action (`paperVerified: true`) that clears it from every warning
  icon/count (numbers stay visible with a "checked off by admin ✓" note and an "Unmark" link).

### Dashboard sections
- **Overview**: date-range tabs (This week / This month / All time), combined stats grid,
  warning banners.
- **Pending approvals**: not-yet-approved signups with Approve/Reject. Always global.
- **Staff**: management-only list (name + totals for the current scope), plus which event
  each staff member is currently assigned to and a way to change it (dropdown, sets
  assignedEventId — see Phase 5 for the snapshot implications). Tapping a staff member opens
  their full shift history (read-only) in a SEPARATE view — don't mix account-management
  actions and history-browsing in the same interaction.
- **Shifts**: browsable by date, accordion-style — expand a date to see every shift that
  happened then, expand a shift to see its full stat breakdown + paper reconciliation, and a
  delete action that removes the shift AND every entry logged under it (clear confirmation,
  irreversible).

---

## PHASE 5 — Events (Locations) + Per-Event Inventory

### Events are admin-only physical booth locations, NOT a calendar-booking feature
Staff never see or interact with this concept directly.
- Admin can create/edit/deactivate an event: name, optional notes, status
  (active/inactive). Data: `/events/{id}: { name, notes, status, createdAt, createdBy }`
- Admin assigns any staff member to any event any time from the Staff screen (dropdown,
  including "None"). This only sets that user's assignedEventId — nothing else happens
  immediately.
- The assignment only affects shifts STARTED AFTER the change (per the snapshot rule in
  CLAUDE.md):
  - Reassigned while clocked OUT: next shift uses the new event.
  - Reassigned while clocked IN: current active shift keeps its original event; only shifts
    started after this one ends use the new assignment.
  - Past, completed shifts are never moved or retagged.
- Security: `/events/{id}` readable by any approved user, writable only by admins.

### Per-event inventory (paper + ink) — each location has its own printer and supply
- `/events/{eventId}/stock/{type}` (type = "paper" or "ink", SUBCOLLECTION):
  `{ currentQuantity (sheets for paper; cartridges or similar for ink),
  lowStockThreshold, updatedAt }`
- `/events/{eventId}/stockLogs/{id}` (SUBCOLLECTION):
  `{ stockType, delta (+/-), reason, byUid, byName, createdAt }`
- Paper is bought/thought about in BOXES but tracked internally in SHEETS, using the global
  `/settings/paper.sheetsPerBox` (default 108, admin-editable, never hardcoded elsewhere).
  This is a DIFFERENT unit from the PACK (18 sheets, sheetsPerPack) that staff log during a
  shift in Phase 3 — restocking here is always in boxes, never packs.
- Admin restocks a specific event by entering a NUMBER OF BOXES for that location. Convert to
  sheets, add to that event's stock/paper currentQuantity, log both the box count and sheet
  delta in stockLogs.
- Automatic consumption: whenever a shift ends, decrement THAT SHIFT'S OWN eventId's paper
  stock (not the staff member's current assignment) by that shift's actualUsed (sheets sold +
  hadr wasted — the real logged number, not the possibly-wrong "expected" reconciliation
  figure), and log a matching negative stockLog entry. If a shift has no eventId, skip
  automatic consumption for it entirely and don't guess which location to touch — show a
  small UI note that unattributed shifts don't auto-affect any location's inventory.
- Each event's Inventory view: current sheets remaining + box equivalent, low-stock warning
  (same visual treatment as paper-mismatch warnings) when below that location's own editable
  threshold.
- Ink: manual tracking only, per event (no automatic formula) — same restock/adjust/warning
  UI pattern, simpler since no box/sheet conversion applies.
  - Owner-approved follow-up: staff log ink changes during a shift ("+ Ink change", one tap =
    one cartridge, with − to undo; stored as shift.inkChanges). When the shift ends, those
    cartridges are deducted from THAT SHIFT'S eventId's ink stock alongside the paper
    deduction (same once-only / pending / reversal-on-delete rules).
  - Owner-approved follow-up: **acrylic + magnetic frames** are tracked per event too
    (`stock/acrylic`, `stock/magnetic`, in pieces; default warning level 5). Restocked by
    piece. When a shift ends, the frames sold in that shift's own sale entries are deducted
    from THAT SHIFT'S eventId in the same atomic write as paper/ink (logs `shiftacr_<id>` /
    `shiftmag_<id>`; same once-only / pending / reversal-on-delete rules).
  - Owner-approved follow-up: **Mark as read** on a low-stock alert (`alertDismissed` on the
    stock doc, admin-only). Hidden for every admin until that stock is back at/above its
    warning level (restock / count correction / warning-level change / shift reversal
    re-arms it), so the alert returns the next time it drops low.
  - Owner-approved one-time tool: **Tag shifts with no event** (Shifts). Only shifts whose
    eventId is null (legacy app) are offered; they get `{eventId, stockExempt: true}`. They
    count toward that event's revenue/stats but never touch its stock and never show as
    pending. Shifts that already have an eventId are never changed.
- Stock log history view per location, most recent first.
- Rolling average daily consumption (e.g. last 14 days) per location → "at this rate, this
  location's stock runs out in approximately N days." Surface on the event's Inventory view
  AND in Statistics (Phase 6).

### Dashboard structure additions
- **Events**: management screen for creating/editing the location records themselves (the
  list the top switcher pulls from).
- **Inventory**: scoped by the event switcher — a specific event's own stock view under that
  event, or a combined side-by-side comparison table of every location under "Global" (plus a
  low-stock banner if ANY location has crossed its threshold).

---

## PHASE 6 — Statistics

Build exactly these three — do not add more without checking first:

1. **Busiest hours**: sales activity by hour of day and day of week, from entry timestamps.
   A simple heatmap or bar chart is enough. Scoped to the selected event (or combined under
   "Global").
2. **Waste rate** (build thoroughly): hadr wasted as a % of total sheets used (sold + wasted).
   - ~~Ranked list per staff member~~ — REMOVED at the owner's request: shift timing differs
     too much (slow morning shifts can be forced to waste paper between sales) to compare
     staff fairly.
   - Also a trend chart over time at adaptive granularity: daily points under "This week,"
     weekly points under "This month," monthly points under "All time" — so trend direction
     is visible, not just one flat percentage.
   - Visually distinguish an unusually high or climbing rate (warning color) from normal.
3. **Inventory burn-rate projection**: surfaced here too (per-location under a specific
   event, or the combined table under "Global") — same figure as computed in Phase 5.

Owner-approved additions (after Phase 6), same scoping rules as everything else:
4. **Revenue trend** (daily/weekly/monthly by range) + "vs same point last period"
   (week-to-date vs last week to the same moment; month likewise; none for All time).
5. **Locations compared**: every event side by side — revenue, sales, avg sale, hours
   clocked in, EGP/hour, sheets sold, waste % (+ a "No event" row for unattributed shifts);
   selected event highlighted. Each row equals that event's Overview for the same range.
6. **Cash vs Visa**: share of payments + split per period.

Owner-approved changes (after Phase 6):
- **Remove staff** (Staff section): deletes the person's /users profile; their history stays
  (shown as "Removed" when the range includes their shifts). Their Firebase Auth login must
  be deleted in the Firebase console (no Admin SDK).
- **Desktop-first admin layouts** at `lg` and up (phones unchanged; staff shift screen
  unchanged): Overview dashboard (KPIs, revenue + locations, alerts column with low stock,
  mismatches, signups with inline Approve, on shift now), tables for Staff / Pending /
  Events / Shifts / stock history, 2-up Inventory cards (4-up on very wide screens).
- **Thousands separators** on every displayed number (1,000 · 14,400), incl. the staff
  screen and the copied shift summary. Inputs stay plain.
- Memoire logo in the sidebar's top-left square.
- **Custom date range**: the range switcher adds **Custom** — a single day, a Mon–Sun week
  (‹ › to step), or any from–to span (inclusive). A shift counts when its start day is in the
  range. It applies wherever the date range applies (Overview, Staff, Shifts, history,
  Statistics, P&L). "vs last period" compares with the same number of days just before.
- **P&L** (own sidebar item): revenue (= Overview) − expenses = net profit/loss + margin,
  vs last period, expenses by category, revenue vs expenses per period with a profit line,
  and (Global) a per-location table + "General" row that adds up to the total.
  - Expenses (admin-only `/expenses`, `/recurringExpenses`): one-off (counted on its date) or
    monthly recurring (rent, salaries…), **spread evenly over the days of each month**.
    Changing a monthly amount applies from a chosen month; earlier months keep theirs.
    "Stop after this month" ends it; Delete removes it from every month.
  - Location = an event, or **General** (not tied to a booth; only counted under Global).
  - Stock purchases and staff pay are entered as expenses by hand.
  - Everything counts up to today. The optional hadr "cost" field isn't counted.

---

## FULL FIRESTORE SECURITY RULES (consolidated reference — paste into Firebase console once
## all collections exist)

> The deployed source of truth is `firestore.rules` in the repo root — it extends this
> reference (automatic paper/ink/frame deductions, stockExempt, alertDismissed).

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    function isSignedIn() { return request.auth != null; }
    function myDoc() { return get(/databases/$(database)/documents/users/$(request.auth.uid)); }
    function isAdmin() { return isSignedIn() && myDoc().data.role == 'admin' && myDoc().data.approved == true; }
    function isApprovedStaff() { return isSignedIn() && myDoc().data.approved == true; }

    match /users/{userId} {
      allow read: if isSignedIn();
      allow create: if isSignedIn() && request.auth.uid == userId
                    && request.resource.data.role == 'staff'
                    && request.resource.data.approved == false;
      allow update: if isAdmin() || (
                      isSignedIn() && request.auth.uid == userId
                      && request.resource.data.role == resource.data.role
                      && request.resource.data.approved == resource.data.approved
                      && request.resource.data.assignedEventId == resource.data.assignedEventId
                    );
      allow delete: if isAdmin();
    }

    match /entries/{entryId} {
      allow read: if isApprovedStaff();
      allow create: if isApprovedStaff() && request.resource.data.uid == request.auth.uid;
      allow update, delete: if isAdmin() || (isApprovedStaff() && resource.data.uid == request.auth.uid);
    }

    match /shifts/{shiftId} {
      allow read: if isApprovedStaff();
      allow create: if isApprovedStaff() && request.resource.data.uid == request.auth.uid;
      allow update: if isAdmin() || (isApprovedStaff() && resource.data.uid == request.auth.uid);
      allow delete: if isAdmin();
    }

    match /events/{eventId} {
      allow read: if isApprovedStaff();
      allow write: if isAdmin();

      match /stock/{type} {
        allow read: if isApprovedStaff();
        allow write: if isAdmin();
      }
      match /stockLogs/{logId} {
        allow read: if isApprovedStaff();
        allow write: if isAdmin();
      }
    }

    match /settings/{doc} {
      allow read: if isApprovedStaff();
      allow write: if isAdmin();
    }
  }
}
```

---

## DEPLOYMENT

- Push to GitHub, deploy on Vercel with Firebase env vars set in Vercel's project settings
  (never committed to the repo).
- One-time Firebase console steps: create project, enable Firestore (production mode) +
  Email/Password auth, paste in the security rules above, authorize the Vercel domain under
  Authentication → Settings → Authorized domains (sign-in silently fails with
  auth/unauthorized-domain if skipped).
- Installable to a phone home screen (manifest, icons, mobile meta tags) — staff use this
  exclusively on their phones during shifts.

## GENERAL INSTRUCTIONS
- Favor explicit, readable code over cleverness — this will be maintained by someone
  non-technical asking an AI for future changes, not a professional dev team.
- Ask before guessing on anything affecting money, inventory accuracy, or security rules.
