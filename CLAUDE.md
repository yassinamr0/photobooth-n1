# Booth Log

Next.js 16+ (App Router), TypeScript, Tailwind, Firebase (Firestore + Auth), deployed on Vercel.

Full feature spec: see SPEC.md — read only the section for the CURRENT PHASE below, not the
whole file, unless doing initial architecture planning.

## Non-negotiable business rules (get these exactly right, always — money and inventory
## accuracy depend on them)
- Sheet pricing: price = round(sheetsQty * 400). Every 0.5 sheet = 200 EGP. (0.5→200, 1→400,
  1.5→600, 2→800...)
- Acrylic frame = 400 EGP each. Magnetic frame = 200 EGP each.
- TWO SEPARATE PAPER UNITS — do not conflate them:
  - A PACK = settings/paper.sheetsPerPack sheets (default 18). This is what an employee logs
    during their shift with the "+ Paper change" action (one tap = one pack swapped in).
  - A BOX = settings/paper.sheetsPerBox sheets (default 108). This is what the admin logs
    when restocking Inventory (one restock = N boxes added). Boxes are never logged by staff
    during a shift, and packs are never logged in Inventory restocks.
  - Both are separate, independently editable settings — never hardcode either number
    anywhere, and never use one where the other belongs.
- Paper reconciliation per shift (uses PACKS, not boxes):
  expectedUsed = startPaperCount + (paperChanges × sheetsPerPack) − endPaperCount
  actualUsed = sheets sold + hadr wasted, both summed from that shift's own entries
  Only flag a mismatch when both startPaperCount and endPaperCount exist on the shift.
- Inventory restocking (uses BOXES): admin enters a number of boxes → convert via
  sheetsPerBox → add to that event's stock/paper currentQuantity (tracked internally in raw
  sheets either way).
- A shift's `eventId` is a ONE-TIME SNAPSHOT of the staff member's `assignedEventId` at the
  moment the shift is created. Never re-derive it live. Reassigning a staff member never
  changes any existing shift's eventId — past and current-in-progress shifts keep whatever
  they were stamped with.
- Inventory (paper + ink) is tracked PER EVENT (subcollection under each event), never as one
  shared global pool.
- If a shift crosses midnight (entered end time < entered start time), add 24 hours to the
  end time rather than producing a negative duration.
- On logout: unsubscribe every active Firestore listener BEFORE calling signOut(), to avoid a
  trailing permission-denied error flashing on screen.
- Self-healing signup: if a user is signed in but has no /users/{uid} doc, wait ~4 seconds
  (their own signup write may just be in flight) before showing a "finish setting up" screen
  that lets them re-enter their name and create the missing doc themselves.
- STAFF SHIFT SCREEN LAYOUT IS LOCKED — see SPEC.md Phase 3 "Screen layout" subsection. Do
  not rearrange, merge, or reorder these sections without being asked; this was carried over
  deliberately from the previous version of the app, which the owner likes exactly as-is.

## Current phase
Building Phase 1 of SPEC.md's phase plan. Do not start later phases unprompted — stop and
wait for confirmation after each phase is working.

## Workflow
- Use Plan Mode for anything non-trivial (Shift+Tab). Write the plan to PLAN.md before
  implementing; get it reviewed before writing code.
- Commit to git after each phase is confirmed working.
- Ask before guessing on anything that affects money, inventory counts, or security rules.
