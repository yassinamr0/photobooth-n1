# Design — Booth Log (machined, themeable)

Booth Log looks like a photographer's contact sheet of the business: a darkroom-black
proof sheet where every card is a numbered frame and colour tells you what a number is.
Source of truth for tokens: `app/globals.css` (`@theme`) and `lib/design/chart.ts`.

## Colour & themes
- Five per-device themes (palette button beside Log out; `components/ui/ThemePicker.tsx`,
  values in `app/globals.css` `:root[data-theme]`, list in `lib/design/themes.ts`):
  **Ink** (default: navy ink + warm-white buttons + periwinkle accent), **Forest** (green
  charcoal + cream + sage), **Graphite** (charcoal + amber), **Memoire** (the original
  maroon/pink), **Mono** (greys only). A boot script applies the saved theme before paint.
- Components use ROLE tokens only: canvas/surface/surface-2/line/well, ink tiers,
  `primary` + `on-primary` (button & selected fills), `accent` + `accent-text` (focus, hover
  borders, spotlight, dot highlights), warning, ambient. Legacy names (maroon, crimson,
  pearl, edge) alias these roles.
- **Fixed meanings (owner-binding, identical in every theme):** money/totals gold `#ffc93c` ·
  cash green `#4ade80` · Visa blue `#5b9cff` · hadr pink `#ff4d8d` · profit green ·
  loss/expenses red `#ff5c6c`.
- No corner marks (removed at the owner's request).

## Type
- **Figtree** for UI text; **Plus Jakarta Sans** for headings, card titles and big numerals
  (bold, tracking −0.03em, tabular). Sentence case for titles and stat labels; only tiny form
  labels / table headers stay small caps. (Barlow Condensed was dropped: too sharp.)

## Background
- Plum-black canvas with ambient maroon light pooling from the top, a faint crimson bounce
  bottom-right and a vignette (`ambient` utility on PanelFrame).
- Reactive dot field (`components/layout/DotField.tsx`): a fine dot matrix like a light-table
  grid. Admin: dots near the mouse brighten crimson→pearl with a lagged follow, a faint light
  sweep crosses every ~12s, dots breathe slightly. Staff phones / reduced motion: static.
  Canvas is fixed, aria-hidden, pointer-events none; paused when the tab is hidden.

## Materials (taste: high-end-visual-design · emil · apple-design)
- **plate** (every Card): translucent plate inside a machined double bezel — the shell ring is
  box-shadow on the same element (no extra DOM). A soft accent-coloured spotlight follows the mouse (`components/ui/Spotlight.tsx`).
- **alert-plate**: warning-tinted plate with a warning-colour leading spine; live alerts get a pulsing `led`.
- **well**: recessed inputs, selects and segmented tracks.
- **key / key-primary**: raised buttons with a light-catch edge and a lip; press sinks 1px.
- Segmented controls: a primary-colour thumb slides under the selected tab (`components/ui/Segmented.tsx`).
- KPI bento: hero gold Total tile (with a cash/Visa split bar), Cash and Visa medium tiles,
  compact count tiles; each tile washed in its meaning colour with a Lucide icon.
- Tables: header band; rows lift on hover with an accent leading indicator.
- Desktop admin header is a sticky glass bar (blur). Sheets dim + blur the page and rise on
  the iOS drawer curve; popovers materialize (scale + blur); toasts are glass pills with icons.
- Empty states: recessed panel with a lens mark. Loading: skeletons with a light sweep.
- Radii: controls 4px, tiles 8px, cards 10px (+6px bezel), sheets 12–14px.

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
