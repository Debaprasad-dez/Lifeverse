"use client";

import { Suspense, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { CAMERA } from "@/lib/constants";
import DebugPerf from "@/components/canvas/DebugPerf";
import SkyDome from "@/components/canvas/Sky/SkyDome";
import CloudField from "@/components/canvas/Sky/CloudField";
import CloudSea from "@/components/canvas/Sky/CloudSea";
import Lighting from "@/components/canvas/Lighting";
import PostFX from "@/components/canvas/PostFX";
import WorldGraph from "@/components/canvas/WorldGraph";
import CameraRig from "@/components/canvas/camera/CameraRig";

const initialPosition: [number, number, number] = (() => {
  const { radius, azimuth, polar } = CAMERA.initial;
  const t = CAMERA.world.target;
  const sinP = Math.sin(polar);
  return [
    t.x + radius * sinP * Math.sin(azimuth),
    t.y + radius * Math.cos(polar),
    t.z + radius * sinP * Math.cos(azimuth),
  ];
})();

export default function WorldCanvas() {
  // ?debug=1 → r3f-perf budget HUD (dev tool, not product chrome)
  const [debug] = useState(
    () => typeof window !== "undefined" && window.location.search.includes("debug=1")
  );

  return (
    <Canvas
      flat
      shadows
      dpr={[1, 2]}
      camera={{
        fov: CAMERA.fov,
        near: CAMERA.near,
        far: CAMERA.far,
        position: initialPosition,
      }}
      gl={{ antialias: true, powerPreference: "high-performance" }}
      className="!fixed !inset-0"
    >
      <Suspense fallback={null}>
        <SkyDome />
        <Lighting />
        <CloudField />
        <CloudSea />
        <WorldGraph />
        <CameraRig />
        <PostFX />
        {debug && <DebugPerf />}
      </Suspense>
    </Canvas>
  );
}
