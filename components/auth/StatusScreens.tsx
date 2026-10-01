"use client";

import { AlertTriangle, Settings2 } from "lucide-react";
import { missingFirebaseEnv } from "@/lib/firebase/client";
import { Spinner } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Tag } from "@/components/ui/Tag";
import { AuthShell } from "./AuthShell";
import { LogoutButton } from "./LogoutButton";
import { useAuth } from "./AuthProvider";
import { StaffShiftScreen } from "@/components/shift/StaffShiftScreen";
import { AdminDashboard } from "@/components/admin/AdminDashboard";

export function LoadingScreen({ message }: { message?: string }) {
  return (
    <AuthShell
      title={message ?? "Loading…"}
      icon={<Spinner className="size-8 border-[3px] text-ink" />}
    />
  );
}

/** Grace period while an in-flight signup profile write may still land. */
export function SettingUpScreen() {
  return <LoadingScreen message="Setting up your account…" />;
}

export function PendingApproval() {
  const { profile } = useAuth();
  const first = profile?.name.split(" ")[0];
  return (
    <AuthShell
      title="Waiting for approval"
      subtitle={
        <>
          {first ? `Hi ${first} — a` : "A"}n admin needs to approve your account before you can
          start logging sales. This page updates automatically the moment you&apos;re approved.
        </>
      }
      icon={
        <span className="relative grid size-14 place-items-center">
          <span className="absolute inset-0 animate-ping rounded-inner bg-magenta/30" />
          <span className="relative size-5 rounded-inner bg-crimson" />
        </span>
      }
    >
      <div className="flex justify-center">
        <Tag tone="warning" dot>Pending approval</Tag>
      </div>
      <LogoutButton className="self-center" />
    </AuthShell>
  );
}

/** Approved users: admins get the dashboard, staff the shift screen. */
export function ApprovedHome() {
  const { profile } = useAuth();
  if (!profile) return null;
  return profile.role === "admin" ? <AdminDashboard /> : <StaffShiftScreen />;
}

export function AuthErrorScreen() {
  const { error } = useAuth();
  return (
    <AuthShell
      title="Couldn't load your account"
      subtitle={error ?? undefined}
      icon={
        <span className="grid size-14 place-items-center rounded-inner bg-danger-dim text-danger">
          <AlertTriangle className="size-6" />
        </span>
      }
    >
      <LogoutButton className="self-center" />
    </AuthShell>
  );
}

export function FirebaseNotConfigured() {
  return (
    <AuthShell
      title="Firebase not configured"
      subtitle="Set these environment variables (see .env.example and the README), then restart."
      icon={
        <span className="grid size-14 place-items-center rounded-inner bg-surface-2 text-ink-muted">
          <Settings2 className="size-6" />
        </span>
      }
    >
      <Card padding="sm">
        <ul className="flex flex-col gap-1 font-mono text-xs text-ink-muted">
          {missingFirebaseEnv.map((name) => (
            <li key={name}>{name}</li>
          ))}
        </ul>
      </Card>
    </AuthShell>
  );
}
