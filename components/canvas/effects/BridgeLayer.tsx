"use client";

import { useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import {
  Color,
  DoubleSide,
  QuadraticBezierCurve3,
  ShaderMaterial,
  TubeGeometry,
  Vector3,
} from "three";
import type { Bridge, WorldState } from "@/engine/schema/world";
import { islandRadius } from "@/engine/resolver/layout";
import { PALETTE } from "@/lib/constants";

const vertexShader = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const fragmentShader = /* glsl */ `
uniform float uTime;
uniform vec3 uColor;
uniform float uStrength;
varying vec2 vUv;

void main() {
  // flowing light pulses along the ribbon
  float pulse = smoothstep(0.35, 0.0, abs(fract(vUv.x * 4.0 - uTime * 0.55) - 0.5));
  float ends = smoothstep(0.0, 0.06, vUv.x) * smoothstep(1.0, 0.94, vUv.x);
  float alpha = (0.5 + 0.4 * pulse) * ends * (0.45 + 0.55 * uStrength);
  vec3 col = mix(uColor, vec3(1.0), 0.35 + pulse * 0.5);
  gl_FragColor = vec4(col, alpha);
}
`;

interface BridgeArc {
  geometry: TubeGeometry;
  material: ShaderMaterial;
}

/** Animated light-ribbon arcs between kingdoms; glow & girth = strength. */
export default function BridgeLayer({ state }: { state: WorldState }) {
  const arcs = useMemo<BridgeArc[]>(() => {
    const islands = new Map(state.islands.map((i) => [i.id, i]));
    const out: BridgeArc[] = [];

    for (const bridge of state.bridges as Bridge[]) {
      const a = islands.get(bridge.from);
      const b = islands.get(bridge.to);
      if (!a || !b || a.locked || b.locked) continue;

      const pa = new Vector3(...a.position);
      const pb = new Vector3(...b.position);
      const dir = pb.clone().sub(pa).normalize();
      const start = pa.clone().addScaledVector(dir, islandRadius(a) * 0.8).add(new Vector3(0, 2.4, 0));
      const end = pb.clone().addScaledVector(dir, -islandRadius(b) * 0.8).add(new Vector3(0, 2.4, 0));
      const mid = start
        .clone()
        .add(end)
        .multiplyScalar(0.5)
        .add(new Vector3(0, start.distanceTo(end) * 0.16, 0));

      const curve = new QuadraticBezierCurve3(start, mid, end);
      const radius = 0.14 + 0.32 * bridge.strength;
      // finance routes run gold — visible TRADE ROUTES (diegetic analytics)
      const isTrade = bridge.from === "finance" || bridge.to === "finance";
      out.push({
        geometry: new TubeGeometry(curve, 32, radius, 6, false),
        material: new ShaderMaterial({
          vertexShader,
          fragmentShader,
          uniforms: {
            uTime: { value: 0 },
            uColor: { value: new Color(isTrade ? PALETTE.gold : PALETTE.aura) },
            uStrength: { value: bridge.strength },
          },
          // normal blending: additive ribbons vanish against the bright sky
          transparent: true,
          depthWrite: false,
          side: DoubleSide,
          fog: false,
        }),
      });
    }
    return out;
  }, [state.bridges, state.islands]);

  useFrame((_, delta) => {
    for (const arc of arcs) arc.material.uniforms.uTime.value += delta;
  });

  return (
    <group>
      {arcs.map((arc, i) => (
        <mesh key={i} geometry={arc.geometry} material={arc.material} renderOrder={6} />
      ))}
    </group>
  );
}
