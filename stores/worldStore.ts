/**
 * WorldState lives here. Boot order: IndexedDB latest snapshot → zod parse
 * → fixture fallback. Every applyDelta autosaves a debounced snapshot
 * (the time-travel substrate) and emits engine events for choreography.
 */

import { create } from "zustand";
import { buildFixture } from "@/engine/schema/fixture";
import { applyWorldDelta } from "@/engine/schema/apply";
import { tryParseWorldState, type WorldDelta, type WorldState } from "@/engine/schema/world";
import { loadLatestSnapshot, pruneSnapshots, saveSnapshot } from "@/lib/db";
import { setLocal } from "@/lib/storage";
import { emit } from "@/lib/events";

const AUTOSAVE_DEBOUNCE_MS = 1500;

export type Era = "past" | "present" | "simulated";

interface WorldStore {
  state: WorldState | null;
  hydrated: boolean;
  /** Where the booted world came from (genesis gating reads this). */
  bootSource: "snapshot" | "fixture" | null;
  /**
   * Read-only temporal overlay. When set, the world RENDERS this instead of
   * `state` (time-travel to a past snapshot, or a future projection). The
   * live present in `state` is untouched; check-ins are blocked meanwhile.
   */
  preview: WorldState | null;
  era: Era;
  boot: () => Promise<void>;
  applyDeltas: (deltas: WorldDelta[]) => void;
  /** Full replacement (genesis, import). Validates and snapshots. */
  replaceState: (next: WorldState) => void;
  /** Enter a read-only era view (past snapshot / future sim). */
  setPreview: (next: WorldState, era: Exclude<Era, "present">) => void;
  /** Return to the live present. */
  clearPreview: () => void;
}

let saveTimer: ReturnType<typeof setTimeout> | null = null;

function scheduleSnapshot(get: () => WorldState | null): void {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    const state = get();
    if (!state) return;
    void saveSnapshot(state)
      .then((id) => setLocal("lastSnapshotId", id))
      .catch(() => {
        // Persistence is best-effort; the world stays playable in memory.
      });
  }, AUTOSAVE_DEBOUNCE_MS);
}

export const useWorldStore = create<WorldStore>((set, get) => ({
  state: null,
  hydrated: false,
  bootSource: null,
  preview: null,
  era: "present",

  boot: async () => {
    if (get().hydrated) return;

    // Fixture renders frame one; the snapshot (if any) swaps in when read.
    const fixture = buildFixture();
    set({ state: fixture, hydrated: true });

    if (typeof window !== "undefined" && !window.location.search.includes("fresh=1")) {
      try {
        const snapshot = await loadLatestSnapshot();
        const restored = snapshot ? tryParseWorldState(snapshot.state) : null;
        if (restored) {
          set({ state: restored, bootSource: "snapshot" });
          emit("world:booted", { state: restored, source: "snapshot" });
          void pruneSnapshots().catch(() => {});
          return;
        }
      } catch {
        // first run / private mode — fixture already on screen
      }
    }

    set({ bootSource: "fixture" });
    emit("world:booted", { state: fixture, source: "fixture" });
    void pruneSnapshots().catch(() => {});
  },

  applyDeltas: (deltas) => {
    const current = get().state;
    if (!current || deltas.length === 0) return;
    let next = current;
    for (const delta of deltas) next = applyWorldDelta(next, delta);
    set({ state: next });
    for (const delta of deltas) emit("delta:applied", { delta });
    scheduleSnapshot(() => get().state);
  },

  replaceState: (next) => {
    const parsed = tryParseWorldState(next);
    if (!parsed) return;
    // a genesis/import replaces the present and ends any time-travel
    set({ state: parsed, hydrated: true, preview: null, era: "present" });
    scheduleSnapshot(() => get().state);
  },

  setPreview: (next, era) => {
    const parsed = tryParseWorldState(next);
    if (!parsed) return;
    set({ preview: parsed, era });
  },

  clearPreview: () => set({ preview: null, era: "present" }),
}));

/** The state to RENDER: the temporal overlay if any, else the live present. */
export function displayState(s: WorldStore): WorldState | null {
  return s.preview ?? s.state;
}
