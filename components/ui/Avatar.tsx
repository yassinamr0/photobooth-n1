import { cn } from "@/lib/cn";

type Size = "sm" | "md" | "lg";

const sizes: Record<Size, string> = {
  sm: "size-8 rounded-inner text-xs",
  md: "size-10 rounded-inner text-sm",
  lg: "size-14 rounded-inner text-lg",
};

function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase();
}

/** Brand tiles (maroon / plum / velvet crimson); initials are always white text. */
const TILES = ["#6a1b3a", "#3a1b2a", "#7d2f55"] as const;

function tileFor(name: string) {
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return TILES[h % TILES.length];
}

/** Rounded-square avatar; falls back to initials on a tinted tile. */
export function Avatar({
  name,
  src,
  size = "md",
  className,
}: {
  name: string;
  src?: string;
  size?: Size;
  className?: string;
}) {
  const tile = tileFor(name);
  return (
    <span
      title={name}
      className={cn(
        "relative inline-grid shrink-0 place-items-center overflow-hidden font-display font-bold text-white",
        sizes[size],
        className,
      )}
      style={
        src ? undefined : { backgroundColor: tile }
      }
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={name} className="size-full object-cover" />
      ) : (
        initials(name)
      )}
    </span>
  );
}

/** Overlapping stack of avatars with an optional "+N" overflow tile. */
export function AvatarGroup({
  names,
  max = 4,
  size = "md",
}: {
  names: string[];
  max?: number;
  size?: Size;
}) {
  const shown = names.slice(0, max);
  const extra = names.length - shown.length;
  return (
    <div className="flex items-center">
      {shown.map((n, i) => (
        <Avatar
          key={n + i}
          name={n}
          size={size}
          className={cn("ring-2 ring-canvas", i > 0 && "-ml-2")}
        />
      ))}
      {extra > 0 && (
        <span
          className={cn(
            "-ml-2 inline-grid place-items-center bg-surface-2 font-semibold text-ink-muted ring-2 ring-canvas",
            sizes[size],
          )}
        >
          +{extra}
        </span>
      )}
    </div>
  );
}
