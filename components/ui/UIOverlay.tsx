"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useUIStore } from "@/stores/uiStore";
import { useLifeStore } from "@/stores/lifeStore";
import { useGenesisStore } from "@/stores/genesisStore";
import { useWorldStore, type Era } from "@/stores/worldStore";
import { useCompanionStore, type CompanionMood } from "@/stores/companionStore";
import { DEFAULT_FLAGS, getLocal, setLocal } from "@/lib/storage";
import { on } from "@/lib/events";
import SettingsSheet from "@/components/ui/panels/SettingsSheet";
import GenesisSheet from "@/components/ui/panels/GenesisSheet";
import Onboarding from "@/components/ui/Onboarding";
import ControlsHelp from "@/components/ui/ControlsHelp";
import CompanionPanel from "@/components/ui/CompanionPanel";
import TimeDial from "@/components/ui/TimeDial";

/**
 * Persistent chrome budget (hard rule): one brand chip, one time/compass
 * pill, one companion orb. Everything else is contextual and ephemeral.
 * Container swallows no pointer events — the world stays interactive.
 */
export default function UIOverlay() {
  const settingsOpen = useUIStore((s) => s.activePanel?.kind === "settings");
  const timeOpen = useUIStore((s) => s.activePanel?.kind === "time");
  const genesisPhase = useGenesisStore((s) => s.phase);
  return (
    <div className="pointer-events-none fixed inset-0 z-10 font-body">
      <EraOverlay />
      <BrandChip />
      <TimeCompass />
      <CompanionOrb />
      <Hints />
      <ControlsHelp />
      <CompanionPanel />
      <AnimatePresence>{settingsOpen && <SettingsSheet />}</AnimatePresence>
      <AnimatePresence>
        {timeOpen && <TimeDial onClose={() => useUIStore.getState().dismiss()} />}
      </AnimatePresence>
      {genesisPhase === "asking" && <GenesisSheet />}
      <GenesisGate />
      <GenesisFlash />
      <Toast />
      <Onboarding />
    </div>
  );
}

