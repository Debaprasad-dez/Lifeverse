"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

const CONTROLS: { keys: string; action: string }[] = [
  { keys: "Drag", action: "Orbit the world" },
  { keys: "Scroll / pinch", action: "Zoom" },
  { keys: "Double-click island", action: "Fly there" },
  { keys: "Click building", action: "Inspect it" },
  { keys: "Click sky", action: "Dismiss / back out" },
  { keys: "1 – 7", action: "Jump to a kingdom" },
  { keys: "Tab + Enter", action: "Cycle kingdoms, fly" },
  { keys: "Esc", action: "Back out (building → island → world)" },
  { keys: "LifeVerse chip", action: "Settings & world export" },
];

/**
 * Discoverability anchor: a "?" chip that opens the full control list.
 * The one piece of chrome allowed to enumerate inputs — everything else
 * stays diegetic.
 */
export default function ControlsHelp() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === "?") {
        setOpen((v) => !v);
        return;
      }
      if (e.key === "Escape" && open) {
        // capture phase + stopImmediatePropagation so Esc closes help
        // without also triggering the camera's back-out
        e.stopImmediatePropagation();
        setOpen(false);
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [open]);

  return (
    <>
      <motion.button
        type="button"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, delay: 0.8, ease: "easeOut" }}
        whileTap={{ scale: 0.92 }}
        className="glass pointer-events-auto absolute bottom-5 left-16 flex h-9 w-9 cursor-pointer items-center justify-center rounded-full"
        title="Controls (?)"
        aria-label="Show controls"
        onClick={() => setOpen((v) => !v)}
      >
        <span className="font-heading text-sm font-bold text-ink-soft">?</span>
      </motion.button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 14, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.97 }}
            transition={{ type: "spring", stiffness: 360, damping: 30 }}
            className="glass-panel pointer-events-auto absolute bottom-16 left-16 w-72 px-5 py-4 select-none"
          >
            <div className="flex items-center justify-between">
              <h2 className="font-heading text-sm font-bold text-ink">How to explore</h2>
              <button
                type="button"
                aria-label="Close controls"
                className="rounded-full px-2 py-0.5 font-heading text-xs font-bold text-ink-soft hover:bg-white/60"
                onClick={() => setOpen(false)}
              >
                ✕
              </button>
            </div>
            <div className="mt-2.5 space-y-1.5">
              {CONTROLS.map((c) => (
                <div key={c.keys} className="flex items-baseline justify-between gap-3">
                  <span className="shrink-0 rounded-md bg-white/70 px-1.5 py-0.5 font-label text-[0.62rem] font-bold text-ink">
                    {c.keys}
                  </span>
                  <span className="text-right font-body text-[0.68rem] text-ink-soft">
                    {c.action}
                  </span>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
