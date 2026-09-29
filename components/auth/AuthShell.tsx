import type { ReactNode } from "react";
import Image from "next/image";
import { PanelFrame } from "@/components/layout/PanelFrame";

/** Centered mobile-style frame used by every auth screen. */
export function AuthShell({
  title,
  subtitle,
  icon,
  children,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  icon?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <PanelFrame variant="mobile">
      <div className="flex min-h-[80dvh] flex-col justify-center gap-8 py-6">
        <div className="flex flex-col items-center gap-4 text-center">
          {icon ?? (
            <Image src="/icons/icon-192.png" alt="Memoire" width={64} height={64} priority
              data-testid="auth-logo" className="size-16 rounded-[16px]" />
          )}
          <div>
            <h1 className="font-display text-3xl font-extrabold tracking-tight">{title}</h1>
            {subtitle && <p className="mt-2 text-ink-muted">{subtitle}</p>}
          </div>
        </div>
        {children}
      </div>
    </PanelFrame>
  );
}
