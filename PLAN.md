# PLAN — Phase 4: Admin Dashboard Shell

> Phases 1–3 are built and pushed (`6ee8e0d`, `81bd895`, `f9a9efd`). Once you approve, this
> file replaces `PLAN.md`.

## Context
Admins currently land on a placeholder. Phase 4 gives them the dashboard:
- Overview
- Pending approvals
- Staff, with a separate read-only history view
- Shifts, with paper reconciliation

The **global event scope switcher** re-scopes everything except Pending approvals. Events are
created in Phase 5; for now you create one test event by hand in the console (§7).

**Decisions you made:**
1. **Pack size is snapshotted per shift.** New shifts store the `sheetsPerPack` in effect when
   they start. Reconciliation uses that value, and falls back to the current setting for
   legacy or existing shifts that don't have it.
2. **Reject** deletes the `/users` profile doc only. No Admin SDK yet.
3. **Date ranges** go by the shift's start date. Every entry counts toward the range its shift
   started in, so Overview, Staff and Shifts always agree.

## 1. Scope is built in from the start (the core design)
Sections never read raw Firestore data; they only receive already-scoped data. That way no
section can accidentally ignore the switcher.

- **`DashboardScopeProvider`** (context) holds:
  - `scope`: `"global"` or an event id;
  - `range`: `"week"`, `"month"` or `"all"` (the week starts Monday, as in legacy).
  - Both persist in `localStorage`. If the selected event no longer exists, it falls back to
    Global.
- **`useDashboardData()`** holds one set of live listeners (all through `listen()`, so logout
  is still safe): `users`, `shifts`, `entries`, `events`, `settings/paper`.
- **Pure function `scopeDashboard(raw, scope, range, now)`** in `lib/admin/scope.ts`,
  unit-tested, returns:
  - `shifts`: in range by `startTime` AND (`scope === "global"` or `shift.eventId === scope`);
  - `entries`: entries whose shift is in `shifts`. Entries store no eventId, so their event
    always comes from their shift. Under Global only, orphan entries (their shift is gone)
    are included by their own time;
  - `overview`: `aggregate(entries)` (reuses `lib/shift/summary.ts`), plus the unverified
    mismatch count;
  - `staffRows`:
    - **Global:** every approved staff member, plus anyone with shifts in range but no
      approved profile (removed users, or admins who worked shifts), each with their totals;
    - **Event:** only people with at least one shift in that event in range, with totals from
      those shifts only. That includes people no longer assigned there.
  - `dateGroups`: shifts grouped by local start date, newest first, each group carrying its
    total and a `hasMismatch` flag.
- **`useScopedDashboard()`** = raw data + scope → `scopeDashboard` (memoised). This is the
  **only** thing Overview, Staff, Shifts and Staff history consume. Pending approvals uses
  `raw.users` directly (always global) and says so in a comment.

## 2. Paper reconciliation (`lib/shift/paper.ts`, extended and unit-tested)
- **Formula:** `expectedUsed = startPaperCount + paperChanges × packSize − endPaperCount`.
  `packSize = shift.sheetsPerPack ?? settings.sheetsPerPack`. Packs only; `sheetsPerBox` is
  never referenced.
- **Actual:** `actualUsed = sheets sold + hadr wasted`, from that shift's own entries.
- **When it checks:** `null` unless both `startPaperCount` and `endPaperCount` exist, so open
  or legacy shifts are never flagged.
- **Result:** `mismatch = actual ≠ expected`, and `warn = mismatch && !paperVerified`.
  `diff = actual − expected`.
- **Wording** (as in spec and legacy):
  - "Printer: started with 40, refilled 2× (+36 sheets), 5 left over → expected 71 used"
  - "Logged as sold + wasted: 65"
  - "Off by 6 (less sold/wasted than the paper accounts for)", or "…more…" when diff > 0
  - "Matches ✓" when equal.
- **Mark as checked** sets `paperVerified: true`, and the warning is removed from:
  - the shift row icon;
  - the date heading icon;
  - the Overview banner count.
  The numbers stay, with "Checked off by admin ✓" and an **Unmark** link.
- **Snapshot:** Phase 3's `startShift` adds `sheetsPerPack` (the live settings value) to new
  shift docs.

## 3. Dashboard UI — `components/admin/` (PanelFrame "dashboard" + SidebarRail from Phase 1)
- **Top bar**, always visible on every section:
  - greeting;
  - the **event switcher** (pill dropdown: "Global" + each event by name);
  - the **date-range tabs** (This week / This month / All time).
  The range lives in the top bar rather than only on Overview, because Staff and Shifts
  depend on the "selected date range" too.
  A scope chip reads "Showing: City Stars · This month".
- **Navigation:** the sidebar rail has Overview, Pending (count badge), Staff and Shifts. On
  phone widths a compact pill row replaces it.
