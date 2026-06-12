"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import {
  CanvasTexture,
  Color,
  DoubleSide,
  InstancedMesh,
  Matrix4,
  PlaneGeometry,
  Quaternion,
  ShaderMaterial,
  Vector3,
} from "three";

export interface GrassInstance {
  position: [number, number, number];
  rotY: number;
  scale: number;
  color: string;
}

/** Procedural blade-cluster silhouette — 5 tapered blades, alpha card. */
function makeBladeTexture(): CanvasTexture {
  const c = document.createElement("canvas");
  c.width = 128;
  c.height = 128;
  const ctx = c.getContext("2d")!;
  ctx.clearRect(0, 0, 128, 128);
  const blades = [
    { x: 24, lean: -14, h: 78, w: 9 },
    { x: 46, lean: -5, h: 108, w: 11 },
    { x: 64, lean: 2, h: 120, w: 12 },
    { x: 84, lean: 8, h: 100, w: 10 },
    { x: 104, lean: 16, h: 72, w: 8 },
  ];
  for (const b of blades) {
    const grad = ctx.createLinearGradient(0, 128, 0, 128 - b.h);
    grad.addColorStop(0, "rgba(255,255,255,1)");
    grad.addColorStop(1, "rgba(255,255,255,0.92)");
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(b.x - b.w / 2, 128);
    ctx.quadraticCurveTo(b.x - b.w / 2 + b.lean * 0.4, 128 - b.h * 0.6, b.x + b.lean, 128 - b.h);
    ctx.quadraticCurveTo(b.x + b.w / 2 + b.lean * 0.4, 128 - b.h * 0.6, b.x + b.w / 2, 128);
    ctx.closePath();
    ctx.fill();
  }
  const tex = new CanvasTexture(c);
  tex.anisotropy = 4;
  return tex;
}

const vertexShader = /* glsl */ `
uniform float uTime;
varying vec2 vUv;
varying vec3 vColor;

void main() {
  vUv = uv;
  vColor = instanceColor;
  vec4 world = instanceMatrix * vec4(position, 1.0);

  // wind: large slow gust + small flutter, bending from the root up
  float bend = pow(uv.y, 1.8);
  float gust = sin(uTime * 1.25 + world.x * 0.32 + world.z * 0.21);
  float flutter = sin(uTime * 4.2 + world.x * 1.9 + world.z * 1.4) * 0.3;
  world.x += (gust + flutter) * bend * 0.22;
  world.z += (gust * 0.6 - flutter) * bend * 0.16;

  gl_Position = projectionMatrix * modelViewMatrix * world;
}
`;

const fragmentShader = /* glsl */ `
uniform sampler2D uMap;
uniform vec3 uSunTint;
varying vec2 vUv;
varying vec3 vColor;

void main() {
  float a = texture2D(uMap, vUv).a;
  if (a < 0.5) discard;
  // root → tip lightening + warm sun kiss at the very tips
  vec3 col = vColor * (0.72 + vUv.y * 0.42);
  col += uSunTint * pow(vUv.y, 3.0) * 0.18;
  gl_FragColor = vec4(col, 1.0);
}
`;

const tmpM = new Matrix4();
const tmpQ = new Quaternion();
const tmpV = new Vector3();
const tmpS = new Vector3();
const tmpC = new Color();
const Y_AXIS = new Vector3(0, 1, 0);

interface GrassFieldProps {
  instances: GrassInstance[];
}

/**
 * Wind-blown meadow: alpha-card blade clusters, two crossed planes per
 * tuft (2 instanced draws total), vertex-shader sway. Replaces the old
 * cone tufts with something that actually moves like grass.
 */
export default function GrassField({ instances }: GrassFieldProps) {
  const refA = useRef<InstancedMesh>(null);
  const refB = useRef<InstancedMesh>(null);

  const { geometry, material } = useMemo(() => {
    const geometry = new PlaneGeometry(1.5, 1.0);
    geometry.translate(0, 0.5, 0); // pivot at the root
    const material = new ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms: {
        uTime: { value: 0 },
        uMap: { value: makeBladeTexture() },
        uSunTint: { value: new Color("#ffd9a0") },
      },
      side: DoubleSide,
      transparent: false,
    });
    return { geometry, material };
  }, []);

  useEffect(() => {
    const place = (mesh: InstancedMesh | null, extraYaw: number): void => {
      if (!mesh) return;
      instances.forEach((g, i) => {
        tmpQ.setFromAxisAngle(Y_AXIS, g.rotY + extraYaw);
        tmpM.compose(
          tmpV.set(...g.position),
          tmpQ,
          tmpS.setScalar(g.scale)
        );
        mesh.setMatrixAt(i, tmpM);
        mesh.setColorAt(i, tmpC.set(g.color));
      });
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      mesh.computeBoundingSphere();
    };
    place(refA.current, 0);
    place(refB.current, Math.PI / 2);
  }, [instances]);

  useFrame((s) => {
    material.uniforms.uTime.value = s.clock.elapsedTime;
  });

  if (instances.length === 0) return null;

  return (
    <>
      <instancedMesh ref={refA} args={[geometry, material, instances.length]} />
      <instancedMesh ref={refB} args={[geometry, material, instances.length]} />
    </>
  );
}
