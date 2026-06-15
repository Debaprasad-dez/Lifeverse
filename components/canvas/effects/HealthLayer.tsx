"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { MeshReflectorMaterial } from "@react-three/drei";
import {
  CircleGeometry,
  Color,
  ConeGeometry,
  CylinderGeometry,
  DoubleSide,
  Euler,
  ExtrudeGeometry,
  Group,
  IcosahedronGeometry,
  InstancedMesh,
  Matrix4,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PlaneGeometry,
  Quaternion,
  Shape,
  ShaderMaterial,
  SphereGeometry,
  TorusGeometry,
  Vector3,
} from "three";
import type { BuiltIsland } from "@/components/canvas/WorldGraph";
import { CORE_KINGDOM_IDS, type CoreKingdomId } from "@/engine/schema/world";
import { islandRadius } from "@/engine/resolver/layout";
import { getToonMaterial } from "@/engine/materials/toon";
import { mulberry32 } from "@/lib/noise";
import { particleScale } from "@/lib/quality";
import { buildZenForest } from "@/engine/generation/structures/zenforest";
import { healthStreak, useLifeStore } from "@/stores/lifeStore";
import InstancedPool, { type PoolInstance } from "@/components/canvas/InstancedPool";

const cylGeo = new CylinderGeometry(1, 1, 1, 8);
const blobGeo = new IcosahedronGeometry(1, 1);
const leafGeo = new IcosahedronGeometry(1, 2); // higher detail for foliage clumps

// floating 3D heart (extruded heart shape, point-down) + ECG monitor
const _heartShape = (() => {
  const s = new Shape();
  s.moveTo(0.25, 0.25);
  s.bezierCurveTo(0.25, 0.25, 0.2, 0, 0, 0);
  s.bezierCurveTo(-0.3, 0, -0.3, 0.35, -0.3, 0.35);
  s.bezierCurveTo(-0.3, 0.55, -0.1, 0.77, 0.25, 0.95);
  s.bezierCurveTo(0.6, 0.77, 0.8, 0.55, 0.8, 0.35);
  s.bezierCurveTo(0.8, 0.35, 0.8, 0, 0.5, 0);
  s.bezierCurveTo(0.35, 0, 0.25, 0.25, 0.25, 0.25);
  return s;
})();
const heartGeo = new ExtrudeGeometry(_heartShape, { depth: 0.45, bevelEnabled: true, bevelThickness: 0.1, bevelSize: 0.09, bevelSegments: 4, steps: 1 });
heartGeo.center();
heartGeo.rotateZ(Math.PI); // cleft up, point down
const heartMat = new MeshStandardMaterial({ color: "#d8243c", metalness: 0.12, roughness: 0.3, emissive: "#5a0a14", emissiveIntensity: 0.45 });
const ecgGeo = new PlaneGeometry(1, 1);
const ecgFrag = /* glsl */ `
uniform float uTime; varying vec2 vUv;
float ecg(float x){
  float p = fract(x);
  float v = 0.06*exp(-pow((p-0.15)/0.03,2.0));
  v -= 0.05*exp(-pow((p-0.32)/0.012,2.0));
  v += 0.5*exp(-pow((p-0.36)/0.01,2.0));
  v -= 0.14*exp(-pow((p-0.41)/0.014,2.0));
  v += 0.12*exp(-pow((p-0.62)/0.05,2.0));
  return v;
}
void main(){
  float x = vUv.x*2.0 - uTime*0.3;
  float d = abs((vUv.y-0.42) - ecg(x));
  float glow = smoothstep(0.07,0.0,d);
  float core = smoothstep(0.018,0.0,d);
  float a = (glow*0.5 + core) * smoothstep(0.0,0.05,vUv.x) * smoothstep(1.0,0.95,vUv.x);
  gl_FragColor = vec4(vec3(1.0,0.3,0.4)*(glow*0.5+core*1.2), a);
}
`;
const ecgVert = /* glsl */ `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);} `;
const coneGeo = new ConeGeometry(1, 1, 8);
const sphGeo = new SphereGeometry(1, 10, 8);
const planeGeo = new PlaneGeometry(1, 1);
const torusGeo = new TorusGeometry(1, 0.04, 6, 28);
const lilyGeo = new CircleGeometry(1, 16);
const fogGeo = new SphereGeometry(1, 24, 16);

