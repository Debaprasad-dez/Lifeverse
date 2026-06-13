"use client";

import { motion } from "framer-motion";
import { useWorldStore } from "@/stores/worldStore";
import { useUIStore } from "@/stores/uiStore";
import { collectibleVisual } from "@/engine/collectibles";
import { KINGDOM_LAYOUTS } from "@/engine/resolver/layout";
import { CORE_KINGDOM_IDS, type CoreKingdomId } from "@/engine/schema/world";

const KIND_LABEL: Record<string, string> = {
  creature: "Creature",
  artifact: "Artifact",
  relic: "Relic",
  hidden_isle: "Hidden Isle",
};

function hintFor(islandId?: string): string {
  if (!islandId) return "Somewhere in the open sky";
  if (CORE_KINGDOM_IDS.includes(islandId as CoreKingdomId)) {
    return `Near ${KINGDOM_LAYOUTS[islandId as CoreKingdomId].label}`;
  }
  return "In a distant kingdom";
}

const EMPTY: never[] = [];

export default function CollectionPanel() {
  const collectibles = useWorldStore((s) => s.state?.collectibles ?? EMPTY);
  const found = collectibles.filter((c) => c.found).length;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 12, scale: 0.97 }}
      transition={{ type: "spring", stiffness: 360, damping: 30 }}
      className="glass-panel pointer-events-auto absolute bottom-16 left-5 w-80 max-w-[88vw] px-5 py-4 select-none"
    >
      <div className="flex items-center justify-between">
        <h2 className="font-heading text-sm font-bold text-ink">Collection</h2>
        <div className="flex items-center gap-2">
          <span className="font-heading text-xs font-bold text-aura-deep">
            {found}/{collectibles.length}
          </span>
          <button
            type="button"
            aria-label="Close collection"
            className="rounded-full px-2 py-0.5 font-heading text-xs font-bold text-ink-soft hover:bg-white/60"
            onClick={() => useUIStore.getState().dismiss()}
          >
            ✕
          </button>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2">
        {collectibles.map((c) => {
          const v = collectibleVisual(c.kind);
          return (
            <div
              key={c.id}
              className="flex flex-col items-center rounded-xl bg-white/55 px-2 py-2.5 text-center"
              title={c.found ? c.name : hintFor(c.islandId)}
            >
              <span
                className="mb-1 block h-9 w-9 rounded-full"
                style={
                  c.found
                    ? {
                        background: `radial-gradient(circle at 34% 30%, #fff, ${v.glow} 55%, ${v.body})`,
                        boxShadow: `0 0 10px ${v.glow}aa`,
                      }
                    : { background: "rgba(40,46,66,0.16)" }
                }
              />
              <span
                className={`font-label text-[0.6rem] font-bold leading-tight ${
                  c.found ? "text-ink" : "text-ink-soft/70"
                }`}
              >
                {c.found ? c.name : "???"}
              </span>
              <span className="mt-0.5 font-body text-[0.52rem] uppercase tracking-wider text-ink-soft/60">
                {c.found ? KIND_LABEL[c.kind] : hintFor(c.islandId)}
              </span>
            </div>
          );
        })}
      </div>

      {found < collectibles.length && (
        <p className="mt-3 font-body text-[0.62rem] leading-snug text-ink-soft/80">
          Explore your kingdoms — collectibles drift nearby, glowing. Click one
          to add it here.
        </p>
      )}
    </motion.div>
  );
}
