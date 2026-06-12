"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import {
  AdditiveBlending,
  Color,
  CylinderGeometry,
  Group,
  MeshBasicMaterial,
  RingGeometry,
} from "three";
import type { StructureAnchor } from "@/engine/resolver/resolve";
import { useUIStore } from "@/stores/uiStore";
import { PALETTE } from "@/lib/constants";

const ringGeo = new RingGeometry(1.0, 1.22, 36);
const beamGeo = new CylinderGeometry(0.05, 0.09, 1, 8, 1, true);

/**
 * Affordance, not chrome: the hovered structure gets a gold ground ring
 * and a soft light shaft. One instance, repositioned — never per-structure
 * DOM or meshes.
 */
export default function HoverMarker({ anchors }: { anchors: StructureAnchor[] }) {
  const group = useRef<Group>(null);

  const { ringMat, beamMat } = useMemo(
    () => ({
      ringMat: new MeshBasicMaterial({
        color: new Color(PALETTE.gold).multiplyScalar(1.5),
        transparent: true,
        opacity: 0.85,
        blending: AdditiveBlending,
        depthWrite: false,
        toneMapped: false,
        side: 2,
      }),
      beamMat: new MeshBasicMaterial({
        color: new Color(PALETTE.gold).multiplyScalar(1.1),
        transparent: true,
        opacity: 0.22,
        blending: AdditiveBlending,
        depthWrite: false,
        toneMapped: false,
        side: 2,
      }),
    }),
    []
  );

  useFrame((s) => {
    const g = group.current;
    if (!g) return;
    const hoveredId = useUIStore.getState().hoveredStructureId;
    const anchor = hoveredId
      ? anchors.find((a) => a.structureId === hoveredId)
      : undefined;
    if (!anchor) {
      g.visible = false;
      return;
    }
    g.visible = true;
    const t = s.clock.elapsedTime;
    const pulse = 1 + Math.sin(t * 3.2) * 0.06;
    g.position.set(anchor.position[0], anchor.position[1] + 0.12, anchor.position[2]);
    g.scale.setScalar(anchor.radius * pulse);
    ringMat.opacity = 0.65 + Math.sin(t * 3.2) * 0.2;
  });

  return (
    <group ref={group} visible={false}>
      <mesh geometry={ringGeo} material={ringMat} rotation={[-Math.PI / 2, 0, 0]} />
      <mesh
        geometry={beamGeo}
        material={beamMat}
        position={[0, 1.6, 0]}
        scale={[1, 3.2, 1]}
      />
    </group>
  );
}
