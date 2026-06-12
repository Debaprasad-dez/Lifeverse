"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { DEFAULT_FLAGS, getLocal, setLocal } from "@/lib/storage";
import { reducedMotion } from "@/lib/motion";
import { islandCenter, KINGDOM_ORDER } from "@/engine/resolver/layout";
import { useCameraStore } from "@/stores/cameraStore";
import { useWorldStore } from "@/stores/worldStore";
import type { CoreKingdomId } from "@/engine/schema/world";

const CAPTIONS: Record<CoreKingdomId, string> = {
  career: "Your Career rises here — every skill a tower, every win a hall.",
  health: "The Health kingdom breathes with you. Habits grow its forest.",
  learning: "Learning keeps the lights on late. Books take flight here.",
  finance: "Finance flows like a golden river — steady hands, high walls.",
  relationships: "Relationships glow warmest. Every bond, a hearth.",
  creativity: "Creativity spills in color. Ideas need somewhere to land.",
  adventure: "And Adventure waits at the edge — peaks, flags, horizons.",
};

const DWELL_MS = 3600;

/**
 * First-run cinematic: one slow flight through all seven kingdoms with
 * captions, ending back at world orbit. Skippable; never plays again
 * (flag in localStorage). Reduced motion skips it entirely.
 */
export default function Onboarding() {
  const [active, setActive] = useState(false);
  const [caption, setCaption] = useState<string | null>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const finish = (): void => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    setLocal("flags", { ...getLocal("flags", DEFAULT_FLAGS), onboarded: true });
    setCaption(null);
    setActive(false);
    useCameraStore.getState().flyToWorld();
  };

  useEffect(() => {
    const flags = getLocal("flags", DEFAULT_FLAGS);
    // genesis owns the first run; the tour is only for pre-genesis worlds
    if (flags.onboarded || !flags.genesisDone || reducedMotion()) {
      if (!flags.onboarded && reducedMotion()) setLocal("flags", { ...flags, onboarded: true });
      return;
    }

    // wait until the world exists, then fly the tour
    let cancelled = false;
    const start = (): void => {
      if (cancelled) return;
      setActive(true);
      KINGDOM_ORDER.forEach((id, i) => {
        timers.current.push(
          setTimeout(() => {
            const island = useWorldStore.getState().state?.islands.find((x) => x.id === id);
            if (island) {
              useCameraStore.getState().flyToIsland(id, islandCenter(island));
              setCaption(CAPTIONS[id]);
            }
          }, 1400 + i * DWELL_MS)
        );
      });
      timers.current.push(
        setTimeout(() => finish(), 1400 + KINGDOM_ORDER.length * DWELL_MS)
      );
    };

    if (useWorldStore.getState().state) start();
    else {
      const unsub = useWorldStore.subscribe((s) => {
        if (s.state) {
          unsub();
          start();
        }
      });
      return () => {
        cancelled = true;
        unsub();
        timers.current.forEach(clearTimeout);
      };
    }
    return () => {
      cancelled = true;
      timers.current.forEach(clearTimeout);
    };
  }, []);

  if (!active) return null;

  return (
    <div className="pointer-events-none absolute inset-0">
      <AnimatePresence mode="wait">
        {caption && (
          <motion.div
            key={caption}
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.7, ease: "easeOut" }}
            className="glass absolute bottom-16 left-1/2 max-w-md -translate-x-1/2 px-5 py-3 text-center"
          >
            <span className="font-heading text-sm font-semibold text-ink">{caption}</span>
          </motion.div>
        )}
      </AnimatePresence>
      <button
        type="button"
        onClick={finish}
        className="glass pointer-events-auto absolute bottom-5 right-5 px-3.5 py-1.5 font-label text-[0.66rem] font-bold uppercase tracking-wider text-ink-soft hover:text-ink"
      >
        Skip tour
      </button>
    </div>
  );
}
