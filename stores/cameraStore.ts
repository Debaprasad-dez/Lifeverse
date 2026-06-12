/**
 * Camera state machine (LIFEVERSE_PLAN.md §6):
 *
 *   ORBIT_WORLD ──double-click island──▶ FLY_TO ──▶ ORBIT_ISLAND
 *        ▲                                              │ (Phase 4: structures)
 *        └──────────────── Esc / fly out ◀── INSPECT ◀──┘
 *
 * The store holds only coarse state + imperative intents. All per-frame
 * spherical math lives in CameraRig refs — never React state.
 */

import { create } from "zustand";

export type CameraMode = "ORBIT_WORLD" | "FLY_TO" | "ORBIT_ISLAND" | "INSPECT";

export interface FlightRequest {
  kind: "island" | "world";
  islandId: string | null;
  target: [number, number, number];
  /** Monotonic id so CameraRig can detect new requests. */
  seq: number;
}

interface CameraStore {
  mode: CameraMode;
  focusedIslandId: string | null;
  flight: FlightRequest | null;
  setMode: (mode: CameraMode) => void;
  flyToIsland: (islandId: string, target: [number, number, number]) => void;
  flyToWorld: () => void;
}

let seq = 0;

export const useCameraStore = create<CameraStore>((set) => ({
  mode: "ORBIT_WORLD",
  focusedIslandId: null,
  flight: null,

  setMode: (mode) => set({ mode }),

  flyToIsland: (islandId, target) =>
    set({
      mode: "FLY_TO",
      focusedIslandId: islandId,
      flight: { kind: "island", islandId, target, seq: ++seq },
    }),

  flyToWorld: () =>
    set({
      mode: "FLY_TO",
      focusedIslandId: null,
      flight: { kind: "world", islandId: null, target: [0, 2, 0], seq: ++seq },
    }),
}));
