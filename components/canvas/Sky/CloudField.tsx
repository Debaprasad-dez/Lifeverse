"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import {
  CanvasTexture,
  InstancedBufferAttribute,
  InstancedMesh,
  LinearFilter,
  Matrix4,
  PlaneGeometry,
  Quaternion,
  ShaderMaterial,
  SRGBColorSpace,
  Vector3,
} from "three";
import { mulberry32 } from "@/lib/noise";

const COUNT = 44;
const SKY_SEED = 0xc10d5;

/**
 * Procedural 2×2 cumulus atlas: overlapping radial-gradient lobes — wide
 * base, lumpy top, soft cool shading on the underbelly (reference clouds).
 */
function makeCloudAtlas(): CanvasTexture {
  const size = 1024;
  const cell = size / 2;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  const rng = mulberry32(SKY_SEED);

  for (let v = 0; v < 4; v++) {
    const ox = (v % 2) * cell;
    const oy = Math.floor(v / 2) * cell;
    const cx = ox + cell / 2;
    const baseY = oy + cell * 0.62;

    interface Lobe { x: number; y: number; r: number }
    const lobes: Lobe[] = [];
    const baseCount = 5 + Math.floor(rng() * 2);
    for (let i = 0; i < baseCount; i++) {
      const t = i / (baseCount - 1) - 0.5;
      lobes.push({
        x: cx + t * cell * 0.55,
        y: baseY - rng() * cell * 0.03,
        r: cell * (0.16 + rng() * 0.07) * (1 - Math.abs(t) * 0.55),
      });
    }
    const topCount = 4 + Math.floor(rng() * 3);
    for (let i = 0; i < topCount; i++) {
      const t = i / (topCount - 1) - 0.5;
      lobes.push({
        x: cx + t * cell * 0.4 + (rng() - 0.5) * cell * 0.08,
        y: baseY - cell * (0.14 + rng() * 0.16) * (1 - Math.abs(t) * 0.8),
        r: cell * (0.1 + rng() * 0.09),
      });
    }

    // white body — dense plateau core so cumulus read as solid masses
    for (const l of lobes) {
      const g = ctx.createRadialGradient(l.x, l.y, 0, l.x, l.y, l.r);
      g.addColorStop(0, "rgba(255,255,255,1)");
      g.addColorStop(0.45, "rgba(255,255,255,0.98)");
      g.addColorStop(0.75, "rgba(255,255,255,0.72)");
      g.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = g;
      ctx.fillRect(l.x - l.r, l.y - l.r, l.r * 2, l.r * 2);
    }
    // cool blue shade brushed along the underside (contrast vs the sea)
    ctx.globalCompositeOperation = "source-atop";
    for (const l of lobes) {
      const g = ctx.createRadialGradient(l.x, l.y + l.r * 0.6, l.r * 0.1, l.x, l.y + l.r * 0.6, l.r * 1.05);
      g.addColorStop(0, "rgba(148,178,222,0.5)");
      g.addColorStop(1, "rgba(148,178,222,0)");
      ctx.fillStyle = g;
      ctx.fillRect(ox, oy, cell, cell);
    }
    // faint warm kiss on the lit top-left (sun side)
    for (const l of lobes) {
      const g = ctx.createRadialGradient(l.x - l.r * 0.3, l.y - l.r * 0.45, 0, l.x - l.r * 0.3, l.y - l.r * 0.45, l.r * 0.9);
      g.addColorStop(0, "rgba(255,228,186,0.3)");
      g.addColorStop(1, "rgba(255,228,186,0)");
      ctx.fillStyle = g;
      ctx.fillRect(ox, oy, cell, cell);
    }
    ctx.globalCompositeOperation = "source-over";
  }

  const tex = new CanvasTexture(canvas);
  tex.colorSpace = SRGBColorSpace;
  tex.minFilter = LinearFilter;
  tex.magFilter = LinearFilter;
  return tex;
}

const vertexShader = /* glsl */ `
attribute vec2 aUvOffset;
attribute float aFade;
varying vec2 vUv;
varying float vFade;
varying float vViewZ;

void main() {
  vUv = uv * 0.5 + aUvOffset;
  vFade = aFade;
  // camera-facing impostor: instance matrix carries position+scale; the
  // quad expands in view space so a 360° orbit can never catch a flat edge
  vec4 center = modelViewMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
  float sx = length(vec3(instanceMatrix[0]));
  float sy = length(vec3(instanceMatrix[1]));
  center.xy += position.xy * vec2(sx, sy);
  vViewZ = -center.z;
  gl_Position = projectionMatrix * center;
}
`;

