"use client";

import { motion } from "framer-motion";
import type { CoreKingdomId, Island } from "@/engine/schema/world";
import type { KingdomLayout } from "@/engine/resolver/layout";
import { islandCenter } from "@/engine/resolver/layout";
import { LIFE_EVENTS, type LifeEventKind } from "@/engine/evolution/rules";
import { useCameraStore } from "@/stores/cameraStore";
import { useWorldStore } from "@/stores/worldStore";
import { useLifeStore } from "@/stores/lifeStore";
import { useUIStore } from "@/stores/uiStore";
import Tube from "./Tube";

/** Quick check-ins per kingdom — logging IS the game loop. */
const KINGDOM_ACTIONS: Record<CoreKingdomId, LifeEventKind[]> = {
  career: ["ship", "skill_practice"],
  health: ["exercise", "meditate"],
  learning: ["read", "study"],
  finance: ["save"],
  relationships: ["outreach"],
  creativity: ["create"],
  adventure: ["explore"],
};

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

      {mode !== "ORBIT_WORLD" && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {(KINGDOM_ACTIONS[island.id as CoreKingdomId] ?? []).map((kind) => (
            <button
              key={kind}
              type="button"
              className="pill-btn secondary"
              onClick={() => useLifeStore.getState().logEvent(kind)}
            >
              + {LIFE_EVENTS[kind].label}
            </button>
          ))}
          <button
            type="button"
            className="pill-btn secondary"
            title="Plant a memory landmark"
            onClick={() => useUIStore.getState().openMemoryForm(island.id)}
          >
            🌸 Memory
          </button>
        </div>
      )}

      <div className="mt-3.5 flex items-center justify-between">
        <button
          type="button"
          className="font-body text-[0.68rem] text-ink-soft underline-offset-2 hover:underline disabled:no-underline"
          title="Open quest scroll"
          onClick={() => useUIStore.getState().openQuestScroll(island.id)}
        >
          {questCount > 0
            ? `${questCount} active quest${questCount > 1 ? "s" : ""} →`
            : "Quests →"}
        </button>
        {mode === "ORBIT_WORLD" ? (
          <button
            type="button"
            className="pill-btn"
            onClick={() =>
              useCameraStore.getState().flyToIsland(island.id, islandCenter(island))
            }
          >
            Enter
          </button>
        ) : (
          <button
            type="button"
            className="pill-btn secondary"
            title="Back to world view (Esc)"
            onClick={() => useCameraStore.getState().flyToWorld()}
          >
            ⌂ World
          </button>
        )}
      </div>
    </motion.div>
  );
}
