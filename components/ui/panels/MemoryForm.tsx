"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import type { Island, MemoryLandmark } from "@/engine/schema/world";
import type { KingdomLayout } from "@/engine/resolver/layout";
import { useWorldStore } from "@/stores/worldStore";
import { useUIStore } from "@/stores/uiStore";
import { useLifeStore } from "@/stores/lifeStore";

const KINDS: { value: MemoryLandmark["kind"]; label: string }[] = [
  { value: "tree", label: "🌸 Tree" },
  { value: "statue", label: "🗿 Statue" },
  { value: "crystal", label: "💎 Crystal" },
  { value: "mural", label: "🖼 Mural" },
  { value: "fountain", label: "⛲ Fountain" },
];

const inputCls =
  "w-full rounded-2xl border border-white/70 bg-white/70 px-3.5 py-1.5 font-body text-[0.74rem] text-ink outline-none placeholder:text-ink-soft/50";

interface MemoryFormProps {
  island: Island;
  layout: KingdomLayout;
}

/** Plant a memory: a real moment becomes a permanent landmark. */
export default function MemoryForm({ island, layout }: MemoryFormProps) {
  const [title, setTitle] = useState("");
  const [story, setStory] = useState("");
  const [kind, setKind] = useState<MemoryLandmark["kind"]>("tree");

  const plant = (): void => {
    if (!title.trim()) return;
    useWorldStore.getState().applyDeltas([
      {
        type: "memory_added",
        memory: {
          id: `mem-${Date.now().toString(36)}`,
          islandId: island.id,
          date: new Date().toISOString(),
          kind,
          title: title.trim(),
          story: story.trim() || "A moment worth keeping.",
          photoIds: [],
        },
      },
    ]);
    useUIStore.getState().openIslandPanel(island.id);
    useLifeStore.setState({ toast: `Memory planted: ${title.trim()}` });
    setTimeout(() => useLifeStore.setState({ toast: null }), 3000);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 14, scale: 0.94 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: "spring", stiffness: 380, damping: 28 }}
      className="glass-panel pointer-events-auto w-72 px-5 py-4 select-none"
    >
      <div className="flex items-center justify-between">
        <h2 className="font-heading text-sm font-bold" style={{ color: layout.accentDark }}>
          Plant a memory
        </h2>
        <button
          type="button"
          aria-label="Cancel"
          className="rounded-full px-2 py-0.5 font-heading text-xs font-bold text-ink-soft hover:bg-white/60"
          onClick={() => useUIStore.getState().openIslandPanel(island.id)}
        >
          ✕
        </button>
      </div>

      <div className="mt-3 space-y-2.5">
        <input
          autoFocus
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="What happened?"
          maxLength={48}
          className={inputCls}
        />
        <textarea
          value={story}
          onChange={(e) => setStory(e.target.value)}
          placeholder="The story, in a line or two…"
          maxLength={240}
          rows={3}
          className={`${inputCls} resize-none`}
        />
        <div className="flex flex-wrap gap-1.5">
          {KINDS.map((k) => (
            <button
              key={k.value}
              type="button"
              onClick={() => setKind(k.value)}
              className={`rounded-full px-2.5 py-1 font-label text-[0.62rem] font-bold transition ${
                kind === k.value
                  ? "text-white"
                  : "bg-white/60 text-ink-soft hover:bg-white/80"
              }`}
              style={kind === k.value ? { background: layout.accent } : undefined}
            >
              {k.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-3.5 flex justify-end">
        <button type="button" className="pill-btn" onClick={plant} disabled={!title.trim()}>
          Plant it
        </button>
      </div>
    </motion.div>
  );
}
