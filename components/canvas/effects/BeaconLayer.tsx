"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import {
  AdditiveBlending,
  Color,
  CylinderGeometry,
  Group,
  MeshBasicMaterial,
} from "three";
import type { WorldState } from "@/engine/schema/world";
import type { BuiltIsland } from "@/components/canvas/WorldGraph";
import { PALETTE } from "@/lib/constants";

const beaconGeo = new CylinderGeometry(0.35, 0.9, 1, 10, 1, true);

interface BeaconLayerProps {
  state: WorldState;
  built: BuiltIsland[];
}

/**
 * Gold beacon shafts over quest-bearing kingdoms — affordance, not chrome
 * (LIFEVERSE_PLAN §7). Slow pulse; visible from world orbit.
 */
export default function BeaconLayer({ state, built }: BeaconLayerProps) {
  const groupRef = useRef<Group>(null);

  const { beacons, material } = useMemo(() => {
    const questIslands = new Set(
      state.quests.filter((q) => q.status === "active").map((q) => q.islandId)
    );
    const beacons = built
      .filter((b) => !b.island.locked && questIslands.has(b.island.id))
      .map((b) => ({
        position: [
          b.island.position[0],
          b.island.position[1] + 13,
          b.island.position[2],
        ] as [number, number, number],
      }));
    const material = new MeshBasicMaterial({
      color: new Color(PALETTE.gold).multiplyScalar(1.25),
      transparent: true,
      opacity: 0.16,
      blending: AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
      side: 2,
    });
    return { beacons, material };
  }, [state, built]);

  useFrame((s) => {
    const g = groupRef.current;
    if (!g) return;
    const t = s.clock.elapsedTime;
    material.opacity = 0.12 + Math.sin(t * 1.4) * 0.05;
    g.children.forEach((child, i) => {
      const sway = Math.sin(t * 0.8 + i * 1.7) * 0.4;
      child.scale.x = 1 + sway * 0.06;
      child.scale.z = 1 + sway * 0.06;
    });
  });

  if (beacons.length === 0) return null;

  return (
    <group ref={groupRef}>
      {beacons.map((b, i) => (
        <mesh
          key={i}
          geometry={beaconGeo}
          material={material}
          position={b.position}
          scale={[2.2, 22, 2.2]}
        />
      ))}
    </group>
  );
}
