"use client";

import { PALETTE, SUN_DIRECTION, WORLD } from "@/lib/constants";

/**
 * Golden-hour rig: warm directional key (sun, ~35° elevation), cool sky
 * hemisphere fill with warm cloud-bounce from below — that bounce is what
 * keeps the sculpted underside readable when orbiting beneath the island.
 */
export default function Lighting() {
  const sunPos = SUN_DIRECTION.clone().multiplyScalar(190);
  const b = WORLD.islandRadius * 2.4;

  return (
    <>
      <directionalLight
        position={sunPos}
        color={PALETTE.sunWarm}
        intensity={3.5}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-left={-b}
        shadow-camera-right={b}
        shadow-camera-top={b}
        shadow-camera-bottom={-b}
        shadow-camera-near={100}
        shadow-camera-far={300}
        shadow-bias={-0.0002}
        shadow-normalBias={0.6}
      />
      <hemisphereLight
        args={["#cfe9ff", "#ffe3bd", 0.9]}
      />
      <ambientLight color="#bdd9f2" intensity={0.14} />
    </>
  );
}
