# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users
- **Booth staff on phones** — logging sales, waste, paper and ink changes during a shift,
  standing at a photobooth in a mall, often one-handed, under bright mixed lighting.
- **The owner/admin on a laptop** — reviewing money, stock, staff and profit across
  locations.
- **The owner/admin on a phone** — quick checks on the go (alerts, today's numbers).

## Product Purpose
Booth Log runs a small photobooth business (Memoire): every sale and waste sheet is logged
per shift, paper/ink/frames are tracked per location, and the owner sees revenue, stock,
paper reconciliation, statistics and profit & loss. Success = staff log fast without errors,
and the owner can trust every number at a glance.

## Positioning
Built for one specific operation: 0.5-sheet print pricing, packs vs boxes of paper, per-event
stock that deducts itself at shift end, and paper reconciliation that catches mismatches.

## Capabilities and Constraints
- Next.js App Router + Tailwind v4 + Firebase; installed as a PWA; works offline for staff.
- Staff shift screen section ORDER is locked (CLAUDE.md / SPEC Phase 3): Your shift ·
  New sale · Waste · This shift · Copy summary. Visual styling may change; order may not.
- Money and inventory rules in CLAUDE.md are non-negotiable.

## Brand Commitments
- **Fixed colour meanings, everywhere (binding, owner's words "exactly as before"):**
  cash = green · Visa = blue · waste/hadr = pink-red · totals/money = gold ·
  profit = green · loss = red · warnings = amber.
- The Memoire maroon/pink palette is NOT binding any more (owner: "forget about it").
  The Memoire logo image stays as the app icon.
- Dark theme.
- Owner rejected: colourless/greyed-out UI (the Memoire re-theme) and generic AI styling
  (violet→pink gradients everywhere, heavy rounding, glows).
- Icons: Lucide only.

## Product Principles
1. A number's colour tells you what it is before you read the label.
2. Speed for staff beats decoration; nothing on the shift screen should slow a sale.
3. The owner should spot problems (low stock, mismatches, losses) without hunting.
