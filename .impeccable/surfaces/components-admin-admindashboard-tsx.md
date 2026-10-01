---
version: 1
slug: "components-admin-admindashboard-tsx"
primary_target: "components/admin/AdminDashboard.tsx"
related_targets: ["components/shift/StaffShiftScreen.tsx"]
---

Scope: whole app (admin dashboard + staff shift screen + auth). Mode: Operate.
Audience/job: staff log sales fast on phones at the booth; owner reads money/stock/P&L on laptop and phone.
Constraints: staff section order locked; semantic colours binding (cash green, visa blue, waste pink-red, totals gold, profit green, loss red, warnings amber); dark; Lucide icons; no violet gradient slop, no colourless UI.

## Direction contract
Seed key: a8ae83c2 (degraded roll; user chose the pick card "Contact sheet / darkroom" over assigned "Mall directory signage").
THESIS: The app is a photographer's contact sheet of the business — every shift, sale and stock card is a numbered frame on a dark proof sheet. Refuses the generic SaaS card grid with tinted pastel chips.
OWN-WORLD: Darkroom-black field (warm neutral, not blue/purple); film-base amber rules and frame numbers (FR-01…) in a condensed mono-ish label face; square frames with 1px edge rules and corner registration ticks; semantic colours are the "prints": solid colour bars / numerals inside frames. Safelight red reserved for loss/negative only.
STORY: Each section is a strip of frames; you scan frame numbers like a contact sheet, colour tells you what the number is.
FIRST VIEWPORT: Admin overview — header strip with frame counter + date range as film-edge text; KPI row as a strip of numbered frames, each with a thick colour print bar (gold total, green cash, blue visa, pink hadr).
SIGNATURE: Frames "develop": numbers fade up from the dark ground on load/section change (short, 220ms), and the active frame gets amber registration corners.
RISK: Decorative ticks on dense tables; keep film-edge details to headers and frame corners, tables stay plain and scannable.
