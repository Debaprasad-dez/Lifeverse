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
import QuestScroll from "@/components/ui/panels/QuestScroll";
import MemoryForm from "@/components/ui/panels/MemoryForm";
import LandmarkSheet from "@/components/ui/panels/LandmarkSheet";

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

  return (
    <>
      <PanelLayer built={built} anchors={anchors} />
      <HoverTips built={built} anchors={anchors} />
    </>
  );
}

/** Micro-affordances: what hovering means, said at the hover point. */
function HoverTips({ built, anchors }: ContextualUIProps) {
  const hoveredIslandId = useUIStore((s) => s.hoveredIslandId);
  const hoveredStructureId = useUIStore((s) => s.hoveredStructureId);
  const mode = useCameraStore((s) => s.mode);
  const inspected = useCameraStore((s) => s.inspectedStructureId);

  // island tip only from world orbit — once focused, the panel takes over
  if (mode === "ORBIT_WORLD" && hoveredIslandId) {
    const b = built.find((x) => x.island.id === hoveredIslandId);
    if (b && !b.island.locked && b.layout) {
      const [x, y, z] = b.island.position;
      return (
        <Html
          position={[x, y + (b.layout.capHeight ?? 2) + 5.6, z]}
          center
          zIndexRange={[20, 5]}
          style={{ pointerEvents: "none" }}
        >
          <div className="glass whitespace-nowrap px-2.5 py-1">
            <span className="font-label text-[0.62rem] font-bold tracking-wide text-ink-soft">
              Double-click to enter
            </span>
          </div>
        </Html>
      );
    }
  }

  if (hoveredStructureId && hoveredStructureId !== inspected) {
    const a = anchors.find((x) => x.structureId === hoveredStructureId);
    if (a) {
      return (
        <Html
          position={[a.position[0], a.position[1] + a.height + 1.1, a.position[2]]}
          center
          zIndexRange={[20, 5]}
          style={{ pointerEvents: "none" }}
        >
          <div className="glass whitespace-nowrap px-2.5 py-1 text-center">
            <span className="font-heading text-[0.7rem] font-bold text-ink">{a.label}</span>
            <span className="ml-1.5 font-label text-[0.58rem] font-semibold uppercase tracking-wider text-ink-soft">
              click to inspect
            </span>
          </div>
        </Html>
      );
    }
  }

  return null;
}

function PanelLayer({ built, anchors }: ContextualUIProps) {
  const panel = useUIStore((s) => s.activePanel);

  if (!panel || panel.kind === "settings") return null;

  // island-top anchored panels (island, quests, memory form)
  if (panel.kind === "island" || panel.kind === "quests" || panel.kind === "memory-form") {
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
        {panel.kind === "island" && <IslandPanel island={b.island} layout={b.layout} />}
        {panel.kind === "quests" && <QuestScroll island={b.island} layout={b.layout} />}
        {panel.kind === "memory-form" && <MemoryForm island={b.island} layout={b.layout} />}
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
      {anchor.kind === "structure" ? (
        <StructureSheet anchor={anchor} layout={layout} />
      ) : (
        <LandmarkSheet anchor={anchor} layout={layout} />
      )}
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
