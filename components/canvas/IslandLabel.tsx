"use client";

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Billboard, RoundedBox, Text } from "@react-three/drei";
import { Group } from "three";
import { getToonMaterial } from "@/engine/materials/toon";
import { useUIStore } from "@/stores/uiStore";

// basePath-aware: GitHub Pages serves under /Lifeverse/
const FONT = `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/fonts/Quicksand-Bold.ttf`;

interface IslandLabelProps {
  islandId?: string;
  text: string;
  position: [number, number, number];
  plateColor: string;
  plateDark: string;
}

/**
 * Chunky extruded-look 3D label on a rounded plate, floating beside the
 * island — matches the CAREER/HEALTH/LEARNING plates in `screen.png`.
 * Billboarded: reads correctly through a full 360° orbit.
 */
export default function IslandLabel({
  islandId,
  text,
  position,
  plateColor,
  plateDark,
}: IslandLabelProps) {
  const group = useRef<Group>(null);
  const width = text.length * 0.92 + 2.0;

  useFrame((state, delta) => {
    const g = group.current;
    if (!g) return;
    // hovered or keyboard-focused islands lift their label
    const ui = useUIStore.getState();
    const lifted =
      islandId !== undefined &&
      (ui.hoveredIslandId === islandId || ui.kbFocusIslandId === islandId);
    const targetScale = lifted ? 1.14 : 1;
    const k = Math.min(1, delta * 9);
    g.scale.setScalar(g.scale.x + (targetScale - g.scale.x) * k);
    g.position.y =
      position[1] +
      Math.sin(state.clock.elapsedTime * 0.8) * 0.14 +
      (lifted ? 0.55 : 0);
  });

  return (
    <group ref={group} position={position}>
      <Billboard follow>
        <RoundedBox
          args={[width, 2.0, 0.55]}
          radius={0.3}
          smoothness={4}
          material={getToonMaterial(`label-plate-${plateColor}`, {
            color: plateColor,
            emissive: plateDark,
            emissiveIntensity: 0.25,
            rimStrength: 0.5,
          })}
        />
        {/* fake extrusion: dark copy behind the face text */}
        <Text
          font={FONT}
          fontSize={1.15}
          letterSpacing={0.06}
          color={plateDark}
          anchorX="center"
          anchorY="middle"
          position={[0.055, -0.1, 0.3]}
        >
          {text}
        </Text>
        <Text
          font={FONT}
          fontSize={1.15}
          letterSpacing={0.06}
          color="#ffffff"
          outlineWidth={0.04}
          outlineColor={plateDark}
          anchorX="center"
          anchorY="middle"
          position={[0, 0, 0.38]}
        >
          {text}
        </Text>
      </Billboard>
    </group>
  );
}