const glowVineMat = new MeshBasicMaterial({ color: new Color("#3fe6ff").multiplyScalar(1.4), toneMapped: false });
const glowPodMat = new MeshBasicMaterial({ color: new Color("#7ef0ff").multiplyScalar(1.5), toneMapped: false });
const lotusCoreMat = new MeshBasicMaterial({ color: new Color("#ffe6a0").multiplyScalar(1.4), toneMapped: false });
const mushGlowMat = new MeshBasicMaterial({ color: new Color("#9bf0d8").multiplyScalar(1.3), toneMapped: false });
const fireflyMat = new MeshBasicMaterial({ color: new Color("#ffd98a").multiplyScalar(1.7), toneMapped: false });
const butterflyMat = new MeshBasicMaterial({ color: new Color("#b8ffe0").multiplyScalar(1.6), toneMapped: false, transparent: true, side: 2, opacity: 0.95 });
const steamMat = new MeshBasicMaterial({ color: "#eaf5f0", transparent: true, opacity: 0.32, depthWrite: false });
const rainMat = new MeshBasicMaterial({ color: "#bcd0d6", transparent: true, opacity: 0.5, depthWrite: false });
const rippleMat = new MeshBasicMaterial({ color: new Color("#5fe6ff").multiplyScalar(1.2), toneMapped: false, transparent: true, opacity: 0.5, depthWrite: false });
const fogMat = new MeshBasicMaterial({ color: "#8b9aa0", transparent: true, opacity: 0, depthWrite: false, side: DoubleSide });
const _euler = new Euler();
function eulerSet(x: number, y: number, z: number): Euler {
  return _euler.set(x, y, z);
}
const lotusPetalMat = new MeshStandardMaterial({ color: "#ffc2d6", emissive: "#ff9ecf", emissiveIntensity: 0.4, transparent: true, opacity: 0.9, roughness: 0.5 });

const tmpM = new Matrix4();
const tmpQ = new Quaternion();
const tmpV = new Vector3();
const tmpS = new Vector3();
const UP = new Vector3(0, 1, 0);

interface Petal { base: Vector3; rot: [number, number, number]; s: number; li: number }
interface Bug { lotus: Vector3; phase: number; speed: number; rr: number; yr: number }

