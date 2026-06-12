"use client";

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Billboard, RoundedBox, Text } from "@react-three/drei";
import { Group } from "three";
import { getToonMaterial } from "@/engine/materials/toon";

const FONT = "/fonts/Quicksand-Bold.ttf";

interface IslandLabelProps {
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
  text,
  position,
  plateColor,
  plateDark,
}: IslandLabelProps) {
  const group = useRef<Group>(null);
  const width = text.length * 0.92 + 2.0;

  useFrame((state) => {
    const g = group.current;
    if (g) {
      g.position.y = position[1] + Math.sin(state.clock.elapsedTime * 0.8) * 0.14;
    }
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
