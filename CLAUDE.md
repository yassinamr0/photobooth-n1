# Booth Log

Next.js 16+ (App Router), TypeScript, Tailwind, Firebase (Firestore + Auth).
Full feature spec: see SPEC.md — read only the section relevant to the current phase,
not the whole file, unless doing initial planning.

## Non-negotiable business rules (get these exactly right, always)
- Sheet pricing: price = round(sheetsQty * 400). Every 0.5 sheet = 200 EGP.
- 1 pack of paper = sheetsPerPack sheets (default 18)
- 1 box of paper = settings/paper.sheetsPerBox sheets (default 108, editable — never hardcode 108 elsewhere).
- Paper reconciliation: expectedUsed = startPaperCount + (paperChanges × sheetsPerPack) − endPaperCount.
  actualUsed = sheets sold + hadr wasted, both from that shift's entries.
- A shift's eventId is a ONE-TIME SNAPSHOT of the staff member's assignedEventId at shift-start time.
  Never re-derive it live. Reassigning a staff member never changes their past or current shift's eventId.
- Inventory (paper/ink) is tracked PER EVENT, not globally.
- On logout: unsubscribe all Firestore listeners BEFORE calling signOut().

## Current phase
Building phase [N] of SPEC.md's BUILD IN PHASES plan. Don't start later phases unassigned.

## Workflow
- Use Plan Mode for anything non-trivial. Write the plan to PLAN.md before implementing.
- Commit to git after each working phase.