function HealthForest({ island, geom }: BuiltIsland) {
  const steamRef = useRef<InstancedMesh>(null);
  const rainRef = useRef<InstancedMesh>(null);
  const flyRef = useRef<InstancedMesh>(null);
  const bugRef = useRef<InstancedMesh>(null);
  const petalRef = useRef<InstancedMesh>(null);
  const rippleRef = useRef<InstancedMesh>(null);
  const smooth = useRef(0);

  const stressTarget = useLifeStore((s) => s.stress) ?? 0;
  const events = useLifeStore((s) => s.events);
  const streak = useMemo(() => healthStreak(events), [events]);

  const v = useMemo(() => {
    const radius = islandRadius(island);
    const z = buildZenForest(island, geom, radius);
    const [ix, iy, iz] = island.position;
    const pscale = particleScale();
    const rng = mulberry32(0x4ea17 ^ Math.round(radius * 100));

    const trunks: PoolInstance[] = [];
    const canopy: PoolInstance[] = [];
    const vines: PoolInstance[] = [];
    const pods: PoolInstance[] = [];
    const mushCap: PoolInstance[] = [];
    const mushStem: PoolInstance[] = [];
    const mushGlow: PoolInstance[] = [];
    const ferns: PoolInstance[] = [];
    const boulders: PoolInstance[] = [];
    const lilies: PoolInstance[] = [];
    const lotusCore: PoolInstance[] = [];
    const petals: Petal[] = [];
    const cJade = new Color();

    // willows: trunk + drooping jade canopy + glowing vine strands + pods
    for (const w of z.willows) {
      const wx = ix + w.x;
      const wz = iz + w.z;
      const wy = iy + w.y;
      trunks.push({ position: [wx, wy + w.h * 0.45, wz], rotation: [0, 0, 0], scale: [w.s, w.h, w.s], color: "#4a3a2c" });
      // lighter, raised crown — many small detailed leaf clumps with gaps so
      // the lake / lotus / mushrooms underneath stay visible
      const cy = wy + w.h;
      const clusters = Math.max(8, Math.round(12 * pscale));
      for (let j = 0; j < clusters; j++) {
        const a = (j / clusters) * Math.PI * 2 + j * 1.7;
        const ring = j % 3; // 0 inner-top, 1/2 outer
        const off = ring === 0 ? w.s * 0.8 : w.s * (1.6 + ring * 0.5);
        const yy = cy + (ring === 0 ? w.s * 1.7 : w.s * 0.9) + rng() * w.s * 0.5;
        const cs = w.s * (1.1 + rng() * 0.7);
        cJade.set(j % 2 ? "#2f6e3e" : "#46a64f");
        canopy.push({ position: [wx + Math.cos(a) * off, yy, wz + Math.sin(a) * off], rotation: [rng() * 0.5, a, rng() * 0.5], scale: [cs, cs * 0.85, cs], color: `#${cJade.getHexString()}` });
      }
      // drooping strands
      const strands = Math.max(6, Math.round(12 * pscale));
      for (let j = 0; j < strands; j++) {
        const a = (j / strands) * Math.PI * 2;
        const rr = w.s * (3.4 + (j % 3) * 0.4);
        const len = w.h * (0.5 + (j % 4) * 0.08);
        const sx = wx + Math.cos(a) * rr;
        const sz = wz + Math.sin(a) * rr;
        const sy = cy - len * 0.5;
        const glow = j % 3 === 0;
        (glow ? vines : trunks).push({ position: [sx, sy, sz], rotation: [0, a, 0], scale: glow ? [w.s * 0.06, len, w.s * 0.06] : [w.s * 0.07, len, w.s * 0.07], color: glow ? "#3fe6ff" : "#3a5a3e" });
        if (glow) pods.push({ position: [sx, cy - len, sz], rotation: [0, 0, 0], scale: [w.s * 0.18, w.s * 0.18, w.s * 0.18], color: "#7ef0ff" });
      }
    }

    // lotus (instanced petals + glow core) — breathing + butterfly hatch sites
    const lotusCenters: Vector3[] = [];
    z.lotus.forEach((l, li) => {
      const px = ix + l.x;
      const py = iy + l.y;
      const pz = iz + l.z;
      lotusCenters.push(new Vector3(px, py + l.s * 0.6, pz));
      lilies.push({ position: [px, py + 0.02, pz], rotation: [-Math.PI / 2, 0, 0], scale: [l.s * 2.4, l.s * 2.4, 1], color: "#3f7a4a" });
      lotusCore.push({ position: [px, py + l.s * 0.5, pz], rotation: [0, 0, 0], scale: [l.s * 0.5, l.s * 0.4, l.s * 0.5], color: "#ffe6a0" });
      for (let p = 0; p < 6; p++) {
        const a = (p / 6) * Math.PI * 2;
        petals.push({ base: new Vector3(px + Math.cos(a) * l.s * 0.5, py + l.s * 0.3, pz + Math.sin(a) * l.s * 0.5), rot: [0.7, a, 0], s: l.s, li });
      }
    });

    // mushrooms / ferns / boulders
    const mtint = ["#d98aa0", "#c9b0ff", "#e8e0d0"];
    for (const m of z.mushrooms) {
      const mx = ix + m.x;
      const my = iy + m.y;
      const mz = iz + m.z;
      mushStem.push({ position: [mx, my + m.s * 0.6, mz], rotation: [0, 0, 0], scale: [m.s * 0.3, m.s * 1.2, m.s * 0.3], color: "#efe7d6" });
      mushCap.push({ position: [mx, my + m.s * 1.2, mz], rotation: [0, 0, 0], scale: [m.s * 1.1, m.s * 0.7, m.s * 1.1], color: mtint[m.tint] });
      mushGlow.push({ position: [mx, my + m.s * 1.0, mz], rotation: [0, 0, 0], scale: [m.s * 0.9, m.s * 0.18, m.s * 0.9], color: "#9bf0d8" });
    }
    for (const f of z.ferns) {
      ferns.push({ position: [ix + f.x, iy + f.y + f.s * 0.5, iz + f.z], rotation: [0, f.rot, 0], scale: [f.s * 1.4, f.s * 1.6, f.s * 1.4], color: "#3f8a4a" });
    }
    for (const b of z.boulders) {
      boulders.push({ position: [ix + b.x, iy + b.y + b.s * 0.2, iz + b.z], rotation: [0.1, b.rot, 0.1], scale: [b.s, b.s * 0.7, b.s], color: "#5a6b4e" });
    }

    // fireflies
    const flies = z.fireflies.map((p) => ({ c: new Vector3(ix + p.x, iy + p.y, iz + p.z), phase: rng() * 6.28, r: 0.6 + rng() * 1.2, speed: 0.3 + rng() * 0.3 }));

    // rain (over island), steam (over lake), ripples (lake), butterflies (lotus)
    const rainN = Math.max(40, Math.round(180 * pscale));
    const steamN = Math.max(8, Math.round(22 * pscale));
    const bugN = 12;

    const lake = { x: ix + z.lake.x, y: iy + z.lake.y, z: iz + z.lake.z, r: z.lake.r };
    const bugs: Bug[] = Array.from({ length: bugN }, (_, i) => ({ lotus: lotusCenters[i % lotusCenters.length] ?? new Vector3(lake.x, lake.y + 2, lake.z), phase: rng() * 6.28, speed: 0.4 + rng() * 0.4, rr: 1.5 + rng() * 2.5, yr: 1 + rng() * 2.5 }));

    const capTop = iy + geom.capHeightAt(0, 0);
    return { radius, ix, iy, iz, capTop, trunks, canopy, vines, pods, mushCap, mushStem, mushGlow, ferns, boulders, lilies, lotusCore, petals, flies, lake, rainN, steamN, bugs };
  }, [island, geom]);

  useFrame((st, delta) => {
    const t = st.clock.elapsedTime;
    const dt = Math.min(delta, 0.05);
    smooth.current += (stressTarget - smooth.current) * dt * 0.5; // ~2s ease
    const stress = smooth.current;
    const pulse = 0.7 + 0.3 * Math.sin((t / 6) * Math.PI * 2); // ~6s breathing

    // bioluminescence pulse (dims but persists when stressed)
    const bio = (0.6 + 0.4 * pulse) * (1 - stress * 0.5);
    glowVineMat.color.setRGB(0.25 * bio * 3.6, 0.9 * bio * 1.6, bio * 1.6);
    glowPodMat.color.setRGB(0.5 * bio * 2.2, bio * 1.8, bio * 1.8);
    mushGlowMat.color.setRGB(0.6 * bio * 1.6, bio * 1.4, 0.85 * bio * 1.6);

    // fog dome + rain scale with stress
    fogMat.opacity = stress * 0.55;

    const steam = steamRef.current;
    if (steam) {
      for (let i = 0; i < v.steamN; i++) {
        const p = (t * 0.16 + i / v.steamN) % 1;
        const a = i * 2.39;
        const r = (i % 3) * v.lake.r * 0.28;
        const sc = (0.4 + p * 1.6) * v.lake.r * 0.5;
        tmpV.set(v.lake.x + Math.cos(a) * r, v.lake.y + p * v.lake.r * 1.8, v.lake.z + Math.sin(a) * r);
        tmpM.compose(tmpV, tmpQ.copy(st.camera.quaternion), tmpS.setScalar(Math.max(0.001, sc)));
        steam.setMatrixAt(i, tmpM);
      }
      steam.instanceMatrix.needsUpdate = true;
    }

    const rain = rainRef.current;
    if (rain) {
      const span = v.radius * 1.8;
      for (let i = 0; i < v.rainN; i++) {
        const active = i < v.rainN * stress;
        if (!active) { tmpM.makeScale(0.001, 0.001, 0.001); rain.setMatrixAt(i, tmpM); continue; }
        const seed = i * 12.9898;
        const fx = ((Math.sin(seed) * 43758.5) % 1) * span - span / 2;
        const fz = ((Math.sin(seed * 1.7) * 13758.5) % 1) * span - span / 2;
        const y = v.radius * 1.4 - ((t * 30 + (i % 17) * 3) % (v.radius * 2.2));
        tmpV.set(v.ix + fx, v.iy + y, v.iz + fz);
        tmpM.compose(tmpV, tmpQ.identity(), tmpS.set(0.04, v.radius * 0.18, 0.04));
        rain.setMatrixAt(i, tmpM);
      }
      rain.instanceMatrix.needsUpdate = true;
    }

    const fly = flyRef.current;
    if (fly) {
      for (let i = 0; i < v.flies.length; i++) {
        const f = v.flies[i];
        const a = f.phase + t * f.speed;
        const blink = 0.4 + 0.6 * Math.abs(Math.sin(t * 2 + f.phase * 4));
        tmpV.set(f.c.x + Math.cos(a) * f.r, f.c.y + Math.sin(t * 0.8 + f.phase) * 0.4, f.c.z + Math.sin(a) * f.r);
        tmpM.compose(tmpV, tmpQ.identity(), tmpS.setScalar(v.radius * 0.012 * (0.5 + blink) * (1 - stress * 0.4)));
        fly.setMatrixAt(i, tmpM);
      }
      fly.instanceMatrix.needsUpdate = true;
    }

    // streak butterflies (read-only streak)
    const bug = bugRef.current;
    if (bug) {
      const activeN = streak >= 3 ? Math.min(v.bugs.length, streak - 1) : 0;
      for (let i = 0; i < v.bugs.length; i++) {
        if (i >= activeN) { tmpM.makeScale(0.001, 0.001, 0.001); bug.setMatrixAt(i, tmpM); continue; }
        const b = v.bugs[i];
        const a = b.phase + t * b.speed;
        tmpV.set(b.lotus.x + Math.cos(a) * b.rr + Math.sin(t * 1.3 + i) * 0.6, b.lotus.y + 1.5 + Math.sin(t * 0.9 + b.phase) * b.yr, b.lotus.z + Math.sin(a * 1.1) * b.rr);
        const flap = 0.6 + 0.4 * Math.sin(t * 12 + i);
        tmpQ.setFromAxisAngle(UP, a);
        tmpM.compose(tmpV, tmpQ, tmpS.set(v.radius * 0.06 * flap, v.radius * 0.05, v.radius * 0.06));
        bug.setMatrixAt(i, tmpM);
      }
      bug.instanceMatrix.needsUpdate = true;
    }

    // lotus breathing petals
    const pe = petalRef.current;
    if (pe) {
      for (let i = 0; i < v.petals.length; i++) {
        const p = v.petals[i];
        const open = 0.85 + 0.15 * Math.sin((t / 5) * Math.PI * 2 + p.li);
        tmpQ.setFromEuler(eulerSet(p.rot[0] * open, p.rot[1], p.rot[2]));
        tmpM.compose(p.base, tmpQ, tmpS.set(p.s * 0.8, p.s * 0.5, p.s * 1.1));
        pe.setMatrixAt(i, tmpM);
      }
      pe.instanceMatrix.needsUpdate = true;
    }

    // calm ambient ripples on the moss near the lake
    const rg = rippleRef.current;
    if (rg) {
      for (let i = 0; i < 4; i++) {
        const cyc = (t * 0.25 + i * 0.25) % 1;
        const r = v.lake.r * (0.4 + cyc * 1.3);
        rippleMat.opacity = (1 - cyc) * 0.4 * (1 - stress * 0.6);
        tmpQ.setFromAxisAngle(tmpV.set(1, 0, 0), -Math.PI / 2);
        tmpM.compose(tmpV.set(v.lake.x, v.lake.y + 0.05, v.lake.z), tmpQ, tmpS.set(r, r, 1));
        rg.setMatrixAt(i, tmpM);
      }
      rg.instanceMatrix.needsUpdate = true;
    }
  });

  const bark = getToonMaterial("zen-bark", { color: "#ffffff", flatShading: true, rimStrength: 0.3 });
  const canopyMat = getToonMaterial("zen-canopy", { flatShading: true, rimStrength: 0.42, rimColor: "#b8ffe0" });
  const fernMat = getToonMaterial("zen-fern", { color: "#ffffff", flatShading: true, rimStrength: 0.4, rimColor: "#cdeeb0" });
  const rockMat = getToonMaterial("zen-rock", { color: "#ffffff", flatShading: true, rimStrength: 0.3, grain: 0.14 });
  const mushMat = getToonMaterial("zen-mush", { color: "#ffffff", flatShading: true, rimStrength: 0.35 });
  const lilyMat = getToonMaterial("zen-lily", { color: "#ffffff", rimStrength: 0.3 });

  return (
    <group>
      <InstancedPool geometry={cylGeo} material={bark} instances={v.trunks} castShadow />
      <InstancedPool geometry={leafGeo} material={canopyMat} instances={v.canopy} castShadow receiveShadow />
      <InstancedPool geometry={cylGeo} material={glowVineMat} instances={v.vines} />
      <InstancedPool geometry={sphGeo} material={glowPodMat} instances={v.pods} />
      <InstancedPool geometry={coneGeo} material={fernMat} instances={v.ferns} castShadow />
      <InstancedPool geometry={blobGeo} material={rockMat} instances={v.boulders} castShadow receiveShadow />
      <InstancedPool geometry={cylGeo} material={mushMat} instances={v.mushStem} />
      <InstancedPool geometry={coneGeo} material={mushMat} instances={v.mushCap} castShadow />
      <InstancedPool geometry={cylGeo} material={mushGlowMat} instances={v.mushGlow} />
      <InstancedPool geometry={lilyGeo} material={lilyMat} instances={v.lilies} />
      <InstancedPool geometry={sphGeo} material={lotusCoreMat} instances={v.lotusCore} />
      <instancedMesh ref={petalRef} args={[coneGeo, lotusPetalMat, Math.max(1, v.petals.length)]} frustumCulled={false} />

      {/* Wellness Lake — low-res planar reflector */}
      <mesh geometry={lilyGeo} rotation={[-Math.PI / 2, 0, 0]} position={[v.lake.x, v.lake.y, v.lake.z]} scale={[v.lake.r, v.lake.r, 1]}>
        <MeshReflectorMaterial resolution={256} mixBlur={1} mixStrength={2.4} blur={[120, 50]} color="#3f7d78" metalness={0.2} roughness={0.5} />
      </mesh>
      <instancedMesh ref={steamRef} args={[planeGeo, steamMat, v.steamN]} frustumCulled={false} renderOrder={6} />
      <instancedMesh ref={rippleRef} args={[torusGeo, rippleMat, 4]} frustumCulled={false} />

      {/* micro-life */}
      <instancedMesh ref={flyRef} args={[sphGeo, fireflyMat, Math.max(1, v.flies.length)]} frustumCulled={false} />
      <instancedMesh ref={bugRef} args={[planeGeo, butterflyMat, v.bugs.length]} frustumCulled={false} />

      {/* reactive stress: rain + cool fog dome */}
      <instancedMesh ref={rainRef} args={[planeGeo, rainMat, v.rainN]} frustumCulled={false} renderOrder={7} />
      <mesh geometry={fogGeo} material={fogMat} position={[v.ix, v.iy + v.radius * 0.4, v.iz]} scale={[v.radius * 1.7, v.radius * 1.2, v.radius * 1.7]} />

      {/* floating heart + ECG pulse-line */}
      <HeartMonitor pos={[v.ix, v.capTop + v.radius * 1.0, v.iz]} r={v.radius * 0.22} />
    </group>
  );
}

