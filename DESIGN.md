# Design — "Contact sheet"

Booth Log looks like a photographer's contact sheet of the business: a darkroom-black
proof sheet where every card is a numbered frame and colour tells you what a number is.
Source of truth for tokens: `app/globals.css` (`@theme`) and `lib/design/chart.ts`.

## Colour
- **Ground:** warm darkroom blacks — canvas `#100f0d`, surface `#191815`, raised `#22201c`,
  rules `#2e2b26` / `#433e36`. Text is photo-paper white `#f4efe6`, muted `#b5ad9f`,
  faint `#7f786c`. Never blue/purple-tinted greys.
- **Film edge `#ff8a3d`** — the app's own accent, for chrome only: frame registration
  corners, active nav, primary buttons, greeting name, scope line, focus, selection, caret.
- **Fixed meanings (owner-binding, never reused for anything else):**
  money/totals/revenue = gold `#ffc93c` · cash = green `#4ade80` · Visa = blue `#5b9cff` ·
  hadr/waste = pink `#ff4d8d` · profit = green · loss/expenses/errors = red `#ff5c6c` ·
  warnings = amber `#ffb547`.
- No gradients anywhere (legacy `bg-accent-gradient` / `text-accent-gradient` utilities are
  solid film-edge).

## Frames
- Every `Card` is a `frame`: 1px rule, 6px radius, two film-edge registration corners
  (top-left, bottom-right) drawn as crisp geometry. No shadows on cards; only floating
  layers (toasts, sheets) get an offset + blur shadow.
- Stat cells are "prints": a 3px top bar in the stat's meaning colour + a big condensed
  numeral in the same colour; neutral counts use a grey bar and white numeral.
- Radii: controls 4px, cards 6px, panels 8px. Round only for dots, spinners, badges.

## Type
- **Figtree** — UI text (15px base).
- **Barlow Condensed** — film-edge lettering: card titles (uppercase, +0.03em), stat labels
  (uppercase, +0.07em), all big numerals (tabular). Never decorative mono.

## Motion
- One authored moment: content "develops" — opacity + a brief over-exposure/blur settling
  (`animate-develop`, 260ms expo-out) on section switch, opening a shift, a date group,
  and the staff screen. Colour transitions 150ms on controls. All off under
  `prefers-reduced-motion`.

## Icons
Lucide only, one stroke weight. No text glyphs as icons.

## Staff shift screen
Section order is locked (CLAUDE.md). Header: logo + "Hi, {name}" + Log out, with the
offline/sync pill under it.
