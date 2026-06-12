/**
 * World Genesis lifecycle: conversational questions → world built → islands
 * rise from the cloud sea (per-island staggered, read by KingdomIsland in
 * useFrame — no React state per frame).
 */

import { create } from "zustand";
import { buildGenesisWorld, type GenesisAnswers } from "@/engine/genesis";
import { useWorldStore } from "@/stores/worldStore";
import { DEFAULT_FLAGS, getLocal, setLocal } from "@/lib/storage";
import { reducedMotion } from "@/lib/motion";

export type GenesisPhase = "idle" | "asking" | "rising" | "done";

export const RISE_STAGGER_S = 0.85;
export const RISE_DURATION_S = 2.6;

interface GenesisStore {
  phase: GenesisPhase;
  /** performance.now()/1000 when the rise began. */
  riseStart: number;
  begin: () => void;
  complete: (answers: GenesisAnswers) => void;
  skip: () => void;
  finishRise: () => void;
}

function markDone(): void {
  const flags = getLocal("flags", DEFAULT_FLAGS);
  setLocal("flags", { ...flags, genesisDone: true, onboarded: true });
}

export const useGenesisStore = create<GenesisStore>((set) => ({
  phase: "idle",
  riseStart: 0,

  begin: () => set({ phase: "asking" }),

  complete: (answers) => {
    const world = buildGenesisWorld(answers);
    useWorldStore.getState().replaceState(world);
    markDone();
    if (reducedMotion()) {
      set({ phase: "done" });
    } else {
      set({ phase: "rising", riseStart: performance.now() / 1000 });
    }
  },

  skip: () => {
    markDone();
    set({ phase: "done" });
  },

  finishRise: () => set({ phase: "done" }),
}));
