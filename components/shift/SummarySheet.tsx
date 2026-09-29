"use client";

import { Copy } from "lucide-react";
import { Sheet } from "@/components/ui/Sheet";
import { Button } from "@/components/ui/Button";

async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // fall through to the legacy path (e.g. non-secure context)
  }
  const ta = document.createElement("textarea");
  ta.value = text;
  ta.style.position = "fixed";
  ta.style.opacity = "0";
  document.body.appendChild(ta);
  ta.select();
  let ok = false;
  try {
    ok = document.execCommand("copy");
  } catch {
    ok = false;
  }
  document.body.removeChild(ta);
  return ok;
}

export function SummarySheet({
  open,
  onClose,
  text,
  onCopied,
}: {
  open: boolean;
  onClose: () => void;
  text: string;
  onCopied: (ok: boolean) => void;
}) {
  return (
    <Sheet open={open} onClose={onClose} title="Shift summary" labelledBy="summary-title">
      <pre data-testid="summary-text"
        className="max-h-[50dvh] overflow-auto rounded-inner border border-line bg-canvas p-4 font-mono text-xs leading-relaxed whitespace-pre-wrap text-ink-muted">
        {text}
      </pre>
      <div className="mt-4 flex gap-3">
        <Button variant="secondary" size="lg" className="flex-1" onClick={onClose}>Close</Button>
        <Button size="lg" className="flex-1" leftIcon={<Copy className="size-4" />}
          onClick={async () => onCopied(await copyText(text))}>
          Copy
        </Button>
      </div>
    </Sheet>
  );
}
