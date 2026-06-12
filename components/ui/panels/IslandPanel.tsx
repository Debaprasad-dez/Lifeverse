"use client";

import { motion } from "framer-motion";
import type { Island } from "@/engine/schema/world";
import type { KingdomLayout } from "@/engine/resolver/layout";
import { islandCenter } from "@/engine/resolver/layout";
import { useCameraStore } from "@/stores/cameraStore";
import { useWorldStore } from "@/stores/worldStore";
import Tube from "./Tube";

interface IslandPanelProps {
  island: Island;
  layout: KingdomLayout;
}

/** Contextual kingdom panel — anchored beside the island, never a page. */
export default function IslandPanel({ island, layout }: IslandPanelProps) {
  const mode = useCameraStore((s) => s.mode);
  const questCount =
    useWorldStore(
      (s) =>
        s.state?.quests.filter((q) => q.islandId === island.id && q.status === "active")
          .length
    ) ?? 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 14, scale: 0.94 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 8, scale: 0.96 }}
      transition={{ type: "spring", stiffness: 380, damping: 28 }}
      className="glass-panel pointer-events-auto w-60 px-5 py-4 select-none"
    >
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-heading text-base font-bold tracking-wide" style={{ color: layout.accentDark }}>
          {layout.label}
        </h2>
        <span
          className="rounded-full px-2 py-0.5 font-label text-[0.6rem] font-bold text-white"
          style={{ background: layout.accent }}
        >
          Lv {island.level} · S{island.evolutionStage}
        </span>
      </div>

      <div className="mt-3 space-y-2.5">
        <Tube label="Aura Vitality" value={island.vitality} color={layout.accent} />
        <Tube label="Ecosystem" value={island.ecosystem.flora} color="#56a84b" />
        <Tube label="Radiance" value={island.lightingIntensity} color="#fdd34d" />
      </div>

      <div className="mt-3.5 flex items-center justify-between">
        <span className="font-body text-[0.68rem] text-ink-soft">
          {questCount > 0 ? `${questCount} active quest${questCount > 1 ? "s" : ""}` : "No active quests"}
        </span>
        {mode === "ORBIT_WORLD" && (
          <button
            type="button"
            className="pill-btn"
            onClick={() =>
              useCameraStore.getState().flyToIsland(island.id, islandCenter(island))
            }
          >
            Enter
          </button>
        )}
      </div>
    </motion.div>
  );
}
