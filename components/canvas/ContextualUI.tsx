"use client";

import { useEffect } from "react";
import { Html } from "@react-three/drei";
import { useUIStore } from "@/stores/uiStore";
import { useCameraStore } from "@/stores/cameraStore";
import type { StructureAnchor } from "@/engine/resolver/resolve";
import type { BuiltIsland } from "@/components/canvas/WorldGraph";
import { islandCenter, KINGDOM_LAYOUTS } from "@/engine/resolver/layout";
import { useWorldStore } from "@/stores/worldStore";
import type { CoreKingdomId } from "@/engine/schema/world";
import { playPop, playWhoosh } from "@/lib/sound";
import { reducedMotion } from "@/lib/motion";
import IslandPanel from "@/components/ui/panels/IslandPanel";
import StructureSheet from "@/components/ui/panels/StructureSheet";

interface ContextualUIProps {
  built: BuiltIsland[];
  anchors: StructureAnchor[];
}

/**
 * The contextual layer: panels are anchored to 3D points via <Html>, track
 * the camera every frame, and die the moment it flies. One panel max —
 * enforced by uiStore's single activePanel slot.
 */
export default function ContextualUI({ built, anchors }: ContextualUIProps) {
  const panel = useUIStore((s) => s.activePanel);

  // camera ↔ panel lifecycle
  useEffect(() => {
    const unsub = useCameraStore.subscribe((s, prev) => {
      if (s.mode === prev.mode) return;
      const ui = useUIStore.getState();

      if (s.mode === "FLY_TO") {
        ui.dismiss();
        if (!reducedMotion()) playWhoosh();
        return;
      }
      if (s.mode === "ORBIT_ISLAND" && prev.mode === "FLY_TO" && s.focusedIslandId) {
        ui.openIslandPanel(s.focusedIslandId);
        return;
      }
      if (s.mode === "INSPECT" && s.focusedIslandId && s.inspectedStructureId) {
        ui.openStructureSheet(s.focusedIslandId, s.inspectedStructureId);
      }
    });
    return unsub;
  }, []);

  if (!panel || panel.kind === "settings") return null;

  if (panel.kind === "island") {
    const b = built.find((x) => x.island.id === panel.islandId);
    if (!b || !b.layout) return null;
    const [x, y, z] = b.island.position;
    return (
      <Html
        position={[x, y + (b.layout.capHeight ?? 2) + 8.5, z]}
        center
        zIndexRange={[30, 10]}
        style={{ pointerEvents: "none" }}
      >
        <IslandPanel island={b.island} layout={b.layout} />
      </Html>
    );
  }

  const anchor = anchors.find((a) => a.structureId === panel.structureId);
  if (!anchor) return null;
  const layout = KINGDOM_LAYOUTS[anchor.islandId as CoreKingdomId];
  if (!layout) return null;
  return (
    <Html
      position={[
        anchor.position[0],
        anchor.position[1] + anchor.height + 1.6,
        anchor.position[2],
      ]}
      center
      zIndexRange={[30, 10]}
      style={{ pointerEvents: "none" }}
    >
      <StructureSheet anchor={anchor} layout={layout} />
    </Html>
  );
}

/** Shared dismiss used by empty-sky clicks (WorldCanvas onPointerMissed). */
export function dismissContextual(): void {
  const ui = useUIStore.getState();
  const cam = useCameraStore.getState();
  if (ui.activePanel) {
    ui.dismiss();
    playPop();
  }
  if (cam.mode === "INSPECT" && cam.focusedIslandId) {
    // return to the previous camera state — island orbit
    const island = useWorldStore
      .getState()
      .state?.islands.find((i) => i.id === cam.focusedIslandId);
    if (island) cam.flyToIsland(island.id, islandCenter(island));
  }
}