const fragmentShader = /* glsl */ `
uniform sampler2D uMap;
varying vec2 vUv;
varying float vFade;
varying float vViewZ;

void main() {
  vec4 tex = texture2D(uMap, vUv);
  // fade clouds that drift too close to the lens
  float nearFade = smoothstep(18.0, 55.0, vViewZ);
  float alpha = tex.a * vFade * nearFade;
  if (alpha < 0.004) discard;
  gl_FragColor = vec4(tex.rgb, alpha);
}
`;

interface CloudSpec {
  radius: number;
  thetaStart: number;
  y: number;
  width: number;
  height: number;
  speed: number;
}

export default function CloudField() {
  const meshRef = useRef<InstancedMesh>(null);

  const { geometry, material, specs, uvOffsets, fades } = useMemo(() => {
    const rng = mulberry32(SKY_SEED ^ 0x7e11);
    const specs: CloudSpec[] = [];
    const uvOffsets = new Float32Array(COUNT * 2);
    const fades = new Float32Array(COUNT);

    for (let i = 0; i < COUNT; i++) {
      // first six are hero cumulus framing the island, like screen.png
      const hero = i < 6;
      const radius = hero ? 70 + rng() * 80 : 95 + rng() * 270;
      const big = hero || rng() < 0.45;
      const width = hero
        ? 75 + rng() * 55
        : (big ? 58 : 24) + rng() * (big ? 70 : 26);
      const low = hero || rng() < 0.62;
      specs.push({
        radius,
        thetaStart: rng() * Math.PI * 2,
        y: hero ? -20 + rng() * 26 : low ? -26 + rng() * 34 : 14 + rng() * 60,
        width,
        height: width * (0.52 + rng() * 0.1),
        speed: (0.0016 + rng() * 0.0042) * (rng() < 0.5 ? 1 : 1.4),
      });
      uvOffsets[i * 2] = (Math.floor(rng() * 2) * 1) / 2;
      uvOffsets[i * 2 + 1] = (Math.floor(rng() * 2) * 1) / 2;
      fades[i] = 0.72 + rng() * 0.26;
    }

    const geometry = new PlaneGeometry(1, 1);
    geometry.setAttribute("aUvOffset", new InstancedBufferAttribute(uvOffsets, 2));
    geometry.setAttribute("aFade", new InstancedBufferAttribute(fades, 1));

    const material = new ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms: { uMap: { value: makeCloudAtlas() } },
      transparent: true,
      depthWrite: false,
      fog: false,
    });

    return { geometry, material, specs, uvOffsets, fades };
  }, []);

  const scratch = useMemo(
    () => ({
      mat: new Matrix4(),
      quat: new Quaternion(),
      pos: new Vector3(),
      scale: new Vector3(),
      order: specs.map((_, i) => i),
      positions: specs.map(() => new Vector3()),
      time: 0,
    }),
    [specs]
  );

  useFrame((state, delta) => {
    const mesh = meshRef.current;
    if (!mesh) return;
    scratch.time += delta;

    for (let i = 0; i < COUNT; i++) {
      const s = specs[i];
      const theta = s.thetaStart + scratch.time * s.speed;
      scratch.positions[i].set(
        Math.cos(theta) * s.radius,
        s.y,
        Math.sin(theta) * s.radius
      );
    }

    // far-to-near painter sort so soft alpha layers correctly through 360°
    const cam = state.camera.position;
    scratch.order.sort(
      (a, b) =>
        scratch.positions[b].distanceToSquared(cam) -
        scratch.positions[a].distanceToSquared(cam)
    );

    const uvAttr = mesh.geometry.getAttribute("aUvOffset") as InstancedBufferAttribute;
    const fadeAttr = mesh.geometry.getAttribute("aFade") as InstancedBufferAttribute;
    for (let slot = 0; slot < COUNT; slot++) {
      const i = scratch.order[slot];
      const s = specs[i];
      scratch.scale.set(s.width, s.height, 1);
      scratch.mat.compose(scratch.positions[i], scratch.quat, scratch.scale);
      mesh.setMatrixAt(slot, scratch.mat);
      uvAttr.setXY(slot, uvOffsets[i * 2], uvOffsets[i * 2 + 1]);
      fadeAttr.setX(slot, fades[i]);
    }
    mesh.instanceMatrix.needsUpdate = true;
    uvAttr.needsUpdate = true;
    fadeAttr.needsUpdate = true;
  });

  return (
    <instancedMesh
      ref={meshRef}
      args={[geometry, material, COUNT]}
      frustumCulled={false}
      renderOrder={10}
    />
  );
}
