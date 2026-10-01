"use client";

import { useState, type FormEvent } from "react";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { firebase } from "@/lib/firebase/client";
import { authErrorMessage } from "@/lib/auth/errors";
import { createUserProfile, fullName } from "@/lib/users";
import { Button } from "@/components/ui/Button";
import { Field, FormError } from "@/components/ui/Field";
import { AuthShell } from "./AuthShell";

const isDev = process.env.NODE_ENV === "development";

export function SignupForm({ onSwitchToLogin }: { onSwitchToLogin: () => void }) {
  const [first, setFirst] = useState("");
  const [last, setLast] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [simulateInterrupt, setSimulateInterrupt] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!first.trim() || !last.trim()) return setError("Enter your first and last name.");
    if (!email.trim()) return setError("Enter your email.");
    if (password.length < 6) return setError("Password should be at least 6 characters.");
    if (password !== password2) return setError("Passwords don't match.");

    setBusy(true);
    let cred;
    try {
      // Network call 1 of 2: the Auth account. Signs the user in immediately.
      cred = await createUserWithEmailAndPassword(firebase().auth, email.trim(), password);
    } catch (err) {
      setError(authErrorMessage(err));
      setBusy(false);
      return;
    }

    // Dev-only: skip call 2 to reproduce an interrupted signup (tests self-healing).
    if (isDev && simulateInterrupt) return;

    try {
      // Network call 2 of 2: the /users profile doc. If this fails the user is left signed in
      // without a profile; AuthProvider waits ~4s then offers "Finish setting up".
      await createUserProfile(cred.user.uid, fullName(first, last), cred.user.email ?? email.trim());
    } catch {
      // This component is usually unmounted by now (AuthProvider switched screens), so there
      // is nothing to show here — the recovery screen handles it.
    }
  }

  return (
    <AuthShell title="Create account" subtitle="An admin approves new accounts before first use.">
      <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
        <div className="grid grid-cols-2 gap-3">
          <Field id="su-first" label="First name" autoComplete="given-name"
            value={first} onChange={(e) => setFirst(e.target.value)} />
          <Field id="su-last" label="Last name" autoComplete="family-name"
            value={last} onChange={(e) => setLast(e.target.value)} />
        </div>
        <Field id="su-email" label="Email" type="email" autoComplete="email" inputMode="email"
          value={email} onChange={(e) => setEmail(e.target.value)} />
        <Field id="su-password" label="Password" type="password" autoComplete="new-password"
          value={password} onChange={(e) => setPassword(e.target.value)} />
        <Field id="su-password2" label="Confirm password" type="password" autoComplete="new-password"
          value={password2} onChange={(e) => setPassword2(e.target.value)} />
        {isDev && (
          <label className="flex items-center gap-2 rounded-inner border border-dashed border-warning/40 px-3 py-2 text-xs text-ink">
            <input type="checkbox" checked={simulateInterrupt} onChange={(e) => setSimulateInterrupt(e.target.checked)} />
            Dev only: simulate interrupted signup (skip profile write)
          </label>
        )}
        <FormError>{error}</FormError>
        <Button type="submit" size="lg" loading={busy} className="mt-2 w-full">
          Create account
        </Button>
      </form>
      <p className="text-center text-sm text-ink-muted">
        Already have an account?{" "}
        <button type="button" onClick={onSwitchToLogin} className="font-semibold text-ink underline-offset-4 hover:underline">
          Log in
        </button>
      </p>
    </AuthShell>
  );
}
