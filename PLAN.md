# PLAN — Phase 2: Auth & Roles

> Phase 1 (design system + /style-guide) is built and pushed (commit `6ee8e0d`). Its plan is
> kept in git history; after approval this file replaces `PLAN.md`.

## Context
Staff and admins need to sign up, log in, wait for approval, and log out. Two bugs from the
legacy app must not come back:
1. **Stuck accounts.** Signup makes two network calls: create the Auth account, then write the
   profile. If the second call fails, the user can log in but has no `/users/{uid}` doc.
2. **Logout error flash.** Firestore listeners that are still running when `signOut()` happens
   get a permission-denied error, and it flashes on screen.

The new app uses the **same Firebase project as the legacy app** (`memoire-erp-d1f81`).
That means:
- existing legacy `/users` docs must keep working;
- the rules you paste must keep the legacy `/entries` and `/shifts` rules intact.

Out of scope: the admin approval UI (Phase 4 Staff section), staff shift screens (Phase 3),
and Admin SDK/API routes.

## 1. Firebase client setup
- Add the `firebase` dependency (v12, modular).
- `lib/firebase/client.ts` initializes the app once (reusing an existing instance on hot
  reload) and exports `auth` and `db`. All config comes from `NEXT_PUBLIC_FIREBASE_*` env vars
  (apiKey, authDomain, projectId, storageBucket, messagingSenderId, appId). Nothing is
  hardcoded.
- If any env var is missing, the app shows a "Firebase not configured" card listing the
  variable names, instead of crashing.
- Commit `.env.example` with placeholder values. Add `!.env.example` to `.gitignore`, which
  currently ignores all `.env*` files. You copy the real values from `legacy/index.html` into
  `.env.local` locally and into Vercel's env settings.

## 2. Listener registry — the logout fix (`lib/firebase/listeners.ts`)
Every Firestore subscription in the app goes through one helper. No component calls
`onSnapshot` directly (documented in the file header, and applies to every later phase):
```ts
listen(ref, onNext, onError?) → unsubscribe   // registers in a module-level Set
unsubscribeAll()                              // calls + clears every registered unsub
isSigningOut()                                // true between logout start and auth=null
```
- `listen()` wraps the error callback. When `isSigningOut()` is true, or `auth.currentUser` is
  null, it ignores `permission-denied` errors silently. That's a second safety net, in case a
  late error still arrives.
- `lib/auth/logout.ts`, in this exact order:
  1. set the `signingOut` flag;
  2. clear the missing-profile timer (see §3);
  3. **`unsubscribeAll()`**;
  4. **then** `await signOut(auth)`;
  5. reset the flag in `finally`.
- The `onAuthStateChanged(null)` handler also calls `unsubscribeAll()`. That covers sign-outs
  that don't go through the button, such as a token revoked or an account deleted.

## 3. Auth state machine — `components/auth/AuthProvider.tsx` (client)
A context exposing `status`, `user` (Firebase user) and `profile` (parsed `/users` doc):

| status | when | screen |
|---|---|---|
| `loading` | auth not resolved yet | spinner |
| `signedOut` | no Firebase user | Login / Signup |
| `settingUp` | signed in, doc missing, < 4s since first seen missing | "Setting up your account…" |
| `missingProfile` | doc still missing after **4s** | Finish setting up |
| `pending` | doc exists, `approved === false` | Waiting for approval |
| `approved` | doc exists, `approved === true` | role home (placeholder) |
| `error` | listener error while signed in (not during logout) | message + Log out button |

**Self-healing logic:**
- On sign-in, `listen(doc(db,'users',uid))`.
- If the snapshot doesn't exist, start a single 4000ms timer and set `settingUp`. When the
  timer fires, set `missingProfile`.
- If the doc appears at any point (the in-flight signup write lands, or the user finishes
  setup), clear the timer. The live listener then moves them to `pending` or `approved` with
  no reload.
- The timer is cleared on doc arrival, on logout, and on unmount.
- The timer id lives in a module-level ref, so `logout()` can clear it before unsubscribing.
  This matches the legacy app's `unsubscribeAllListeners()`, which also cleared the timer.

**Parsing:** `lib/users.ts` has a `UserProfile` type plus `parseUserDoc()`, which defaults a
missing `assignedEventId` to `null`, because legacy docs don't have that field.
`createUserProfile(uid, name, email)` writes exactly
`{ uid, name, email, role:"staff", approved:false, assignedEventId:null, createdAt: serverTimestamp() }`.
Both signup and Finish setup use this one function.

## 4. Screens (all in `components/auth/`, using Phase 1 components on `PanelFrame variant="mobile"`)
- **AuthGate** (rendered at `/`): switches on `status`.
- **LoginForm**:
  - email + password;
  - "Forgot password?" (`sendPasswordResetEmail`, same as legacy);
  - link to switch to signup.
