import Link from "next/link";
import { Camera } from "lucide-react";
import { PanelFrame } from "@/components/layout/PanelFrame";

export default function Home() {
  return (
    <PanelFrame variant="mobile">
      <div className="flex min-h-[70dvh] flex-col items-center justify-center gap-6 text-center">
        <span className="grid size-16 place-items-center rounded-[18px] bg-gold text-[#1a1406]">
          <Camera className="size-7" />
        </span>
        <div>
          <h1 className="font-display text-4xl font-extrabold tracking-tight">Booth Log</h1>
          <p className="mt-2 text-ink-muted">Rebuild in progress — Phase 1: design system.</p>
        </div>
        <Link
          href="/style-guide"
          className="inline-flex h-12 items-center rounded-full bg-accent-gradient px-7 font-semibold text-white"
        >
          Open the style guide
        </Link>
      </div>
    </PanelFrame>
  );
}
