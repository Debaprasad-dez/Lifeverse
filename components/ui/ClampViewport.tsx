"use client";

import { useEffect, useRef, type ReactNode } from "react";

const MARGIN = 14;

/**
 * Keeps a 3D-anchored panel fully on screen. drei <Html> projects its child
 * to a world point; at steep angles or close zoom that point can sit past a
 * viewport edge and clip the card. This wrapper measures its own rect each
 * frame and nudges itself back inside with a CSS translate — the panel stays
 * visually tied to its anchor but never leaves the window.
 */
export default function ClampViewport({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let raf = 0;
    const applied = { x: 0, y: 0 };

    const tick = (): void => {
      const el = ref.current;
      if (el) {
        const r = el.getBoundingClientRect();
        // strip the transform we already applied to recover the base rect
        const left = r.left - applied.x;
        const right = r.right - applied.x;
        const top = r.top - applied.y;
        const bottom = r.bottom - applied.y;
        const vw = window.innerWidth;
        const vh = window.innerHeight;

        let dx = 0;
        if (left < MARGIN) dx = MARGIN - left;
        else if (right > vw - MARGIN) dx = Math.min(0, vw - MARGIN - right);

        let dy = 0;
        if (top < MARGIN) dy = MARGIN - top;
        else if (bottom > vh - MARGIN) dy = Math.min(0, vh - MARGIN - bottom);

        if (dx !== applied.x || dy !== applied.y) {
          applied.x = dx;
          applied.y = dy;
          el.style.transform = `translate(${dx}px, ${dy}px)`;
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div ref={ref} style={{ willChange: "transform" }}>
      {children}
    </div>
  );
}
