"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { CheckCircle2, CloudOff, RefreshCw } from "lucide-react";
import { cn } from "@/lib/cn";
import { pendingWrites, subscribeSync } from "@/lib/firebase/offline";

function subscribeOnline(cb: () => void) {
  window.addEventListener("online", cb);
  window.addEventListener("offline", cb);
  return () => {
    window.removeEventListener("online", cb);
    window.removeEventListener("offline", cb);
  };
}

/**
 * Small status pill in the staff header (NOT a section — the locked shift layout is
 * untouched): "Offline · 3 changes waiting to sync", "Syncing…", then briefly "Synced ✓".
 */
export function SyncPill() {
  const online = useSyncExternalStore(subscribeOnline, () => navigator.onLine, () => true);
  const pending = useSyncExternalStore(subscribeSync, pendingWrites, () => 0);
  const [justSynced, setJustSynced] = useState(false);
  const had = useRef(false);

  useEffect(() => {
    if (pending > 0 || !online) {
      had.current = had.current || pending > 0;
      return;
    }
    if (!had.current) return;
    had.current = false;
    const show = setTimeout(() => setJustSynced(true), 0);
    const hide = setTimeout(() => setJustSynced(false), 3000);
    return () => { clearTimeout(show); clearTimeout(hide); };
  }, [pending, online]);

  if (online && pending === 0 && !justSynced) return null;
  const waiting = `${pending} change${pending === 1 ? "" : "s"} waiting to sync`;
  return (
    <span
      role="status"
      data-testid="sync-pill"
      data-state={!online ? "offline" : pending > 0 ? "syncing" : "synced"}
      className={cn(
        "mt-3 flex w-fit max-w-full items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold",
        !online ? "border-warning/40 bg-warning-dim text-warning"
          : pending > 0 ? "border-line bg-surface-2 text-ink-muted"
            : "border-success/40 bg-success-dim text-success",
      )}
    >
      {!online ? <CloudOff className="size-3.5 shrink-0" /> : pending > 0 ? <RefreshCw className="size-3.5 shrink-0 animate-spin" /> : <CheckCircle2 className="size-3.5 shrink-0" />}
      <span className="truncate">{!online ? (pending ? `Offline · ${waiting}` : "Offline · saves on this phone") : pending > 0 ? `Syncing ${pending}…` : "Synced"}</span>
    </span>
  );
}
