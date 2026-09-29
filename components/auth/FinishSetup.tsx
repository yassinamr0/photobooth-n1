"use client";

import { useState, type FormEvent } from "react";
import { Zap } from "lucide-react";
import { authErrorMessage } from "@/lib/auth/errors";
import { createUserProfile, fullName } from "@/lib/users";
import { Button } from "@/components/ui/Button";
import { Field, FormError } from "@/components/ui/Field";
import { AuthShell } from "./AuthShell";
import { LogoutButton } from "./LogoutButton";
import { useAuth } from "./AuthProvider";

/**
 * Self-healing signup: shown when a user is signed in but their /users/{uid} doc never
 * appeared (e.g. the signup's second network call was interrupted). Lets them create it.
 */
export function FinishSetup() {
  const { user } = useAuth();
  const [first, setFirst] = useState("");
  const [last, setLast] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!user) return;
    if (!first.trim() || !last.trim()) return setError("Enter your first and last name.");
    setBusy(true);
    try {
      await createUserProfile(user.uid, fullName(first, last), user.email ?? "");
      // The live profile listener moves us to "Waiting for approval" automatically.
    } catch (err) {
      setError(authErrorMessage(err));
      setBusy(false);
    }
  }

  return (
    <AuthShell
      title="Finish setting up"
      subtitle="Your account was created, but your profile didn't finish saving. Enter your name to complete it."
      icon={
        <span className="grid size-14 place-items-center rounded-[16px] bg-gold-dim text-gold">
          <Zap className="size-6" />
        </span>
      }
    >
      <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
        {user?.email && (
          <p className="text-center text-sm text-ink-faint">
            Signed in as <span className="text-ink-muted">{user.email}</span>
          </p>
        )}
        <div className="grid grid-cols-2 gap-3">
          <Field id="fs-first" label="First name" autoComplete="given-name"
            value={first} onChange={(e) => setFirst(e.target.value)} />
          <Field id="fs-last" label="Last name" autoComplete="family-name"
            value={last} onChange={(e) => setLast(e.target.value)} />
        </div>
        <FormError>{error}</FormError>
        <Button type="submit" size="lg" loading={busy} className="mt-2 w-full">
          Finish setup
        </Button>
      </form>
      <LogoutButton className="self-center" />
    </AuthShell>
  );
}