/** Sepia (past) / ethereal-blue (future) wash + banner while time-travelling. */
function EraOverlay() {
  const era = useWorldStore((s) => s.era);
  const tint =
    era === "past"
      ? "rgba(120,86,40,0.16)"
      : era === "simulated"
        ? "rgba(90,150,220,0.16)"
        : "transparent";
  return (
    <AnimatePresence>
      {era !== "present" && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.5 }}
          className="pointer-events-none absolute inset-0"
          style={{ background: tint, boxShadow: "inset 0 0 180px rgba(0,0,0,0.22)" }}
        >
          <button
            type="button"
            className="glass pointer-events-auto absolute left-1/2 top-5 -translate-x-1/2 px-4 py-1.5 font-label text-xs font-bold uppercase tracking-wider text-ink"
            onClick={() => useWorldStore.getState().clearPreview()}
          >
            {era === "past" ? "↩ Viewing the past — return to now" : "✨ Possible future — return to now"}
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/** Decides whether this browser runs Genesis (fresh) or skips it (returning). */
function GenesisGate() {
  useEffect(() => {
    const flags = getLocal("flags", DEFAULT_FLAGS);
    if (flags.genesisDone) return;

    // deep links (?island=…) and explicit skips bypass genesis — they're
    // inspection paths, not first-run journeys
    const params = new URLSearchParams(window.location.search);
    if (params.has("island") || params.has("nogenesis")) {
      useGenesisStore.getState().skip();
      return;
    }

    const decide = (source: "snapshot" | "fixture"): void => {
      if (source === "snapshot") {
        // existing world — never re-run genesis over it
        setLocal("flags", { ...getLocal("flags", DEFAULT_FLAGS), genesisDone: true });
      } else {
        useGenesisStore.getState().begin();
      }
    };

    const booted = useWorldStore.getState().bootSource;
    if (booted) {
      decide(booted);
      return;
    }
    return on("world:booted", ({ source }) => decide(source));
  }, []);

  // rise timer → finish + hydrate life events once world is interactive
  useEffect(() => {
    void useLifeStore.getState().hydrate();
    return useGenesisStore.subscribe((s, prev) => {
      if (s.phase === "rising" && prev.phase !== "rising") {
        const total = (13 * 0.85 * 0.6 + 2.6 + 0.4) * 1000;
        setTimeout(() => useGenesisStore.getState().finishRise(), total);
      }
    });
  }, []);

  return null;
}

/** Soft white bloom masking the dressing pop-in at the end of the rise. */
function GenesisFlash() {
  const [flash, setFlash] = useState(false);

  useEffect(() => {
    return useGenesisStore.subscribe((s, prev) => {
      if (prev.phase === "rising" && s.phase === "done") {
        setFlash(true);
        setTimeout(() => setFlash(false), 950);
      }
    });
  }, []);

  return (
    <AnimatePresence>
      {flash && (
        <motion.div
          initial={{ opacity: 0.92 }}
          animate={{ opacity: 0 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.9, ease: "easeOut" }}
          className="pointer-events-none absolute inset-0 bg-white"
        />
      )}
    </AnimatePresence>
  );
}

/** Check-in confirmations — ephemeral, bottom-center. */
function Toast() {
  const toast = useLifeStore((s) => s.toast);
  return (
    <AnimatePresence>
      {toast && (
        <motion.div
          initial={{ opacity: 0, y: 14, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 8 }}
          transition={{ duration: 0.4, ease: "easeOut" }}
          className="glass absolute bottom-20 left-1/2 -translate-x-1/2 px-4 py-2"
        >
          <span className="font-label text-xs font-semibold text-ink">{toast}</span>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function BrandChip() {
  return (
    <motion.button
      type="button"
      initial={{ opacity: 0, y: -12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.7, delay: 0.3, ease: "easeOut" }}
      whileTap={{ scale: 0.95 }}
      className="glass pointer-events-auto absolute left-4 top-4 flex cursor-pointer items-center gap-2 px-3.5 py-2"
      title="Settings"
      onClick={() => {
        const ui = useUIStore.getState();
        if (ui.activePanel?.kind === "settings") ui.dismiss();
        else ui.openSettings();
      }}
    >
      <span className="block h-3.5 w-3.5 rounded-full bg-gradient-to-br from-aura via-mystic to-gold shadow-[0_0_10px_rgba(79,195,247,0.8)]" />
      <span className="font-heading text-sm font-semibold tracking-wide text-ink">
        LifeVerse
      </span>
    </motion.button>
  );
}

const ERA_LABEL: Record<Era, string> = {
  past: "The Past",
  present: "Golden Hour",
  simulated: "The Future",
};

function TimeCompass() {
  const timeOpen = useUIStore((s) => s.activePanel?.kind === "time");
  const era = useWorldStore((s) => s.era);
  const season = useWorldStore((s) => (s.preview ?? s.state)?.season);
  const label =
    era === "present"
      ? season
        ? `${season[0].toUpperCase()}${season.slice(1)}`
        : ERA_LABEL.present
      : ERA_LABEL[era];

  return (
    <motion.button
      type="button"
      initial={{ opacity: 0, y: -12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.7, delay: 0.45, ease: "easeOut" }}
      whileTap={{ scale: 0.95 }}
      className={`glass pointer-events-auto absolute right-4 top-4 flex cursor-pointer items-center gap-2 px-3.5 py-2 ${
        era !== "present" ? "ring-2 ring-aura/60" : ""
      }`}
      title="Time travel"
      onClick={() => {
        const ui = useUIStore.getState();
        if (ui.activePanel?.kind === "time") ui.dismiss();
        else ui.openTime();
      }}
    >
      <svg width="15" height="15" viewBox="0 0 24 24" className="text-ink-soft">
        <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" strokeWidth="2" />
        <path d="M15.5 8.5 13 13l-4.5 2.5L11 11z" fill="currentColor" />
      </svg>
      <span className="font-label text-xs font-semibold tracking-wider text-ink-soft uppercase">
        {label}
      </span>
      {timeOpen && <span className="h-1.5 w-1.5 rounded-full bg-aura" />}
    </motion.button>
  );
}

const ORB_TINT: Record<CompanionMood, { mid: string; deep: string; glow: string }> = {
  celebrate: { mid: "rgba(255,184,77,0.9)", deep: "rgba(200,120,0,0.9)", glow: "255,184,77" },
  encourage: { mid: "rgba(79,195,247,0.88)", deep: "rgba(0,102,136,0.9)", glow: "79,195,247" },
  advise: { mid: "rgba(179,157,219,0.9)", deep: "rgba(94,68,160,0.9)", glow: "179,157,219" },
  neutral: { mid: "rgba(159,217,192,0.88)", deep: "rgba(20,120,100,0.9)", glow: "159,217,192" },
};

function CompanionOrb() {
  const mood = useCompanionStore((s) => s.mood);
  const thinking = useCompanionStore((s) => s.thinking);
  const t = ORB_TINT[mood];
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
        background: `radial-gradient(circle at 32% 30%, rgba(255,255,255,0.95), ${t.mid} 45%, ${t.deep})`,
        boxShadow: `0 0 24px rgba(${t.glow},0.65), 0 0 60px rgba(${t.glow},0.25), 0 6px 18px rgba(0,102,136,0.35)`,
      }}
      title="Talk to Aria"
      aria-label="AI companion"
      onClick={() => useCompanionStore.getState().toggle()}
    >
      <motion.span
        className="absolute inset-0 rounded-full"
        style={{ boxShadow: "inset 0 0 14px rgba(255,255,255,0.8)" }}
        animate={{ opacity: thinking ? [0.4, 1, 0.4] : [0.6, 1, 0.6] }}
        transition={{ duration: thinking ? 1 : 3.2, repeat: Infinity, ease: "easeInOut" }}
      />
    </motion.button>
  );
}

const HINTS = [
  "Drag to orbit · Scroll to zoom · Double-click an island to fly",
  "Click any building to inspect it · Click the sky to back out",
  "Press ? anytime to see all controls",
];

const HINT_MS = 4200;

function Hints() {
  const [idx, setIdx] = useState(-1);

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];
    timers.push(setTimeout(() => setIdx(0), 1600));
    HINTS.forEach((_, i) => {
      timers.push(setTimeout(() => setIdx(i + 1), 1600 + (i + 1) * HINT_MS));
    });
    return () => timers.forEach(clearTimeout);
  }, []);

  const hint = idx >= 0 && idx < HINTS.length ? HINTS[idx] : null;

  return (
    <AnimatePresence mode="wait">
      {hint && (
        <motion.div
          key={hint}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 10 }}
          transition={{ duration: 0.55, ease: "easeOut" }}
          className="glass absolute bottom-6 left-1/2 -translate-x-1/2 px-4 py-2"
        >
          <span className="font-label text-xs font-medium tracking-wide text-ink-soft">
            {hint}
          </span>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
