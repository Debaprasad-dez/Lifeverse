"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  Color,
  DoubleSide,
  Group,
  MeshBasicMaterial,
  PlaneGeometry,
  ShaderMaterial,
  Vector3,
} from "three";
import { GLSL_SIMPLEX_2D } from "@/lib/glsl";
import { PALETTE, WORLD } from "@/lib/constants";

const SEGMENTS = 26;

const vertexShader = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const fragmentShader = /* glsl */ `
uniform float uTime;
uniform vec3 uTint;
uniform float uRainbow;
varying vec2 vUv;

${GLSL_SIMPLEX_2D}

void main() {
  // scrolling foam streaks
  float streak = snoise(vec2(vUv.x * 5.5, vUv.y * 6.5 - uTime * 1.7));
  float streak2 = snoise(vec2(vUv.x * 11.0 + 4.0, vUv.y * 13.0 - uTime * 2.6));
  float foam = smoothstep(0.05, 0.75, streak * 0.7 + streak2 * 0.3);

  vec3 tint = uTint;
  if (uRainbow > 0.5) {
    // creativity paint-river: drifting cosine rainbow
    tint = 0.62 + 0.38 * cos(6.28318 * (vUv.y * 0.85 + vUv.x * 0.2 - uTime * 0.07 + vec3(0.0, 0.33, 0.67)));
  }
  vec3 col = mix(vec3(1.0), tint, 0.25 + vUv.y * 0.55);
  col += foam * 0.25;

  float edge = smoothstep(0.0, 0.18, vUv.x) * smoothstep(1.0, 0.82, vUv.x);
  float head = smoothstep(0.0, 0.07, vUv.y);
  float tail = 1.0 - smoothstep(0.82, 1.0, vUv.y);
  float alpha = (0.5 + foam * 0.45) * edge * head * (0.35 + 0.65 * tail);

  gl_FragColor = vec4(col, alpha);
}
`;

function makeSplashTexture(): CanvasTexture {
  const c = document.createElement("canvas");
  c.width = 128;
  c.height = 128;
  const ctx = c.getContext("2d")!;
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, "rgba(255,255,255,0.9)");
  g.addColorStop(0.5, "rgba(235,248,255,0.45)");
  g.addColorStop(1, "rgba(235,248,255,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  return new CanvasTexture(c);
}

export type WaterfallStyle = "water" | "gold" | "paint";

const STYLE_TINTS: Record<WaterfallStyle, string> = {
  water: PALETTE.waterfall,
  gold: "#ffd166", // finance: the golden river
  paint: "#bfe9ff", // overridden by the rainbow palette in-shader
};

interface WaterfallProps {
  lip: Vector3;
  dir: Vector3;
  style?: WaterfallStyle;
}

/** Ribbon of falling water from a rim notch down into the cloud sea. */
export default function Waterfall({ lip, dir, style = "water" }: WaterfallProps) {
  const splashGroup = useRef<Group>(null);
  const mistRef = useRef<Group>(null);

  const { geometry, material, splashMaterial, splashGeometry, basePos } = useMemo(() => {
    const drop = lip.y - (WORLD.cloudSeaY + 3.2);
    const side = new Vector3(-dir.z, 0, dir.x);
    const positions = new Float32Array((SEGMENTS + 1) * 2 * 3);
    const uvs = new Float32Array((SEGMENTS + 1) * 2 * 2);
    const indices: number[] = [];
    const p = new Vector3();

    for (let i = 0; i <= SEGMENTS; i++) {
      const t = i / SEGMENTS;
      // projectile arc: constant outward velocity, gravity wins below
      const out = 0.4 + 4.6 * t;
      const down = drop * t * t;
      p.copy(lip).addScaledVector(dir, out);
      p.y = lip.y - 0.25 - down;
      const w = (1.5 + 2.1 * t) / 2;
      for (let s = 0; s < 2; s++) {
        const sign = s === 0 ? -1 : 1;
        const vi = (i * 2 + s) * 3;
        positions[vi] = p.x + side.x * w * sign;
        positions[vi + 1] = p.y;
        positions[vi + 2] = p.z + side.z * w * sign;
        uvs[(i * 2 + s) * 2] = s;
        uvs[(i * 2 + s) * 2 + 1] = t;
      }
      if (i < SEGMENTS) {
        const a = i * 2;
        indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
      }
    }

    const geometry = new BufferGeometry();
    geometry.setAttribute("position", new BufferAttribute(positions, 3));
    geometry.setAttribute("uv", new BufferAttribute(uvs, 2));
    geometry.setIndex(indices);

    const material = new ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms: {
        uTime: { value: 0 },
        uTint: { value: new Color(STYLE_TINTS[style]) },
        uRainbow: { value: style === "paint" ? 1 : 0 },
      },
      transparent: true,
      depthWrite: false,
      side: DoubleSide,
      fog: false,
    });

    const splashMaterial = new MeshBasicMaterial({
      map: makeSplashTexture(),
      color: style === "water" ? "#ffffff" : STYLE_TINTS[style],
      transparent: true,
      depthWrite: false,
      opacity: 0.55,
      blending: AdditiveBlending,
      fog: false,
    });
    const splashGeometry = new PlaneGeometry(1, 1);

    const basePos = lip
      .clone()
      .addScaledVector(dir, 5.0)
      .setY(WORLD.cloudSeaY + 4.0);

    return { geometry, material, splashMaterial, splashGeometry, basePos };
  }, [lip, dir, style]);

  useFrame((state, delta) => {
    material.uniforms.uTime.value += delta;
    const t = state.clock.elapsedTime;
    const g = splashGroup.current;
    if (g) {
      g.children.forEach((child, i) => {
        const pulse = 1 + 0.18 * Math.sin(t * (1.6 + i * 0.5) + i * 2.1);
        child.scale.setScalar((3.2 + i * 1.3) * pulse);
        child.quaternion.copy(state.camera.quaternion);
      });
    }
    const m = mistRef.current;
    if (m) {
      m.children.forEach((child, i) => {
        const pulse = 1 + 0.25 * Math.sin(t * (0.9 + i * 0.4) + i * 2.8);
        child.scale.setScalar((1.6 + i * 0.8) * pulse);
        child.position.y = 0.4 + i * 0.35 + Math.sin(t * 0.7 + i) * 0.2;
        child.quaternion.copy(state.camera.quaternion);
      });
    }
  });

  return (
    <group>
      <mesh geometry={geometry} material={material} frustumCulled={false} renderOrder={5} />
      {/* mist curling at the lip where the water breaks over the rim */}
      <group ref={mistRef} position={[lip.x + dir.x * 1.2, lip.y, lip.z + dir.z * 1.2]}>
        {[0, 1].map((i) => (
          <mesh
            key={i}
            geometry={splashGeometry}
            material={splashMaterial}
            position={[(i - 0.5) * 1.1, 0.4, 0]}
          />
        ))}
      </group>
      <group ref={splashGroup} position={basePos}>
        {[0, 1, 2].map((i) => (
          <mesh
            key={i}
            geometry={splashGeometry}
            material={splashMaterial}
            position={[(i - 1) * 1.4, i * 0.5, (i % 2) * 1.2 - 0.6]}
          />
        ))}
      </group>
    </group>
  );
}
