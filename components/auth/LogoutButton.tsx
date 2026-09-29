"use client";

import { useState } from "react";
import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { logout } from "@/lib/auth/logout";

/** Two-step logout: first tap asks, second tap confirms. */
export function LogoutButton({ className }: { className?: string }) {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);

  if (!confirming) {
    return (
      <Button
        variant="ghost"
        className={className}
        leftIcon={<LogOut className="size-4" />}
        onClick={() => setConfirming(true)}
      >
        Log out
      </Button>
    );
  }

  return (
    <div className={`flex items-center justify-center gap-2 ${className ?? ""}`}>
      <Button variant="secondary" onClick={() => setConfirming(false)} disabled={busy}>
        Cancel
      </Button>
      <Button
        variant="danger"
        loading={busy}
        leftIcon={<LogOut className="size-4" />}
        onClick={async () => {
          setBusy(true);
          try {
            await logout();
          } finally {
            setBusy(false);
          }
        }}
      >
        Yes, log out
      </Button>
    </div>
  );
}
