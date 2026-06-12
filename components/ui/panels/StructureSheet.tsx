"use client";

import { motion } from "framer-motion";
import type { StructureAnchor } from "@/engine/resolver/resolve";
import type { KingdomLayout } from "@/engine/resolver/layout";
import Tube from "./Tube";

const STATE_LABEL: Record<string, string> = {
  seed: "Seedling",
  rising: "Rising",
  complete: "Complete",
  glowing: "Glowing",
  dormant: "Sleeping",
  ruined: "Weathered",
};

interface StructureSheetProps {
  anchor: StructureAnchor;
  layout: KingdomLayout;
}

/** Detail sheet for a selected structure — meaning first, numbers second. */
export default function StructureSheet({ anchor, layout }: StructureSheetProps) {
  const typeName = anchor.type
    .split("_")
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(" ");

  return (
    <motion.div
      initial={{ opacity: 0, y: 14, scale: 0.94 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 8, scale: 0.96 }}
      transition={{ type: "spring", stiffness: 380, damping: 28 }}
      className="glass-panel pointer-events-auto w-64 px-5 py-4 select-none"
    >
      <span
        className="font-label text-[0.58rem] font-bold uppercase tracking-widest"
        style={{ color: layout.accentDark }}
      >
        {typeName}
      </span>
      <h2 className="mt-0.5 font-heading text-base font-bold leading-tight text-ink">
        {anchor.label}
      </h2>
      <p className="mt-1.5 font-body text-[0.72rem] leading-relaxed text-ink-soft">
        {anchor.description}
      </p>

      <div className="mt-3">
        <Tube label="Growth" value={anchor.growth} color={layout.accent} />
      </div>

      <div className="mt-3 flex items-center justify-between">
        <span
          className="rounded-full px-2 py-0.5 font-label text-[0.6rem] font-bold text-white"
          style={{ background: layout.accent }}
        >
          {STATE_LABEL[anchor.state] ?? anchor.state}
        </span>
        <button type="button" className="pill-btn secondary" disabled title="Quests arrive in a later phase">
          Upgrade soon
        </button>
      </div>
    </motion.div>
  );
}
