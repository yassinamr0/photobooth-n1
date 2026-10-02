/** Selectable colour themes (per device). Values must match :root[data-theme] in globals.css. */
export const THEMES = [
  { id: "ink", name: "Ink", note: "Navy + warm white", swatch: ["#0e111a", "#f3f1ec", "#a9b1d6"], bar: "#0e111a" },
  { id: "forest", name: "Forest", note: "Deep green + cream", swatch: ["#0f1311", "#ede6d6", "#9db8a4"], bar: "#0f1311" },
  { id: "graphite", name: "Graphite", note: "Charcoal + amber", swatch: ["#121212", "#f5a524", "#ffc46b"], bar: "#121212" },
  { id: "memoire", name: "Memoire", note: "The original maroon + pink", swatch: ["#0f0c0e", "#6a1b3a", "#edbbdb"], bar: "#0f0c0e" },
  { id: "mono", name: "Mono", note: "Just greys", swatch: ["#101010", "#e6e6e6", "#9a9a9a"], bar: "#101010" },
] as const;

export type ThemeId = (typeof THEMES)[number]["id"];
export const DEFAULT_THEME: ThemeId = "ink";
export const THEME_KEY = "booth-theme";

/** Runs before first paint (inlined in <head>) so a saved theme never flashes the default. */
export const THEME_BOOT_SCRIPT = `try{var t=localStorage.getItem("${THEME_KEY}");if(t&&t!=="${DEFAULT_THEME}")document.documentElement.dataset.theme=t}catch(e){}`;

/** Background dot-field animation toggle (per device; on by default). */
export const MOTION_KEY = "booth-bg-motion";
export const MOTION_EVENT = "booth-bg-motion";
export function motionEnabled(): boolean {
  try {
    return typeof window === "undefined" || localStorage.getItem(MOTION_KEY) !== "off";
  } catch {
    return true;
  }
}
export function setMotionEnabled(on: boolean) {
  try {
    localStorage.setItem(MOTION_KEY, on ? "on" : "off");
  } catch {
    /* private mode: applies for this visit only */
  }
  window.dispatchEvent(new Event(MOTION_EVENT));
}
