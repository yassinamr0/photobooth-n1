import type { ReactNode } from "react";
import { Camera } from "lucide-react";
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
            <span className="grid size-14 place-items-center rounded-[16px] bg-gold text-[#1a1406]">
              <Camera className="size-6" />
            </span>
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
