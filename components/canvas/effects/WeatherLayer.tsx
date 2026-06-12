"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import {
  Color,
  InstancedBufferAttribute,
  InstancedMesh,
  Matrix4,
  PlaneGeometry,
  Quaternion,
  ShaderMaterial,
  Vector3,
} from "three";
import type { WorldState } from "@/engine/schema/world";
import { islandAnalytics } from "@/engine/resolver/analytics";
import { makeCloudAtlas } from "@/components/canvas/Sky/CloudField";
import { mulberry32, seedFrom } from "@/lib/noise";
import type { BuiltIsland } from "@/components/canvas/WorldGraph";

const vertexShader = /* glsl */ `
attribute vec2 aUvOffset;
attribute float aFade;
attribute vec3 aTint;
varying vec2 vUv;
varying float vFade;
varying vec3 vTint;

void main() {
  vUv = uv * 0.5 + aUvOffset;
  vFade = aFade;
  vTint = aTint;
  vec4 center = modelViewMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
  float sx = length(vec3(instanceMatrix[0]));
  float sy = length(vec3(instanceMatrix[1]));
  center.xy += position.xy * vec2(sx, sy);
  gl_Position = projectionMatrix * center;
}
`;

const fragmentShader = /* glsl */ `
uniform sampler2D uMap;
varying vec2 vUv;
varying float vFade;
varying vec3 vTint;

void main() {
  vec4 tex = texture2D(uMap, vUv);
  float alpha = tex.a * vFade;
  if (alpha < 0.004) discard;
  gl_FragColor = vec4(tex.rgb * vTint, alpha);
}
`;

interface SpriteSpec {
  islandPos: [number, number, number];
  orbitR: number;
  y: number;
  phase: number;
  speed: number;
  width: number;
}

interface WeatherLayerProps {
  state: WorldState;
  built: BuiltIsland[];
}

/**
 * LOCAL weather — ecosystem state rendered as fog/storm sprites parked
 * over individual islands (low vitality = brooding clouds over THAT
 * kingdom only). Locked kingdoms sit permanently shrouded.
 */
export default function WeatherLayer({ state, built }: WeatherLayerProps) {
  const meshRef = useRef<InstancedMesh>(null);

  const { specs, geometry, material } = useMemo(() => {
    const rng = mulberry32(seedFrom(state.worldSeed, "weather"));
    const specs: SpriteSpec[] = [];
    const fades: number[] = [];
    const tints: number[] = [];
    const uvs: number[] = [];
    const tint = new Color();

    for (const b of built) {
      const a = islandAnalytics(b.island);
      if (a.weather.amount < 0.15) continue;
      const count = b.island.locked ? 3 : Math.round(2 + a.weather.amount * 3);
      const radius = b.island.locked ? 8 : 11;
      for (let i = 0; i < count; i++) {
        specs.push({
          islandPos: b.island.position,
          orbitR: radius * (0.35 + rng() * 0.55),
          y: 7.5 + rng() * 4,
          phase: rng() * Math.PI * 2,
          speed: 0.02 + rng() * 0.03,
          width: 9 + rng() * 8,
        });
        fades.push(0.4 + a.weather.amount * 0.5);
        tint.setScalar(1 - a.weather.darkness).lerp(new Color("#8c9cb4"), a.weather.darkness);
        tints.push(tint.r, tint.g, tint.b);
        uvs.push((Math.floor(rng() * 2) * 1) / 2, (Math.floor(rng() * 2) * 1) / 2);
      }
    }

    const geometry = new PlaneGeometry(1, 1);
    geometry.setAttribute("aUvOffset", new InstancedBufferAttribute(new Float32Array(uvs), 2));
    geometry.setAttribute("aFade", new InstancedBufferAttribute(new Float32Array(fades), 1));
    geometry.setAttribute("aTint", new InstancedBufferAttribute(new Float32Array(tints), 3));

    const material = new ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms: { uMap: { value: makeCloudAtlas() } },
      transparent: true,
      depthWrite: false,
      fog: false,
    });

    return { specs, geometry, material };
  }, [state, built]);

  const scratch = useMemo(
    () => ({ m: new Matrix4(), q: new Quaternion(), v: new Vector3(), s: new Vector3() }),
    []
  );

  useFrame((s) => {
    const mesh = meshRef.current;
    if (!mesh) return;
    const t = s.clock.elapsedTime;
    specs.forEach((sp, i) => {
      const a = sp.phase + t * sp.speed;
      scratch.v.set(
        sp.islandPos[0] + Math.cos(a) * sp.orbitR,
        sp.islandPos[1] + sp.y + Math.sin(t * 0.5 + sp.phase) * 0.5,
        sp.islandPos[2] + Math.sin(a) * sp.orbitR
      );
      scratch.s.set(sp.width, sp.width * 0.55, 1);
      scratch.m.compose(scratch.v, scratch.q, scratch.s);
      mesh.setMatrixAt(i, scratch.m);
    });
    mesh.instanceMatrix.needsUpdate = true;
  });

  if (specs.length === 0) return null;

  return (
    <instancedMesh
      ref={meshRef}
      args={[geometry, material, specs.length]}
      frustumCulled={false}
      renderOrder={9}
    />
  );
}
