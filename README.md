# Booth Log

> **Rebuild in progress.** This repo is being rebuilt as a Next.js app (see `SPEC.md`,
> `PLAN.md`). Current state: Phase 6 — statistics (all six phases built). The original single-file app lives in
> `legacy/`; its instructions (further down) still apply to it.

## Rebuild — setup

### 1. Environment variables
Copy `.env.example` to `.env.local` and fill in the Firebase web config (Firebase console →
Project settings → Your apps → SDK setup). The rebuild uses the **same Firebase project as the
legacy app**, so the values are the ones in `legacy/index.html` (`firebaseConfig`). Add the
same six `NEXT_PUBLIC_FIREBASE_*` keys in Vercel → Project → Settings → Environment Variables.

```bash
npm install
npm run dev     # http://localhost:3000  (style guide: /style-guide)
```

### 2. Firestore security rules
Firebase console → Firestore Database → Rules → replace everything with the contents of
`firestore.rules` (repo root) → Publish. **Re-paste the whole file after every phase that
changes it** (Phase 3 did). The new app shares `/shifts` and `/entries` with the legacy app,
and the rules stay compatible with it, so both apps keep working side by side.

### 3. Authorized domains
Firebase console → Authentication → Settings → Authorized domains → add your Vercel domain
(`localhost` is allowed by default).

### 4. Become the first admin (one-time, manual)
1. Open the app and sign up like anyone else — you land on "Waiting for approval".
2. Firebase console → Firestore Database → Data → `users` → your document (its ID is your
   Auth UID; match it by the `email` field).
3. Edit `role` → `"admin"` and `approved` → `true`. Save.
4. The app switches over by itself — no reload needed. Approve everyone else from inside the
   app once the admin dashboard exists (Phase 4); until then, approve via the console or the
   legacy app's admin panel.

### 5. Events and inventory
Create booth locations in the dashboard's **Events** section; each gets its own paper, ink,
acrylic-frame and magnetic-frame stock (Inventory section). Frames and ink are restocked by
piece. Paper is restocked in **boxes** (Inventory → Paper units → sheets
per box, default 108) and stored in sheets. When a staff member ends a shift, that shift's
sheets sold + wasted, ink changes and frames sold are deducted automatically from the event
the shift was tagged with. Low-stock alerts can be marked as read; they come back once stock
is fixed and then drops low again. Shifts → "Tag shifts with no event" attaches old
legacy-app shifts to an event without touching its stock.
Events created by hand in the console (just a `name` field) work too — their stock is set up
the first time an admin opens the dashboard.