/** Floating 3D heart + scrolling ECG pulse-line above the Health island. */
function HeartMonitor({ pos, r }: { pos: [number, number, number]; r: number }) {
  const heartRef = useRef<Group>(null);
  const ecgMat = useMemo(() => new ShaderMaterial({ vertexShader: ecgVert, fragmentShader: ecgFrag, uniforms: { uTime: { value: 0 } }, transparent: true, depthWrite: false }), []);
  useFrame((st, delta) => {
    const t = st.clock.elapsedTime;
    ecgMat.uniforms.uTime.value += delta;
    if (heartRef.current) {
      const cyc = t % 1.05; // lub-dub
      const b = Math.exp(-cyc * 20) * 0.16 + Math.exp(-Math.max(0, cyc - 0.16) * 20) * 0.1;
      heartRef.current.scale.setScalar(r * (1 + b));
      heartRef.current.rotation.y = Math.sin(t * 0.4) * 0.3;
    }
  });
  return (
    <group position={pos}>
      <group ref={heartRef} scale={r}>
        <mesh geometry={heartGeo} material={heartMat} castShadow />
      </group>
      <mesh geometry={ecgGeo} material={ecgMat} position={[0, -r * 1.5, 0]} scale={[r * 4, r * 1.1, 1]} renderOrder={7} />
    </group>
  );
}

/** Bioluminescent zen-rainforest re-skin for the Health Kingdom (island-scoped). */
export default function HealthLayer({ built }: { built: BuiltIsland[] }) {
  const isles = built.filter(
    (b) => !b.island.locked && CORE_KINGDOM_IDS.includes(b.island.id as CoreKingdomId) && b.island.id === "health"
  );
  if (isles.length === 0) return null;
  return (
    <group>
      {isles.map((b) => (
        <HealthForest key={b.island.id} {...b} />
      ))}
    </group>
  );
}
