"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import {
  Color,
  InstancedMesh,
  Matrix4,
  PlaneGeometry,
  Quaternion,
  Vector3,
} from "three";
import { MeshBasicMaterial } from "three";
import type { Season } from "@/engine/schema/world";
import { seasonParams } from "@/engine/season";
import { mulberry32 } from "@/lib/noise";

// volume the flakes fall through — a generous box around the archipelago
const SPAN = 320;
const TOP = 90;
const BOTTOM = -40;

const geo = new PlaneGeometry(1, 1);
const tmpM = new Matrix4();
const tmpQ = new Quaternion();
const tmpV = new Vector3();
const tmpS = new Vector3();
const tmpC = new Color();

interface Flake {
  x: number;
  z: number;
  y: number;
  speed: number;
  drift: number;
  phase: number;
  spin: number;
  size: number;
}

export default function SeasonLayer({ season }: { season: Season }) {
  const ref = useRef<InstancedMesh>(null);

  const { flakes, material } = useMemo(() => {
    const p = seasonParams(season);
    const rng = mulberry32(0x5ea50 ^ season.length);
    const flakes: Flake[] = Array.from({ length: p.count }, () => ({
      x: (rng() - 0.5) * SPAN,
      z: (rng() - 0.5) * SPAN,
      y: BOTTOM + rng() * (TOP - BOTTOM),
      speed: p.fallSpeed * (0.7 + rng() * 0.6),
      drift: p.drift * (0.5 + rng()),
      phase: rng() * Math.PI * 2,
      spin: (rng() - 0.5) * 2,
      size: p.size * (0.7 + rng() * 0.7),
    }));
    const material = new MeshBasicMaterial({
      transparent: true,
      depthWrite: false,
      opacity: season === "summer" ? 0.7 : 0.92,
      toneMapped: false,
      side: 2,
    });
    return { flakes, material };
  }, [season]);

  // assign per-instance colors once
  const colors = useMemo(() => {
    const p = seasonParams(season);
    const rng = mulberry32(0xc01a ^ season.length);
    return flakes.map(() => p.colors[Math.floor(rng() * p.colors.length)]);
  }, [flakes, season]);

  useFrame((s, delta) => {
    const mesh = ref.current;
    if (!mesh) return;
    const t = s.clock.elapsedTime;
    const dt = Math.min(delta, 0.05);
    for (let i = 0; i < flakes.length; i++) {
      const f = flakes[i];
      f.y -= f.speed * dt * 6;
      if (f.y < BOTTOM) {
        f.y = TOP;
        f.x = (Math.random() - 0.5) * SPAN;
        f.z = (Math.random() - 0.5) * SPAN;
      }
      const sway = Math.sin(t * 0.6 + f.phase) * f.drift;
      tmpV.set(f.x + sway, f.y, f.z + Math.cos(t * 0.5 + f.phase) * f.drift * 0.6);
      tmpQ.setFromAxisAngle(
        tmpS.set(0.3, 1, 0.2).normalize(),
        t * f.spin + f.phase
      );
      tmpM.compose(tmpV, tmpQ, tmpS.setScalar(f.size));
      mesh.setMatrixAt(i, tmpM);
      if (mesh.instanceColor === null) mesh.setColorAt(i, tmpC.set(colors[i]));
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  });

  return (
    <instancedMesh
      ref={(m) => {
        ref.current = m;
        if (m) {
          for (let i = 0; i < flakes.length; i++) m.setColorAt(i, tmpC.set(colors[i]));
          if (m.instanceColor) m.instanceColor.needsUpdate = true;
        }
      }}
      args={[geo, material, flakes.length]}
      frustumCulled={false}
      renderOrder={8}
    />
  );
}
