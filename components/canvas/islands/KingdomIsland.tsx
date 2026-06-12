"use client";

import { useRef } from "react";
import { Detailed } from "@react-three/drei";
import { useFrame, type ThreeEvent } from "@react-three/fiber";
import { Group } from "three";
import { clamp } from "@/lib/noise";
import { RISE_DURATION_S, RISE_STAGGER_S, useGenesisStore } from "@/stores/genesisStore";
import type { Island } from "@/engine/schema/world";
import type { IslandGeometry } from "@/engine/generation/island";
import { islandCenter, type KingdomLayout } from "@/engine/resolver/layout";
import { getToonMaterial } from "@/engine/materials/toon";
import { useCameraStore } from "@/stores/cameraStore";
import { useUIStore } from "@/stores/uiStore";
import IslandLabel from "@/components/canvas/IslandLabel";

interface KingdomIslandProps {
  island: Island;
  geom: IslandGeometry;
  /** Lower-detail variants for the LOD chain (full → mid → silhouette). */
  geomMid?: IslandGeometry;
  geomLow?: IslandGeometry;
  layout?: KingdomLayout;
  /** Stagger order for the genesis rise. */
  riseIndex?: number;
}

/**
 * One kingdom: positioned island mesh (3-tier LOD) + label + fly-to.
 * Flora/structures/waterfalls render in WorldGraph's merged pools.
 */
export default function KingdomIsland({
  island,
  geom,
  geomMid,
  geomLow,
  layout,
  riseIndex = 0,
}: KingdomIslandProps) {
  const riseGroup = useRef<Group>(null);

  // genesis: islands wait under the cloud sea, then surge up one by one
  useFrame(() => {
    const g = riseGroup.current;
    if (!g) return;
    const { phase, riseStart } = useGenesisStore.getState();
    const baseY = island.position[1];
    if (phase === "asking") {
      g.position.y = baseY - 75;
      return;
    }
    if (phase === "rising") {
      const delay = riseIndex * RISE_STAGGER_S * 0.6;
      const t = performance.now() / 1000 - riseStart - delay;
      const k = clamp(t / RISE_DURATION_S, 0, 1);
      // easeOutBack-lite: a touch of overshoot as the island settles
      const e = 1 + 1.35 * Math.pow(k - 1, 3) + 0.35 * Math.pow(k - 1, 2);
      g.position.y = baseY - 75 * (1 - e);
      return;
    }
    g.position.y = baseY;
  });
  const material = island.locked
    ? getToonMaterial("locked-island", {
        color: "#75879e",
        rimColor: "#aebfd4",
        rimStrength: 0.2,
      })
    : getToonMaterial("island", { vertexColors: true });

  const genesisPhase = useGenesisStore((s) => s.phase);
  const dressed = genesisPhase === "idle" || genesisPhase === "done";

  const onDoubleClick = (e: ThreeEvent<MouseEvent>): void => {
    e.stopPropagation();
    useCameraStore.getState().flyToIsland(island.id, islandCenter(island));
  };

  const onPointerOver = (e: ThreeEvent<PointerEvent>): void => {
    if (island.locked) return;
    e.stopPropagation();
    useUIStore.getState().setHoveredIsland(island.id);
    document.body.style.cursor = "pointer";
  };
  const onPointerOut = (): void => {
    if (useUIStore.getState().hoveredIslandId === island.id) {
      useUIStore.getState().setHoveredIsland(null);
      document.body.style.cursor = "";
    }
  };

  // label floats off the rim that faces the world center, so it reads
  // from the default world orbit (degenerate at the origin → fixed angle)
  let labelPos: [number, number, number] | null = null;
  if (layout && !island.locked) {
    const [px, , pz] = island.position;
    const theta = Math.hypot(px, pz) < 5 ? 0.45 : Math.atan2(-pz, -px);
    const edge = geom.edgePointAt(theta);
    labelPos = [
      island.position[0] + edge.x + Math.cos(theta) * 3.0,
      island.position[1] + edge.y - 2.4,
      island.position[2] + edge.z + Math.sin(theta) * 3.0,
    ];
  }

  return (
    <group>
      <group
        ref={riseGroup}
        position={island.position}
        onDoubleClick={onDoubleClick}
        onPointerOver={onPointerOver}
        onPointerOut={onPointerOut}
      >
        {geomMid && geomLow ? (
          <Detailed distances={[0, 110, 190]}>
            <mesh
              geometry={geom.geometry}
              material={material}
              castShadow={!island.locked}
              receiveShadow={!island.locked}
            />
            <mesh geometry={geomMid.geometry} material={material} castShadow={!island.locked} />
            <mesh geometry={geomLow.geometry} material={material} />
          </Detailed>
        ) : (
          <mesh
            geometry={geom.geometry}
            material={material}
            castShadow={!island.locked}
            receiveShadow={!island.locked}
          />
        )}
      </group>
      {layout && labelPos && dressed && (
        <IslandLabel
          islandId={island.id}
          text={layout.label}
          position={labelPos}
          plateColor={layout.accent}
          plateDark={layout.accentDark}
        />
      )}
    </group>
  );
}
