"use client";

import { useState, type FormEvent } from "react";
import { sendPasswordResetEmail, signInWithEmailAndPassword } from "firebase/auth";
import { firebase } from "@/lib/firebase/client";
import { authErrorMessage } from "@/lib/auth/errors";
import { Button } from "@/components/ui/Button";
import { Field, FormError, FormNotice } from "@/components/ui/Field";
import { AuthShell } from "./AuthShell";

export function LoginForm({ onSwitchToSignup }: { onSwitchToSignup: () => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setNotice(null);
    if (!email.trim() || !password) return setError("Enter your email and password.");
    setBusy(true);
    try {
      await signInWithEmailAndPassword(firebase().auth, email.trim(), password);
      // AuthProvider takes it from here.
    } catch (err) {
      setError(authErrorMessage(err));
      setBusy(false);
    }
  }

  async function forgot() {
    setError(null);
    setNotice(null);
    if (!email.trim()) return setError("Enter your email above first.");
    try {
      await sendPasswordResetEmail(firebase().auth, email.trim());
      setNotice("Password reset email sent — check your inbox.");
    } catch (err) {
      setError(authErrorMessage(err));
    }
  }

  return (
    <AuthShell title="Booth Log" subtitle="Log in to start your shift.">
      <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
        <Field id="login-email" label="Email" type="email" autoComplete="email" inputMode="email"
          value={email} onChange={(e) => setEmail(e.target.value)} />
        <Field id="login-password" label="Password" type="password" autoComplete="current-password"
          value={password} onChange={(e) => setPassword(e.target.value)} />
        <FormError>{error}</FormError>
        <FormNotice>{notice}</FormNotice>
        <Button type="submit" size="lg" loading={busy} className="mt-2 w-full">
          Log in
        </Button>
        <button type="button" onClick={forgot} className="self-center text-sm text-ink-muted underline-offset-4 hover:text-ink hover:underline">
          Forgot password?
        </button>
      </form>
      <p className="text-center text-sm text-ink-muted">
        New here?{" "}
        <button type="button" onClick={onSwitchToSignup} className="font-semibold text-ink underline-offset-4 hover:underline">
          Create an account
        </button>
      </p>
    </AuthShell>
  );
}