- **Overview:**
  - mismatch banner ("⚠ N shifts in this range don't match paper counts", links to Shifts)
    when N > 0;
  - a pending-approvals nudge when there are any;
  - KPI grid in Phase 1 style: Total EGP (gold), Cash, Visa, Sheets sold, Hadr wasted,
    Acrylic, Magnetic.
- **Pending approvals** (always global; says "All locations"): name, email, signup time,
  **Approve** (`approved: true`) and **Reject** (two-step confirm, deletes the profile doc).
- **Staff** — management only:
  - each row: avatar, name, role tag, scope totals (total EGP gold, cash/visa, sheets, hadr,
    frames), and an **Assigned event** dropdown ("No event" + events) that sets
    `assignedEventId`, with a note that it only affects future shifts;
  - the **View history →** button opens a **separate view**.
- **Staff history** (separate, read-only view, with a back button):
  - that person's shifts in the current scope and range, newest first;
  - same shift rows as the Shifts section, but read-only: no delete, and no mark-checked.
- **Shifts** accordion:
  - **Date heading:** date, day total EGP, and ⚠ if any shift inside has an unverified
    mismatch.
  - **Shift row, collapsed:** time range, staff name, duration or "ongoing", ⚠ if mismatched,
    and under Global a small event label ("City Stars" / "No event").
  - **Expanded shift:**
    - the 7-stat grid;
    - the paper reconciliation block with Mark as checked / Unmark;
    - **Delete shift**: a two-step confirm stating "Deletes this shift and its N entries.
      This can't be undone."
    - Deletion is a batched delete of the entries plus the shift, chunked at 450.
- `ApprovedHome`: admins get `AdminDashboard`, staff keep `StaffShiftScreen`.

## 4. Security rules (`firestore.rules`)
- **New `/events/{id}`:** read and write by admin only. Staff never see events, per spec.
  Phase 5 can widen this if needed.
- **`/shifts` create** adds:
  `request.resource.data.get('sheetsPerPack', null) == null || request.resource.data.sheetsPerPack == currentPack()`.
  `currentPack()` is the `settings/paper` value if that doc exists, else 18. A missing field
  is still allowed, so the legacy app keeps working.
- **`/shifts` update:** `sheetsPerPack` is added to the keys staff can't change.
- **Unchanged:** admins can already update users (approve / `assignedEventId`), delete user
  docs, set `paperVerified`, and delete shifts and entries.

## 5. Files
New:
- `lib/admin/scope.ts` + `scope.test.ts`
- `lib/admin/firestore.ts`: listeners, approve/reject, assign event, mark/unmark, delete
  shift + entries
- `components/admin/{AdminDashboard,DashboardScope,TopBar,EventSwitcher,Overview,PendingApprovals,StaffSection,StaffHistory,ShiftsSection,ShiftRow,PaperBlock,StatGrid}.tsx`

Modified:
- `lib/shift/paper.ts` (+ tests): `reconcileShift`, `describeReconciliation`
- `lib/shift/types.ts`: `sheetsPerPack?`
- `lib/shift/firestore.ts`: snapshot `sheetsPerPack` on start
- `components/shift/StaffShiftScreen.tsx`: pass the pack size to `startShift`
- `components/auth/StatusScreens.tsx`
- `firestore.rules`
- `README.md`

## 6. Verification
- **Unit tests** (`scopeDashboard`):
  - global vs event filtering;
  - entries follow their shift's event;
  - orphan entries appear only under Global;
  - week/month/all boundaries by shift start;
  - staff-row rules, including a reassigned staff member still listed under the old event;
  - mismatch counts respect scope and `paperVerified`.
- **Unit tests** (reconciliation): the spec example (40 + 2×18 − 5 = 71 vs 65 → "Off by 6
  (less…)"), a snapshot pack size, and the `null` cases.
- **Emulator rules tests:**
  - events are admin-only;
  - a correct `sheetsPerPack` snapshot is allowed and a wrong one denied; a missing one is
    allowed;
  - staff can't change `sheetsPerPack`;
  - regression runs of the Phase 2 and 3 suites.
- **Playwright against the emulators:**
  - seed two events, two staff, and shifts in each (one mismatched);
  - switch Global → Event A → Event B, and check the Overview numbers, banner count, staff
    list and shift list change each time;
  - Global shows event labels;
  - Mark as checked removes the ⚠ and the banner count, and Unmark brings them back;
  - approve and reject a pending user;
  - reassign staff and confirm old shifts keep their event;
  - delete a shift removes its entries;
  - screenshots at 1440 px and 390 px.
- `npm test`, lint, build. Commit and push, then tell you the exact `/events` doc to create
  and the verification steps. Stop before Phase 5.

## 7. The test event to create by hand (the user gets this in the final summary too)
Firestore → Start collection `events` → Document ID `citystars` → field `name` (string) =
`City Stars Mall`. Optionally add a second (`mallofegypt` / `Mall of Egypt`) to see switching
between two events. Only `name` is read in Phase 4; Phase 5 may add fields.