### 6. Profit & loss
The **P&L** section (admins only) shows revenue − expenses for the selected location and date
range. Add one-off expenses or monthly ones like rent (spread evenly over each month's days).
Costs not tied to one booth go under **General**. Re-paste `firestore.rules` after updating —
the expense collections are admin-only.

### 7. Card fees, product costs, break-even
In **P&L → Card machine fees** pick "Percentage only" or "Percentage + fixed" (per card sale)
and save — it stays in force until you change it, and a change never rewrites earlier days.
**What things cost you** (box of paper, ink cartridge, frames) powers "Profit per product",
"Waste cost you …" and break-even. Events you **Mark as ended** stop raising alerts.

### 8. Offline mode (staff)
Nothing to set up. If a booth loses signal, staff keep logging; the header shows
"Offline · N changes waiting to sync" and everything syncs when the connection returns. The
installed app also opens with no signal (service worker, production builds only).

### 9. Daily summary email (Resend, 9:00 AM Cairo)
One-time setup (about 10 minutes):
1. **Resend:** sign up at resend.com with the email that should receive the summary →
   API Keys → Create → copy the key. (Without your own domain Resend can only send to the
   address you signed up with — that's fine for this. To send to other people, add and verify
   a domain in Resend and set `SUMMARY_EMAIL_FROM`, e.g. `Booth Log <summary@yourdomain.com>`.)
2. **Firebase service account:** Firebase console → ⚙ Project settings → Service accounts →
   **Generate new private key** → a JSON file downloads. Keep it private — it has full access
   to the database. Never commit it.
3. **Vercel → your project → Settings → Environment Variables** (Production), add:
   - `RESEND_API_KEY` = the Resend key
   - `SUMMARY_EMAIL_TO` = your email (comma-separate for several)
   - `FIREBASE_SERVICE_ACCOUNT` = the WHOLE contents of the JSON file (paste it as-is)
   - `CRON_SECRET` = any long random string (Vercel sends it with the scheduled call)
   - optional `APP_URL` = your site's address (adds an "Open Booth Log" button)
4. **Redeploy** (Deployments → ⋯ → Redeploy) so the new variables and the schedule in
   `vercel.json` take effect.
5. Open **P&L → Daily summary email → Send test email now**. It tells you exactly which
   variable is missing if something isn't set.

The schedule runs at 06:00 and 07:00 UTC; the app sends only once the Cairo clock reaches
9:00 (so it's right in both summer and winter time) and never twice in a day.

### Testing tips
- `npm test` runs the unit tests for the money/time rules (sheet pricing, sale totals,
  midnight rollover, shift totals, paper-pack math).
- `npm run dev` shows a dev-only "Simulate interrupted signup" checkbox on the signup form. It
  skips the profile write so you can see the ~4s "Setting up…" wait followed by the
  "Finish setting up" recovery screen. It never appears in production builds.
- Set `NEXT_PUBLIC_FIREBASE_USE_EMULATORS=true` to run against the local Firebase emulators
  (Auth :9099, Firestore :8080) instead of the real project.

## Legacy app

A shift tracker for the photobooth: sheets sold (with automatic pricing), acrylic/magnetic
frames, waste (hadr), split cash/visa payments, staff accounts with admin approval, shift
clock in/out, and a live admin dashboard (this week / this month / all-time, per staff and
combined).

It's a single static HTML file — no build step, no backend server. All data lives in
Firebase (Firestore + Authentication). This repo is just the frontend.

## 1. One-time Firebase setup (skip if already done)

1. Create a free project at [console.firebase.google.com](https://console.firebase.google.com).
2. **Firestore Database** → Create database → production mode.
3. **Authentication** → Sign-in method → enable **Email/Password**.
4. **Firestore Database → Rules** → paste in the contents of `firestore.rules` from this repo → Publish.
5. Project settings → your web app → copy the `firebaseConfig` object and make sure it matches
   what's already in `index.html` (search for `firebaseConfig` near the top of the `<script type="module">`
   block). If you're starting a fresh Firebase project, replace those values with your own.

## 2. Push this to GitHub

```bash
git init
git add .
git commit -m "Booth Log"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/booth-log.git
git push -u origin main
```

(Or just create a new repo on GitHub and upload these files through the web UI — no CLI required.)

## 3. Deploy on Vercel

1. Go to [vercel.com](https://vercel.com) → **Add New → Project** → import the GitHub repo you just pushed.
2. Framework preset: leave it as **Other** (this is a plain static site, no build step needed).
3. Click **Deploy**. You'll get a live URL like `https://booth-log-yourname.vercel.app`.

## 4. Critical last step — authorize the domain in Firebase

Firebase Auth blocks sign-ins from domains it doesn't recognize. Your Vercel URL needs to be
added or login will fail with an `auth/unauthorized-domain` error:

1. Firebase console → **Authentication → Settings → Authorized domains**.
2. Click **Add domain**, paste in your `*.vercel.app` URL (and any custom domain later).

## 5. Install on phones

Anyone can now just open the Vercel URL in Safari (iPhone) or Chrome (Android) and use
**Share → Add to Home Screen**. It runs full-screen like a native app. Because it's loading
from a real URL now (not a downloaded file), everyone automatically gets the latest version
next time they open it — no reinstalling needed when the app is updated and redeployed.

## 6. Become the first admin (one-time, manual)

1. Open the app, sign up with your name/email/password like anyone else — you'll land on
   "Waiting for approval."
2. Firebase console → **Firestore Database → Data → `users`** collection → find your document.
3. Edit two fields: `role` → `"admin"`, `approved` → `true`. Save.
4. Reopen the app — it switches to the Admin Panel automatically. From here on, approve
   everyone else from inside the app.

## Notes

- The Firebase config in `index.html` is safe to have public in this repo — it's a client
  identifier, not a secret. The actual security boundary is `firestore.rules`, which is what
  stops people from reading/writing data they shouldn't.
- This app needs an internet connection to log in and sync (it's a live shared database now,
  not offline-only). Firestore queues writes briefly if the connection drops mid-shift and
  syncs once it's back.
- No environment variables or `.env` file are needed — there's no build step and nothing
  sensitive to hide.
