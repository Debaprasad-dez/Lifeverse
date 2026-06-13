"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useCompanionStore, type CompanionMood } from "@/stores/companionStore";
import { islandCenter, KINGDOM_LAYOUTS } from "@/engine/resolver/layout";
import type { CoreKingdomId } from "@/engine/schema/world";
import { useCameraStore } from "@/stores/cameraStore";
import { useWorldStore } from "@/stores/worldStore";

const MOOD_BADGE: Record<CompanionMood, { label: string; color: string }> = {
  celebrate: { label: "Celebrating", color: "#ffb84d" },
  encourage: { label: "Cheering you on", color: "#4fc3f7" },
  advise: { label: "Thinking with you", color: "#b39ddb" },
  neutral: { label: "Here for you", color: "#9fd9c0" },
};

export default function CompanionPanel() {
  const open = useCompanionStore((s) => s.open);
  const turns = useCompanionStore((s) => s.turns);
  const thinking = useCompanionStore((s) => s.thinking);
  const mood = useCompanionStore((s) => s.mood);
  const [draft, setDraft] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [turns, thinking, open]);

  const submit = (): void => {
    const text = draft.trim();
    if (!text) return;
    setDraft("");
    void useCompanionStore.getState().send(text);
  };

  const flyTo = (id: CoreKingdomId): void => {
    const island = useWorldStore.getState().state?.islands.find((i) => i.id === id);
    if (island) useCameraStore.getState().flyToIsland(island.id, islandCenter(island));
  };

  const badge = MOOD_BADGE[mood];

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 16, scale: 0.97 }}
          transition={{ type: "spring", stiffness: 360, damping: 30 }}
          className="glass-panel pointer-events-auto absolute bottom-24 right-5 flex w-80 max-w-[88vw] flex-col px-4 pb-3 pt-3.5 select-none"
          style={{ maxHeight: "min(70vh, 520px)" }}
        >
          <div className="flex items-center justify-between pb-2">
            <div className="flex items-center gap-2">
              <span
                className="block h-6 w-6 rounded-full"
                style={{
                  background: `radial-gradient(circle at 32% 30%, #fff, ${badge.color} 55%, #0a4a5e)`,
                  boxShadow: `0 0 12px ${badge.color}aa`,
                }}
              />
              <div className="leading-tight">
                <span className="block font-heading text-sm font-bold text-ink">Aria</span>
                <span
                  className="font-label text-[0.55rem] font-bold uppercase tracking-wider"
                  style={{ color: badge.color }}
                >
                  {badge.label}
                </span>
              </div>
            </div>
            <button
              type="button"
              aria-label="Close companion"
              className="rounded-full px-2 py-0.5 font-heading text-xs font-bold text-ink-soft hover:bg-white/60"
              onClick={() => useCompanionStore.getState().setOpen(false)}
            >
              ✕
            </button>
          </div>

          <div ref={scrollRef} className="flex-1 space-y-2.5 overflow-y-auto pr-1">
            {turns.map((t) => (
              <div key={t.id} className={t.role === "user" ? "flex justify-end" : ""}>
                <div
                  className={`max-w-[85%] rounded-2xl px-3 py-2 font-body text-[0.74rem] leading-relaxed ${
                    t.role === "user"
                      ? "bg-aura/85 text-white"
                      : "bg-white/65 text-ink"
                  }`}
                  style={{ whiteSpace: "pre-line" }}
                >
                  {t.text}
                  {t.quest && (
                    <div className="mt-2 rounded-xl bg-white/70 p-2.5">
                      <span
                        className="font-label text-[0.55rem] font-bold uppercase tracking-wider"
                        style={{ color: KINGDOM_LAYOUTS[t.quest.islandId].accentDark }}
                      >
                        {KINGDOM_LAYOUTS[t.quest.islandId].label} quest
                      </span>
                      <p className="mt-0.5 font-heading text-[0.74rem] font-bold text-ink">
                        {t.quest.title}
                      </p>
                      <p className="font-body text-[0.66rem] text-ink-soft">{t.quest.narrative}</p>
                      <div className="mt-2 flex gap-1.5">
                        <button
                          type="button"
                          className="pill-btn"
                          onClick={() => {
                            useCompanionStore.getState().acceptQuest(t.id);
                            flyTo(t.quest!.islandId);
                          }}
                        >
                          Accept
                        </button>
                        <button
                          type="button"
                          className="pill-btn secondary"
                          onClick={() => useCompanionStore.getState().dismissQuest(t.id)}
                        >
                          Maybe later
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
            {thinking && (
              <div className="flex items-center gap-1.5 px-1 py-1">
                {[0, 1, 2].map((i) => (
                  <motion.span
                    key={i}
                    className="block h-1.5 w-1.5 rounded-full bg-ink-soft"
                    animate={{ opacity: [0.3, 1, 0.3] }}
                    transition={{ duration: 1.1, repeat: Infinity, delay: i * 0.18 }}
                  />
                ))}
              </div>
            )}
          </div>

          <div className="mt-2.5 flex gap-1.5">
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submit()}
              placeholder="Tell Aria what you did…"
              className="min-w-0 flex-1 rounded-full border border-white/70 bg-white/70 px-3.5 py-1.5 font-body text-[0.74rem] text-ink outline-none placeholder:text-ink-soft/50"
            />
            <button type="button" className="pill-btn" onClick={submit} disabled={thinking}>
              Send
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
