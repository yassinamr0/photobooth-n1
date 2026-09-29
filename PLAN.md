# PLAN — Phase 1: Scaffold + Design System

## Context
Booth Log is being rebuilt from a single-file HTML/Firebase app (`index.html`) into Next.js 16
(App Router) + TypeScript + Tailwind, deployed on Vercel. Phase 1 establishes the visual
identity before any feature screens exist: design tokens, a panel-on-gradient page frame, base
components, and a `/style-guide` route to review them. No Firebase, auth, or data logic in this
phase. Upon approval, this plan is copied verbatim to `PLAN.md` at the repo root (first commit).

## 0. Repo housekeeping
- Move the legacy app into `legacy/` (`index.html`, `firestore.rules`, `icon.jpg`) so it stays
  as reference for Phase 3's locked shift-screen layout but isn't served by Next.
- Replace the misnamed `gitignore` with a proper `.gitignore` (Next defaults + `.env*.local`,
  `.vercel`, `.DS_Store`).
- README: short "Phase 1 / local dev" note on top; old deploy instructions kept under
  "Legacy app" until Phase 2 rewrites setup docs. (`icon.jpg` copied to `app/icon.jpg` as favicon.)

## 1. Scaffold
`npx create-next-app@latest . --ts --tailwind --eslint --app --no-src-dir --import-alias "@/*"`
(scaffold in a temp dir and move in, since the root isn't empty). Tailwind v4 → tokens live in
CSS via `@theme` in `app/globals.css` (no `tailwind.config.js`). Add `clsx` only (for class
merging); no shadcn, no component library.

Fonts via `next/font/google`:
- Display: **Sora** (700/800) — bold, geometric, confident headers & greetings.
- Body/UI: **Inter** — with `tabular-nums` utility for figures.

## 2. Color tokens (`app/globals.css`, `@theme`)
Surface (dark, purple/blue undertone — not flat black):
| token | value | use |
|---|---|---|
| `--color-canvas` | `#0F0D16` | panel base background |
| `--color-surface` | `#17141F` | cards |
| `--color-surface-2` | `#1F1B2A` | raised/hover, inputs |
| `--color-line` | `#2A2538` | thin card borders |
| `--color-line-strong` | `#3A3350` | dividers, focus-ring base |
| `--color-ink` | `#F4F1FA` | primary text |
| `--color-ink-muted` | `#A39DB8` | secondary text |
| `--color-ink-faint` | `#6E6886` | labels, captions |

Accents:
- Primary gradient (data viz / primary CTA): `--color-violet #7C3AED` → `--color-magenta #D946EF`
  → `--color-pink #FF4D8D`; exposed as `.bg-accent-gradient` utility (135°).
- Gold (money / totals / key numbers): `--color-gold #FFC93C`, `--color-gold-dim #3A2F12`.

Status (tags/flags): `--color-success #4ADE80`, `--color-warning #FFB547`, `--color-danger
#FF5C6C`, `--color-info #5B9CFF`, each with a `-dim` background variant (≈15% on canvas).
Payment identity carried from legacy: cash = success green, visa = info blue.

Frame gradient (page background, outside the panel): blush `#F9D5E5` → lavender `#DCCFF7` →
soft blue `#C9DDFB`, as `--gradient-frame`.

Radii/shadow: `--radius-card 16px`, `--radius-inner 12px`, `--radius-panel 28px`;
`--shadow-card` (soft, low-opacity dark drop), `--shadow-panel` (large, diffuse, to float the
panel on the pastel surface).

## 3. Chart color tokens (`lib/design/chart.ts` + CSS vars)
- Ordered categorical series (for multi-series charts), all AA-contrast on `surface`:
  `violet #8B5CF6`, `magenta #D946EF`, `pink #FF4D8D`, `gold #FFC93C`, `blue #5B9CFF`,
  `teal #2DD4BF`.
- `chartGradient`: SVG `<linearGradient>` stop list violet→magenta→pink for bars/rings/lines.
- Hatch pattern: an SVG `<pattern>` (45° diagonal stripes, 6px pitch, magenta over dim violet)
  exported as a reusable `<ChartDefs/>` component that renders `<defs>` with the gradient + hatch
  ids, plus a CSS `.bg-hatch` (repeating-linear-gradient) for non-SVG uses (e.g. progress bars).
- Track color `--color-chart-track #262136`, gridline `--color-chart-grid #221E30`.
- Exported TS object so Phase 6 charts consume the same values (single source of truth: the TS
  file reads nothing from CSS; CSS vars and TS constants are defined side-by-side and a comment
  in each points to the other).

## 4. Page frame — `components/layout/PanelFrame.tsx`
- `<body>` background = `--gradient-frame` (fixed, full viewport).
- Outer padding: 12px mobile / 24px md / 32px lg, so the pastel stays visible around the panel.
- Panel: `bg-canvas`, `rounded-[--radius-panel]` (20px on mobile), `shadow-panel`,
  `min-h-[calc(100dvh-2*pad)]`, `overflow-hidden`, a faint inner top-glow for depth.
- Props: `variant: "dashboard" | "mobile"`.
  - `dashboard`: slot for an icon-only left sidebar (`SidebarRail` — a 72px column of round icon
    buttons, active item gets the accent gradient; built as a static demo here, wired in Phase 4).
  - `mobile`: single centered column, max-w ~480px, larger spacing, no sidebar.

## 5. Base components (`components/ui/`)
All typed, `forwardRef` where they wrap native elements, `className` passthrough, visible
focus rings (`ring-2 ring-magenta/60`), disabled states.

- **Button** — `variant: primary | secondary | pill | danger | ghost`, `size: sm | md | lg`,
  optional `leftIcon`/`rightIcon`, `loading`.
  - primary: accent gradient fill, white text, pill radius.
  - secondary: `surface-2` fill, `line` border, ink text.
  - pill: outlined, compact, for filters/segment toggles (with `selected` state).
  - danger: `danger-dim` fill, `danger` text/border.
- **ActionButton** (mobile staff style) — full-width, min-height 64px, large label + optional
  sub-label and icon, high contrast; `tone: accent | gold | neutral | danger`. Used for things
  like "+ Paper change" in Phase 3.
- **Card** — `Card`, `CardHeader` (title + optional action slot), `CardBody`; `surface` bg, 16px
  radius, `line` border, `shadow-card`; `padding: sm | md | lg`.
- **Tag / Badge** — small rounded (full) label; `tone: neutral | accent | gold | success |
  warning | danger | info`, optional leading dot/icon. Demo examples: role badges (Admin /
  Staff / Pending), event status (Active / Closed), "Paper mismatch" warning flag, "Low stock".
- **StatValue** — number display helper: gold for money (`formatEGP` → "1,200 EGP"), tabular
  nums, large display size. (Formatting only; no pricing logic in Phase 1.)
- **Avatar / AvatarGroup** — rounded-square (10px radius) initials avatar; group overlaps by
  −8px with a canvas-colored ring. Included since the spec calls out the treatment.
- Icons: `lucide-react` (tree-shaken, stroke icons suit the look).

## 6. `/style-guide` route — `app/style-guide/page.tsx`
Rendered inside `PanelFrame variant="dashboard"` with the demo sidebar rail. Sections:
1. **Header** — big display greeting ("Good evening, Yassin"-style sample) + subtitle.
2. **Color tokens** — swatch grid for surfaces, text, accents, status, frame gradient; each shows
   name + hex.
3. **Typography** — display XL/L/M, body, caption, mono/tabular figures, gold money figure.
4. **Buttons** — every variant × size, plus disabled/loading and pill selected state.
5. **Tags** — all tones + the real-world examples listed above.
6. **Cards** — plain card, card with header action, KPI stat cards (gold totals).
7. **Chart tokens** — series swatches; a static SVG demo bar chart mixing gradient and hatched
   bars; a progress ring; a donut; a sparkline trend line — all hand-rolled SVG using
   `ChartDefs` (no chart library yet; Phase 6 picks one and feeds it these tokens).
8. **Avatars** — single + overlapping group.
9. **Mobile staff preview** — a phone-width (≈390px) framed box using `PanelFrame
   variant="mobile"` styling: shift header, stacked `ActionButton`s, a few large pills. Purely
   visual — does NOT pre-empt Phase 3's locked layout order.

`app/page.tsx` for now: a minimal placeholder inside the frame linking to `/style-guide`.

## Files to create
`app/layout.tsx`, `app/globals.css`, `app/page.tsx`, `app/style-guide/page.tsx`,
`components/layout/{PanelFrame,SidebarRail}.tsx`,
`components/ui/{Button,ActionButton,Card,Tag,StatValue,Avatar}.tsx`,
`components/charts/ChartDefs.tsx`, `lib/design/chart.ts`, `lib/format.ts`, `PLAN.md`,
`.gitignore`; move legacy files to `legacy/`.

## Out of scope (Phase 2+)
Firebase SDK/config, auth, env vars, data models, security rules, real charts library,
real navigation.

## Verification
- `npm run lint` and `npm run build` pass (typecheck included).
- `npm run dev`, then load `/` and `/style-guide` with Playwright (preinstalled Chromium) at
  1440px and 390px widths; screenshot both, confirm: pastel gradient visible around the panel,
  no horizontal scroll at 390px, all sections render.
- Commit to `claude/intelligent-dijkstra-d7uzpt` and push; then stop and report exactly what's
  on `/style-guide`. Do not start Phase 2.
