# PLAN — Memoire re-theme + visual de-slop

> Owner's brief: the Memoire palette everywhere; no gradients (backgrounds, buttons, text);
> far less rounding; simple animations; smaller type in a non-generic font; strict text
> colours (white / black, red = negative, green = positive); Lucide SVG icons only; no
> generic "AI" look. Follows the installed `ai-slop-cleaner` workflow (protect behaviour →
> plan → one smell-focused pass at a time → quality gates → report) and `visual-verdict`
> for screenshot QA against the palette.

## Behaviour lock (before any edit)
- **No logic changes** — only tokens, class names, fonts and icons.
- The full unit suite (139) and every browser suite (e2e3–e2e11) must stay green. Those
  suites assert numbers, flows, the locked staff card order and test ids, never colours.

## Palette → tokens (`app/globals.css`, mirrored in `lib/design/chart.ts`)
| Role | Value |
|---|---|
| Page background | `#2A2A2A` Fine Shadow Noir |
| Cards / surfaces | derived from the noir (`#313131`, `#383838`), hairlines `#444` |
| Brand accent (primary buttons, active nav/tab, selected rows) | `#6A1B3A` Maroon; hover `#A64D79` Velvet Crimson |
| Accent tint (selected/alert containers) | `#3A1B2A` Shadow Light |
| Focus ring, small highlights (never text) | `#EDBBDB` Pearl Pink |
| Positive (text) | green `#4ADE80` |
| Negative (text, errors) | red `#FF5A5F` |
| All other text | white, with lower-opacity white for secondary lines; black only on white/pearl fills |
| Charts (validated with the dataviz checker on the dark surface, all checks pass) | `#CF6AA2` · `#923D69` (Velvet Crimson family) + white profit line |

Warnings (low stock, mismatches) stay distinct through a Velvet Crimson border + Maroon
tint + a Lucide alert icon. The text in them is white, so no amber or gold text remains.

## Slop passes (one at a time, verify after each)
1. **Gradients out** — delete `bg-accent-gradient`, `text-accent-gradient`,
   `bg-frame-gradient`, the hatch pattern, the page's radial glow and the chart gradient.
   Use solid brand fills instead.
2. **Rounding down** — radius tokens 12/16/28 → 4/6/8.
   - Pills, buttons, tabs and inputs: `rounded-full` → 4px.
   - Stays round: avatars' 4px squares, status dots, the spinner and count badges.
3. **Shadows / glows out** — card shadow, the active-nav glow and the button glow go.
   Surfaces are separated by hairlines.
4. **Strict text colours** — `text-gold`, `text-info`, `text-pink`, `text-magenta`,
   `text-warning` → white. Money stays white unless it is a profit/loss figure (green/red).
5. **Type** — base size 15px.
   - Body: **Albert Sans** — geometric like Avenir, not the overused Inter.
   - Headings: **Nunito** 800 — rounded heavy weight that echoes the Memoire wordmark.
   - Big numbers shrink one step.
6. **Icons** — remove text glyph icons (✓ ▲ →-style badges) from the UI and use Lucide
   (`Check`, `ArrowUpRight`…). Lucide is already the only icon set; the email keeps plain
   text.
7. **Motion (simple)** — 160–200 ms fade-and-rise on section change and expanding panels,
   colour transitions on hover, a press scale on buttons. All off under
   `prefers-reduced-motion`.

## Verification
- typecheck, lint, unit tests;
- all browser suites;
- desktop and phone screenshots of staff, overview, P&L, inventory and login, checked with
  `visual-verdict` against the palette image;
- a grep gate: no `gradient` in components or CSS, and no text colour outside white /
  green / red.
