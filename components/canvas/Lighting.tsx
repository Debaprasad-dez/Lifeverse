"use client";

import { PALETTE, SUN_DIRECTION } from "@/lib/constants";

/**
 * Golden-hour rig: warm directional key (sun, ~35° elevation), cool sky
 * hemisphere fill with warm cloud-bounce from below — that bounce is what
 * keeps the sculpted underside readable when orbiting beneath the island.
 * NOTE: drei <SoftShadows/> (PCSS) is incompatible with our customized
 * toon materials (onBeforeCompile rim light) — N8AO + contact blobs carry
 * the soft-shadow feel instead.
 */
export default function Lighting() {
  const sunPos = SUN_DIRECTION.clone().multiplyScalar(190);
  // one map across the whole core archipelago (focus-following comes in P10)
  const b = 95;

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
        shadow-camera-near={60}
        shadow-camera-far={340}
        shadow-bias={-0.0002}
        shadow-normalBias={0.6}
      />
      {/* slightly stronger cool sky / warm ground split = filmic bounce */}
      <hemisphereLight args={["#cde8ff", "#ffdfb4", 1.0]} />
      <ambientLight color="#bdd9f2" intensity={0.1} />
    </>
  );
}
