"use client";

import { useEffect, useRef } from "react";

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

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const live = animated && !reduce;
    let w = 0;
    let h = 0;
    let raf = 0;
    let last = 0;
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
            // crimson → pearl as the pointer gets closer
            const p = near;
            const R = Math.round(166 + (237 - 166) * p);
            const G = Math.round(77 + (187 - 77) * p);
            const B = Math.round(121 + (219 - 121) * p);
            ctx!.fillStyle = `rgba(${R},${G},${B},${Math.min(0.85, a + near * 0.7)})`;
            r = 0.75 + near * 1.1;
            ctx!.beginPath();
            ctx!.arc(x, y, r, 0, Math.PI * 2);
            ctx!.fill();
          } else {
            ctx!.fillStyle = `rgba(185,169,178,${a})`;
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

    resize();
    window.addEventListener("resize", resize);
    if (live) {
      window.addEventListener("pointermove", onMove, { passive: true });
      document.documentElement.addEventListener("pointerleave", onLeave);
      document.addEventListener("visibilitychange", onVis);
      raf = requestAnimationFrame(loop);
    }
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      window.removeEventListener("pointermove", onMove);
      document.documentElement.removeEventListener("pointerleave", onLeave);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [animated]);

  return <canvas ref={ref} aria-hidden data-testid="dot-field" className="pointer-events-none fixed inset-0 size-full print:hidden" />;
}