- **SignupForm**:
  - first name, last name, email, password, confirm password (min 6 characters, must match);
  - `createUserWithEmailAndPassword`, then `createUserProfile(uid, "First Last", email)`;
  - if the profile write fails, show an inline error and leave the user signed in. The §3 flow
    then shows Finish setting up after 4s.
  - **Dev-only test switch:** in `npm run dev` only, a checkbox "Simulate interrupted signup"
    skips the profile write, so you can test self-healing. It isn't rendered in production
    builds.
- **SettingUp**: spinner and "Setting up your account…".
- **FinishSetup**:
  - explains that the profile didn't finish saving;
  - first + last name → `createUserProfile` with `auth.currentUser.email`;
  - Log out link.
- **PendingApproval**:
  - pulsing dot, "Waiting for approval, {name}";
  - explains that it updates automatically;
  - Log out button. No polling — the §3 listener handles it.
- **ApprovedHome** (placeholder until Phases 3/4):
  - greeting, role Tag (Admin/Staff), Log out;
  - "Staff shift screen arrives in Phase 3" / "Admin dashboard arrives in Phase 4".
- **LogoutButton**: asks for confirmation (inline two-step pill, "Log out?" → "Yes, log out"),
  then calls `logout()`.
- Friendly error messages (`lib/auth/errors.ts`), ported from the legacy `authErrorMessage`.
  They cover invalid credentials, email-in-use, weak password, network errors and too many
  requests.
- `/style-guide` stays public, outside the gate.

## 5. Firestore rules — `firestore.rules` (repo root; the legacy copy stays in `legacy/`)
Since this is the same project, the file is **the legacy file with only the `/users` block
replaced**. The `/entries` and `/shifts` blocks stay byte-for-byte identical, so the old app
keeps working.
```
match /users/{userId} {
  allow read: if isSignedIn();
  allow create: if isSignedIn() && request.auth.uid == userId
                && request.resource.data.role == 'staff'
                && request.resource.data.approved == false
                && request.resource.data.get('assignedEventId', null) == null   // (a)
                && request.resource.data.uid == userId;                          // (b)
  allow update: if isAdmin() || (
                  isSignedIn() && request.auth.uid == userId
                  && !request.resource.data.diff(resource.data).affectedKeys()
                        .hasAny(['role', 'approved', 'assignedEventId', 'uid'])   // (c)
                );
  allow delete: if isAdmin();
}
```
- **`affectedKeys()` instead of `field == field`.** Legacy docs have no `assignedEventId`.
  Comparing a missing field makes the rule error out and deny even harmless self-edits.
  `diff()` handles missing fields correctly, and it also blocks adding the field to your own
  legacy doc.
- **Additions beyond the spec's wording** — flagging them because CLAUDE.md says to ask on
  security rules. Each only tightens access:
  - (a) you can't sign up already assigned to an event;
  - (b) the doc's `uid` must match its path;
  - (c) you can't rewrite your own `uid`.
  Drop any you don't want.
- `isAdmin()` is unchanged from legacy: role `admin` **and** `approved == true`.

## 6. Docs
README:
- "Phase 2 setup" section: `.env.local` variables, Vercel env vars, publishing the rules (the
  whole `firestore.rules` file), and authorized domains.
- Bootstrap first admin (per SPEC): sign up → Firebase console → `users/{uid}` → set
  `role: "admin"`, `approved: true`.

## Files
New:
- `lib/firebase/{client,listeners}.ts`
- `lib/auth/{logout,errors}.ts`
- `lib/users.ts`
- `components/auth/{AuthProvider,AuthGate,LoginForm,SignupForm,SettingUp,FinishSetup,PendingApproval,ApprovedHome,LogoutButton,FirebaseNotConfigured}.tsx`
- `firestore.rules`
- `.env.example`

Modified:
- `app/page.tsx` → AuthGate
- `app/layout.tsx` → AuthProvider wrapped around the gate only; `/style-guide` doesn't need
  Firebase
- `.gitignore`, `README.md`, `package.json`

Reused from Phase 1: `PanelFrame`, `Card`, `Button`, `Tag`, `Spinner`, `Avatar`.

## Verification
- `npm run lint` and `npm run build` pass.
- Rules are checked with the Firestore emulator if it can be installed here, otherwise by
  careful review. Emulator test cases:
  - self-create as unapproved staff;
  - blocked self-approve;
  - blocked self-assign event;
  - allowed self name edit on a legacy doc without `assignedEventId`;
  - admin approve;
  - non-admin delete denied.
- UI flows in Playwright against the Auth + Firestore emulators if available:
  - signup → pending;
  - simulated interrupted signup → Finish setup after about 4s → pending;
  - flip `approved` → screen switches live;
  - logout with the console watched: no permission-denied.
- Then commit, push, and hand you the paste-into-console rules plus a manual test walkthrough.
  Stop before Phase 3.
