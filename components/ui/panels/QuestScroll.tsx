"use client";

import { motion } from "framer-motion";
import type { Island, Quest } from "@/engine/schema/world";
import type { KingdomLayout } from "@/engine/resolver/layout";
import { useWorldStore } from "@/stores/worldStore";
import { useUIStore } from "@/stores/uiStore";

const REWARD_LABEL: Record<Quest["reward"]["type"], string> = {
  structure: "New structure",
  flora: "Flora bloom",
  monument: "Monument",
  bridge: "Stronger bridge",
  creature: "Creature",
  relic: "Relic",
};

interface QuestScrollProps {
  island: Island;
  layout: KingdomLayout;
}

/** The kingdom's quest log — an unrolled scroll, never a page. */
export default function QuestScroll({ island, layout }: QuestScrollProps) {
  const quests = useWorldStore(
    (s) => s.state?.quests.filter((q) => q.islandId === island.id) ?? []
  );
  const active = quests.filter((q) => q.status === "active");
  const complete = quests.filter((q) => q.status === "complete");

  return (
    <motion.div
      initial={{ opacity: 0, y: 14, scale: 0.94 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: "spring", stiffness: 380, damping: 28 }}
      className="glass-panel pointer-events-auto w-72 px-5 py-4 select-none"
    >
      <div className="flex items-center justify-between">
        <h2 className="font-heading text-sm font-bold" style={{ color: layout.accentDark }}>
          {layout.label} — Quests
        </h2>
        <button
          type="button"
          aria-label="Back to kingdom panel"
          className="rounded-full px-2 py-0.5 font-heading text-xs font-bold text-ink-soft hover:bg-white/60"
          onClick={() => useUIStore.getState().openIslandPanel(island.id)}
        >
          ✕
        </button>
      </div>

      <div className="mt-3 max-h-64 space-y-3 overflow-y-auto pr-1">
        {active.length === 0 && (
          <p className="font-body text-[0.7rem] text-ink-soft">
            No active quests — check in to begin one.
          </p>
        )}
        {active.map((q) => (
          <div key={q.id} className="rounded-2xl bg-white/55 px-3.5 py-3">
            <h3 className="font-heading text-[0.8rem] font-bold text-ink">{q.title}</h3>
            <p className="mt-0.5 font-body text-[0.66rem] leading-snug text-ink-soft">
              {q.narrative}
            </p>
            <ul className="mt-2 space-y-1">
              {q.steps.map((step, i) => (
                <li key={i} className="flex items-center gap-2">
                  <span
                    className={`flex h-3.5 w-3.5 items-center justify-center rounded-full text-[0.55rem] font-bold ${
                      step.done ? "bg-[#3faf6e] text-white" : "border border-ink/25 text-transparent"
                    }`}
                  >
                    ✓
                  </span>
                  <span
                    className={`font-body text-[0.68rem] ${
                      step.done ? "text-ink-soft line-through" : "text-ink"
                    }`}
                  >
                    {step.label}
                  </span>
                </li>
              ))}
            </ul>
            <div className="mt-2 flex items-center justify-between">
              <span className="font-label text-[0.58rem] font-bold uppercase tracking-wider text-ink-soft">
                Reward: {REWARD_LABEL[q.reward.type]}
              </span>
              <span
                className="rounded-full px-1.5 py-0.5 font-label text-[0.56rem] font-bold text-white"
                style={{ background: layout.accent }}
              >
                {q.xp} XP
              </span>
            </div>
          </div>
        ))}

        {complete.length > 0 && (
          <div>
            <span className="font-label text-[0.6rem] font-bold uppercase tracking-wider text-ink-soft">
              Completed
            </span>
            <ul className="mt-1 space-y-0.5">
              {complete.map((q) => (
                <li key={q.id} className="font-body text-[0.66rem] text-ink-soft">
                  ✓ {q.title}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <p className="mt-3 font-body text-[0.62rem] leading-snug text-ink-soft/80">
        Check-ins on this kingdom advance its quest automatically.
      </p>
    </motion.div>
  );
}
