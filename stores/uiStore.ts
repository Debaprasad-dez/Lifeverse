/**
 * Contextual UI state. Hard rule: at most ONE primary panel on screen;
 * every panel dies when the camera flies. Hover state lives here too so
 * canvas (rings, label lifts) and DOM (cursor) stay in sync.
 */

import { create } from "zustand";
import { emit } from "@/lib/events";

export type ActivePanel =
  | { kind: "island"; islandId: string }
  | { kind: "structure"; islandId: string; structureId: string }
  | { kind: "quests"; islandId: string }
  | { kind: "memory-form"; islandId: string }
  | { kind: "settings" }
  | null;

interface UIStore {
  activePanel: ActivePanel;
  hoveredIslandId: string | null;
  hoveredStructureId: string | null;
  /** Keyboard focus (Tab cycling) — Enter flies to it. */
  kbFocusIslandId: string | null;

  /** Pixels moved during the last pointer interaction (drag-vs-click guard). */
  lastDragDistance: number;

  openIslandPanel: (islandId: string) => void;
  openStructureSheet: (islandId: string, structureId: string) => void;
  openQuestScroll: (islandId: string) => void;
  openMemoryForm: (islandId: string) => void;
  openSettings: () => void;
  dismiss: () => void;
  setHoveredIsland: (id: string | null) => void;
  setHoveredStructure: (id: string | null) => void;
  setKbFocus: (id: string | null) => void;
  setLastDragDistance: (px: number) => void;
}

export const useUIStore = create<UIStore>((set) => ({
  activePanel: null,
  hoveredIslandId: null,
  hoveredStructureId: null,
  kbFocusIslandId: null,
  lastDragDistance: 0,

  openIslandPanel: (islandId) => {
    set({ activePanel: { kind: "island", islandId } });
    emit("island:focus", { islandId });
  },
  openStructureSheet: (islandId, structureId) =>
    set({ activePanel: { kind: "structure", islandId, structureId } }),
  openQuestScroll: (islandId) => set({ activePanel: { kind: "quests", islandId } }),
  openMemoryForm: (islandId) => set({ activePanel: { kind: "memory-form", islandId } }),
  openSettings: () => set({ activePanel: { kind: "settings" } }),
  dismiss: () => set({ activePanel: null }),
  setHoveredIsland: (id) => set({ hoveredIslandId: id }),
  setHoveredStructure: (id) => set({ hoveredStructureId: id }),
  setKbFocus: (id) => set({ kbFocusIslandId: id }),
  setLastDragDistance: (px) => set({ lastDragDistance: px }),
}));
