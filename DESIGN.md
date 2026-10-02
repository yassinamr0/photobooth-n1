# Design — "Contact sheet" (maroon edition, machined)

Booth Log looks like a photographer's contact sheet of the business: a darkroom-black
proof sheet where every card is a numbered frame and colour tells you what a number is.
Source of truth for tokens: `app/globals.css` (`@theme`) and `lib/design/chart.ts`.

## Colour
- **Ground:** plum-tinted darkroom blacks, so the neutrals sit in the same family as the
  maroon/crimson chrome (the earlier bronze blacks clashed with it) — canvas `#0f0c0e`,
  surface `#181316`, raised `#21191d`, rules `#33272d` / `#4a3a42`. Text is pearl-white
  `#f6eff3`, muted `#b9a9b2`, faint `#937f8b`. Never warm/bronze or blue greys.
- **Brand chrome (owner's change: maroon replaced the film-edge orange):** Maroon `#6a1b3a`
  fills primary buttons and the active menu item; Velvet Crimson `#a64d79` draws frame
  registration corners, borders, hover and focus; Pearl Pink `#edbbdb` is the readable accent
  text (greeting name, scope line, selection). Never used for data meanings.
- **Fixed meanings (owner-binding, never reused for anything else):**
  money/totals/revenue = gold `#ffc93c` · cash = green `#4ade80` · Visa = blue `#5b9cff` ·
  hadr/waste = pink `#ff4d8d` · profit = green · loss/expenses/errors = red `#ff5c6c` ·
  warnings (low stock, mismatches) = maroon box, crimson border, pearl text (owner's change).
- No gradients anywhere (legacy `bg-accent-gradient` / `text-accent-gradient` utilities are
  solid maroon / pearl).

## Background
- Plum-black canvas with ambient maroon light pooling from the top, a faint crimson bounce
  bottom-right and a vignette (`ambient` utility on PanelFrame).
- Reactive dot field (`components/layout/DotField.tsx`): a fine dot matrix like a light-table
  grid. Admin: dots near the mouse brighten crimson→pearl with a lagged follow, a faint light
  sweep crosses every ~12s, dots breathe slightly. Staff phones / reduced motion: static.
  Canvas is fixed, aria-hidden, pointer-events none; paused when the tab is hidden.

## Materials (taste: high-end-visual-design · emil · apple-design)
- **plate** (every Card): translucent plate inside a machined double bezel — the shell ring is
  box-shadow on the same element (no extra DOM). Crimson registration corners sit just inside
  the curve. A soft crimson spotlight follows the mouse (`components/ui/Spotlight.tsx`).
- **alert-plate**: maroon plate with a crimson leading spine; live alerts get a pulsing `led`.
- **well**: recessed inputs, selects and segmented tracks.
- **key / key-primary**: raised buttons with a light-catch edge and a lip; press sinks 1px.
- Segmented controls: a maroon thumb slides under the selected tab (`components/ui/Segmented.tsx`).
- KPI bento: hero gold Total tile (with a cash/Visa split bar), Cash and Visa medium tiles,
  compact count tiles; each tile washed in its meaning colour with a Lucide icon.
- Tables: header band; rows lift on hover with a crimson leading indicator.
- Desktop admin header is a sticky glass bar (blur). Sheets dim + blur the page and rise on
  the iOS drawer curve; popovers materialize (scale + blur); toasts are glass pills with icons.
- Empty states: recessed panel with a lens mark. Loading: skeletons with a light sweep.
- Radii: controls 4px, tiles 8px, cards 10px (+6px bezel), sheets 12–14px.

## Type
- **Figtree** — UI text (15px base).
- **Barlow Condensed** — film-edge lettering: card titles (uppercase, +0.03em), stat labels
  (uppercase, +0.07em), all big numerals (tabular). Never decorative mono.

## Motion
- One authored moment: content "develops" — opacity + a light blur settling
  (`animate-develop`, 180ms, `cubic-bezier(0.23,1,0.32,1)`) on section switch, opening a
  shift or a date group, and the staff screen; stat prints cascade 40ms apart.
- Popovers (date picker) scale in from their trigger (0.97 + fade, 160ms).
- Toasts rise in from below and leave the same way (transition, 160ms).
- Chart bars rise from the baseline once on mount (260ms); chart tooltips fade in the first
  time, then re-point instantly while moving across adjacent bars.
- Loading shows skeleton blocks shaped like the coming layout, never a full-page spinner.
- Data-table rows lift on hover (pointer devices only).
- Every pressable element presses to `scale(0.97)`; colour transitions 150ms; hover only on
  real pointers. Under `prefers-reduced-motion` all movement (scale, slide, grow, blur) is
  removed but fades stay.

## Icons
Lucide only, one stroke weight. No text glyphs as icons.

## Staff shift screen
Section order is locked (CLAUDE.md). Header: logo + "Hi, {name}" + Log out, with the
offline/sync pill under it.
