"use client";

import { motion } from "framer-motion";
import type { StructureAnchor } from "@/engine/resolver/resolve";
import type { KingdomLayout } from "@/engine/resolver/layout";
import { islandCenter } from "@/engine/resolver/layout";
import { useCameraStore } from "@/stores/cameraStore";
import { useWorldStore } from "@/stores/worldStore";
import { useUIStore } from "@/stores/uiStore";

function closeAndBack(islandId: string): void {
  useUIStore.getState().dismiss();
  const island = useWorldStore.getState().state?.islands.find((i) => i.id === islandId);
  if (island) useCameraStore.getState().flyToIsland(island.id, islandCenter(island));
}

interface LandmarkSheetProps {
  anchor: StructureAnchor;
  layout: KingdomLayout;
}

/** Shared sheet for monuments (gold voice) and memories (soft voice). */
export default function LandmarkSheet({ anchor, layout }: LandmarkSheetProps) {
  const isMonument = anchor.kind === "monument";
  const accent = isMonument ? "#b8860b" : layout.accentDark;
  const chip = isMonument ? "Achievement" : "Memory";
  const date = anchor.date ? new Date(anchor.date).toLocaleDateString() : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 14, scale: 0.94 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: "spring", stiffness: 380, damping: 28 }}
      className="glass-panel pointer-events-auto w-64 px-5 py-4 select-none"
    >
      <div className="flex items-start justify-between gap-2">
        <span
          className="rounded-full px-2 py-0.5 font-label text-[0.58rem] font-bold uppercase tracking-widest text-white"
          style={{ background: isMonument ? "#d4a017" : layout.accent }}
        >
          {chip}
        </span>
        <button
          type="button"
          aria-label="Close"
          title="Back to island (Esc)"
          className="-mr-1 -mt-1 rounded-full px-2 py-0.5 font-heading text-xs font-bold text-ink-soft hover:bg-white/60"
          onClick={() => closeAndBack(anchor.islandId)}
        >
          ✕
        </button>
      </div>

      <h2 className="mt-2 font-heading text-base font-bold leading-tight" style={{ color: accent }}>
        {anchor.label}
      </h2>
      {date && (
        <span className="font-label text-[0.6rem] font-semibold uppercase tracking-wider text-ink-soft">
          {date}
        </span>
      )}
      <p className="mt-1.5 font-body text-[0.72rem] leading-relaxed text-ink-soft">
        {anchor.description}
      </p>
    </motion.div>
  );
}
