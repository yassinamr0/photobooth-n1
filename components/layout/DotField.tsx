"use client";

import { useEffect, useRef, useState } from "react";
import { MOTION_EVENT, motionEnabled } from "@/lib/design/themes";

/**
 * Background dot field: a fine dot matrix like a darkroom cutting mat / light-table grid.
 *
 * Animated (admin): dots near the pointer brighten toward crimson/pearl with a lagged,
 * spring-like follow; every ~12s a faint "light sweep" passes diagonally across the field
 * (a wave of dots, not a colour gradient); dots breathe very slightly.
 * Static (staff phones, reduced motion): drawn once, no animation loop.
 *
 * Purely decorative: fixed, behind content, pointer-events none, aria-hidden. It only
 * LISTENS to pointer moves on window (passive) and never captures or blocks input.
 */
const GAP = 22;
const REACH = 150;
const SWEEP_MS = 12000;
const FRAME_MS = 1000 / 30;

export function DotField({ animated }: { animated: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);
  // Desktop users can switch the pointer/sweep animation off in the theme menu.
  const [motionOn, setMotionOn] = useState(motionEnabled);
  useEffect(() => {
    const on = () => setMotionOn(motionEnabled());
    window.addEventListener(MOTION_EVENT, on);
    return () => window.removeEventListener(MOTION_EVENT, on);
  }, []);

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const live = animated && motionOn && !reduce;
    let w = 0;
    let h = 0;
    let raf = 0;
    let last = 0;
    // Colours come from the active theme (CSS variables), re-read when the theme changes.
    let dot: number[] = [138, 144, 166];
    let lo: number[] = [169, 177, 214];
    let hi: number[] = [201, 207, 238];
    const readColours = () => {
      const cs = getComputedStyle(document.documentElement);
      dot = hex(cs.getPropertyValue("--color-ink-faint")) ?? dot;
      lo = hex(cs.getPropertyValue("--color-accent")) ?? lo;
      hi = hex(cs.getPropertyValue("--color-accent-text")) ?? hi;
    };
    readColours();
    const target = { x: -9999, y: -9999 };
    const cur = { x: -9999, y: -9999 };

    const resize = () => {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      w = window.innerWidth;
      h = window.innerHeight;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (!live) draw(0);
    };

    function draw(t: number) {
      ctx!.clearRect(0, 0, w, h);
      // Sweep line position along x + y (diagonal), travelling past the whole field.
      const span = w + h + 600;
      const sweep = ((t % SWEEP_MS) / SWEEP_MS) * span - 300;
      for (let y = GAP / 2; y < h; y += GAP) {
        for (let x = GAP / 2; x < w; x += GAP) {
          let a = 0.17;
          let r = 0.75;
          let near = 0;
          if (live) {
            const breathe = Math.sin(t / 1700 + x * 0.013 + y * 0.021) * 0.03;
            a += breathe;
            const sd = Math.abs(x + y - sweep);
            if (sd < 140) a += 0.16 * (1 - sd / 140) ** 2;
            const dx = x - cur.x;
            const dy = y - cur.y;
            const d = Math.sqrt(dx * dx + dy * dy);
            if (d < REACH) near = (1 - d / REACH) ** 2;
          }
          if (near > 0.02) {
            // accent → accent-text as the pointer gets closer
            const p = near;
            const R = Math.round(lo[0] + (hi[0] - lo[0]) * p);
            const G = Math.round(lo[1] + (hi[1] - lo[1]) * p);
            const B = Math.round(lo[2] + (hi[2] - lo[2]) * p);
            ctx!.fillStyle = `rgba(${R},${G},${B},${Math.min(0.85, a + near * 0.7)})`;
            r = 0.75 + near * 1.1;
            ctx!.beginPath();
            ctx!.arc(x, y, r, 0, Math.PI * 2);
            ctx!.fill();
          } else {
            ctx!.fillStyle = `rgba(${dot[0]},${dot[1]},${dot[2]},${a * 0.9})`;
            ctx!.fillRect(x - r, y - r, r * 2, r * 2);
          }
        }
      }
    }

    const loop = (t: number) => {
      raf = requestAnimationFrame(loop);
      if (t - last < FRAME_MS) return;
      last = t;
      // Lagged follow — feels like the light has a little mass.
      cur.x += (target.x - cur.x) * 0.18;
      cur.y += (target.y - cur.y) * 0.18;
      draw(t);
    };

    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      if (cur.x < -9000) {
        cur.x = e.clientX;
        cur.y = e.clientY;
      }
      target.x = e.clientX;
      target.y = e.clientY;
    };
    const onLeave = () => {
      target.x = -9999;
      target.y = -9999;
      cur.x = -9999;
      cur.y = -9999;
    };
    const onVis = () => {
      cancelAnimationFrame(raf);
      if (!document.hidden && live) raf = requestAnimationFrame(loop);
    };

    const onTheme = () => {
      readColours();
      if (!live) draw(0);
    };
    resize();
    window.addEventListener("resize", resize);
    window.addEventListener("booth-theme", onTheme);
    if (live) {
      window.addEventListener("pointermove", onMove, { passive: true });
      document.documentElement.addEventListener("pointerleave", onLeave);
      document.addEventListener("visibilitychange", onVis);
      raf = requestAnimationFrame(loop);
    }
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      window.removeEventListener("booth-theme", onTheme);
      window.removeEventListener("pointermove", onMove);
      document.documentElement.removeEventListener("pointerleave", onLeave);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [animated, motionOn]);

  return <canvas ref={ref} aria-hidden data-testid="dot-field" className="pointer-events-none fixed inset-0 size-full print:hidden" />;
}

/** "#a9b1d6" → [169, 177, 214] (theme tokens are plain 6-digit hex). */
function hex(v: string): number[] | null {
  const m = v.trim().match(/^#([0-9a-f]{6})$/i);
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
