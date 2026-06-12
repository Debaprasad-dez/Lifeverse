"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

/**
 * Persistent chrome budget (hard rule): one brand chip, one time/compass
 * pill, one companion orb. Everything else is contextual and ephemeral.
 * Container swallows no pointer events — the world stays interactive.
 */
export default function UIOverlay() {
  return (
    <div className="pointer-events-none fixed inset-0 z-10 font-body">
      <BrandChip />
      <TimeCompass />
      <CompanionOrb />
      <Hints />
    </div>
  );
}

function BrandChip() {
  return (
    <motion.div
      initial={{ opacity: 0, y: -12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.7, delay: 0.3, ease: "easeOut" }}
      className="glass pointer-events-auto absolute left-4 top-4 flex items-center gap-2 px-3.5 py-2"
    >
      <span className="block h-3.5 w-3.5 rounded-full bg-gradient-to-br from-aura via-mystic to-gold shadow-[0_0_10px_rgba(79,195,247,0.8)]" />
      <span className="font-heading text-sm font-semibold tracking-wide text-ink">
        LifeVerse
      </span>
    </motion.div>
  );
}

function TimeCompass() {
  return (
    <motion.div
      initial={{ opacity: 0, y: -12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.7, delay: 0.45, ease: "easeOut" }}
      className="glass pointer-events-auto absolute right-4 top-4 flex items-center gap-2 px-3.5 py-2"
      title="Time travel — coming soon"
    >
      <svg width="15" height="15" viewBox="0 0 24 24" className="text-ink-soft">
        <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" strokeWidth="2" />
        <path d="M15.5 8.5 13 13l-4.5 2.5L11 11z" fill="currentColor" />
      </svg>
      <span className="font-label text-xs font-semibold tracking-wider text-ink-soft uppercase">
        Golden Hour
      </span>
    </motion.div>
  );
}

function CompanionOrb() {
  return (
    <motion.button
      type="button"
      initial={{ opacity: 0, scale: 0.6 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.8, delay: 0.6, ease: [0.34, 1.56, 0.64, 1] }}
      whileHover={{ scale: 1.08 }}
      whileTap={{ scale: 0.92 }}
      className="pointer-events-auto absolute bottom-5 right-5 h-14 w-14 cursor-pointer rounded-full border border-white/70"
      style={{
        background:
          "radial-gradient(circle at 32% 30%, rgba(255,255,255,0.95), rgba(79,195,247,0.85) 45%, rgba(0,102,136,0.9))",
        boxShadow:
          "0 0 24px rgba(79,195,247,0.65), 0 0 60px rgba(79,195,247,0.25), 0 6px 18px rgba(0,102,136,0.35)",
      }}
      title="Companion — awakens in a later phase"
      aria-label="AI companion"
    >
      <motion.span
        className="absolute inset-0 rounded-full"
        style={{ boxShadow: "inset 0 0 14px rgba(255,255,255,0.8)" }}
        animate={{ opacity: [0.6, 1, 0.6] }}
        transition={{ duration: 3.2, repeat: Infinity, ease: "easeInOut" }}
      />
    </motion.button>
  );
}

function Hints() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const show = setTimeout(() => setVisible(true), 1600);
    const hide = setTimeout(() => setVisible(false), 9500);
    return () => {
      clearTimeout(show);
      clearTimeout(hide);
    };
  }, []);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 10 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="glass absolute bottom-6 left-1/2 -translate-x-1/2 px-4 py-2"
        >
          <span className="font-label text-xs font-medium tracking-wide text-ink-soft">
            Drag to orbit · Scroll to zoom · Double-click an island to fly · 1–7 visit kingdoms
          </span>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
