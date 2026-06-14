"use client";

import { useMemo, useRef, useState } from "react";
import { useFrame, type ThreeEvent } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import {
  BoxGeometry,
  Color,
  ConeGeometry,
  DoubleSide,
  Euler,
  IcosahedronGeometry,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  Quaternion,
  ShaderMaterial,
  SphereGeometry,
  Vector3,
} from "three";
import type { BuiltIsland } from "@/components/canvas/WorldGraph";
import {
  buildGlacierRiver,
  buildTentGeometry,
  buildVolcanoGeometry,
  CRATER_DEPTH_FRAC,
  volcanoPlacement,
} from "@/engine/generation/structures/volcano";
import { GLSL_SIMPLEX_2D } from "@/lib/glsl";
import { ECOSYSTEMS } from "@/engine/ecosystem";
import { CORE_KINGDOM_IDS, type CoreKingdomId } from "@/engine/schema/world";
import { islandCenter, islandRadius } from "@/engine/resolver/layout";
import { getToonMaterial } from "@/engine/materials/toon";
import { mulberry32, smoothstep } from "@/lib/noise";
import { particleScale } from "@/lib/quality";
import { useCameraStore } from "@/stores/cameraStore";
import Waterfall from "@/components/canvas/effects/Waterfall";

// eruption cadence: calm, then a burst + 10s of smoke, every minute
const ERUPT_PERIOD = 60;
const SMOKE_DUR = 10;
const BURST_DUR = 2.2;
const EJECTA_DUR = 3.5;
const BOMB_DUR = 5;

const craterGeo = new IcosahedronGeometry(1, 0); // faceted molten pool
const streakGeo = new BoxGeometry(1, 1, 1);
const smokeGeo = new IcosahedronGeometry(1, 0);
const bombGeo = new SphereGeometry(0.5, 8, 6);
const ejectaGeo = new IcosahedronGeometry(0.5, 0);
const tentGeo = buildTentGeometry();
const campfireGeo = new IcosahedronGeometry(1, 0);
const iceGeo = new ConeGeometry(0.6, 1, 5); // chunky serac, not a needle
const crateGeo = new BoxGeometry(0.5, 0.5, 0.5);
const pondGeo = new IcosahedronGeometry(1, 0);

const riverVert = /* glsl */ `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
`;
const riverFrag = /* glsl */ `
uniform float uTime;
varying vec2 vUv;
${GLSL_SIMPLEX_2D}
void main() {
  float flow = vUv.y - uTime * 0.14;
  // three layers of streaks at increasing frequency for churning meltwater
  float s1 = snoise(vec2(vUv.x * 6.0, flow * 7.0));
  float s2 = snoise(vec2(vUv.x * 13.0 + 3.0, flow * 15.0));
  float s3 = snoise(vec2(vUv.x * 24.0 + 7.0, flow * 27.0));
  float foam = smoothstep(0.08, 0.8, s1 * 0.5 + s2 * 0.3 + s3 * 0.2);
  vec3 deep = vec3(0.16, 0.46, 0.7);
  vec3 ice = vec3(0.66, 0.88, 0.96);
  // deeper toward the channel center, brighter near the falls
  float center = smoothstep(0.5, 0.0, abs(vUv.x - 0.5));
  vec3 col = mix(ice, deep, center * 0.55);
  col = mix(col, mix(deep, ice, 0.35 + 0.55 * vUv.y), 0.45);
  col = mix(col, vec3(0.96, 0.99, 1.0), foam * 0.6);
  float edge = smoothstep(0.0, 0.16, vUv.x) * smoothstep(1.0, 0.84, vUv.x);
  gl_FragColor = vec4(col, 0.92 * edge + foam * 0.1);
}
`;

const craterMat = new MeshBasicMaterial({ color: new Color("#ff5e1e").multiplyScalar(1.2), toneMapped: false });
const lavaMat = new MeshBasicMaterial({ color: new Color("#ff5a1e").multiplyScalar(1.35), toneMapped: false });
const bombMat = new MeshBasicMaterial({ color: new Color("#ffb24d").multiplyScalar(1.5), toneMapped: false });
const ejectaMat = new MeshBasicMaterial({ color: new Color("#ff7a32").multiplyScalar(1.5), toneMapped: false });
const smokeMat = new MeshBasicMaterial({ color: new Color("#3b332c"), transparent: true, opacity: 0.6, depthWrite: false });
const campfireMat = new MeshBasicMaterial({ color: new Color("#ff8a3a").multiplyScalar(1.4), toneMapped: false });
const pondMat = new MeshBasicMaterial({ color: new Color("#bfe6f5"), transparent: true, opacity: 0.7, depthWrite: false });

const tmpM = new Matrix4();
const tmpQ = new Quaternion();
const tmpV = new Vector3();
const tmpS = new Vector3();
const UP = new Vector3(0, 1, 0);

interface Puff { ang: number; rad: number; speed: number; phase: number; wobble: number }
interface Bomb { ang: number; range: number; arc: number; speed: number; phase: number; size: number }
interface Ejecta { dir: Vector3; speed: number; size: number }
interface Tent { x: number; y: number; z: number; rotY: number; scale: number }
interface Camp { cx: number; cy: number; cz: number; tents: Tent[] }

function Volcano({ island, geom }: BuiltIsland) {
  const craterRef = useRef<Mesh>(null);
  const smokeRef = useRef<InstancedMesh>(null);
  const bombRef = useRef<InstancedMesh>(null);
  const ejectaRef = useRef<InstancedMesh>(null);
  const [hovered, setHovered] = useState<string | null>(null);

  const v = useMemo(() => {
    const radius = islandRadius(island);
    const p = volcanoPlacement(island, geom, radius);
    const seed = 0x701ca ^ Math.round(p.base * 100);
    const geo = buildVolcanoGeometry(seed, p.base, p.height, p.craterR);
    const [ix, iy, iz] = island.position;
    const wx = ix + p.x;
    const wz = iz + p.z;
    const meshBaseY = iy + p.y - 0.4;
    const topY = meshBaseY + p.height;
    const craterY = meshBaseY + p.height - p.height * CRATER_DEPTH_FRAC;
    const rng = mulberry32(seed);
    const pscale = particleScale();

    const streaks: { pos: [number, number, number]; quat: [number, number, number, number]; scale: [number, number, number] }[] = [];
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2 + rng() * 0.4;
      const topPt = new Vector3(wx + Math.cos(a) * p.craterR * 0.95, topY - p.height * 0.06, wz + Math.sin(a) * p.craterR * 0.95);
      const botPt = new Vector3(wx + Math.cos(a) * p.base * 0.86, meshBaseY + p.height * 0.08, wz + Math.sin(a) * p.base * 0.86);
      const mid = topPt.clone().add(botPt).multiplyScalar(0.5);
      const dir = botPt.clone().sub(topPt);
      const len = dir.length();
      const q = new Quaternion().setFromUnitVectors(UP, dir.normalize());
      streaks.push({ pos: [mid.x, mid.y, mid.z], quat: [q.x, q.y, q.z, q.w], scale: [p.base * 0.06, len, p.base * 0.045] });
    }

    const puffs: Puff[] = Array.from({ length: Math.max(10, Math.round(30 * pscale)) }, () => ({
      ang: rng() * Math.PI * 2, rad: rng() * p.craterR * 0.7, speed: 0.12 + rng() * 0.12, phase: rng(), wobble: 0.6 + rng() * 1.2,
    }));
    const bombs: Bomb[] = Array.from({ length: Math.max(4, Math.round(9 * pscale)) }, () => ({
      ang: rng() * Math.PI * 2, range: p.base * (0.5 + rng() * 0.8), arc: p.height * (0.6 + rng() * 0.7), speed: 0.5 + rng() * 0.5, phase: rng() * 0.3, size: p.base * (0.05 + rng() * 0.05),
    }));
    const ejecta: Ejecta[] = Array.from({ length: Math.max(8, Math.round(26 * pscale)) }, () => {
      const az = rng() * Math.PI * 2;
      const el = 0.55 + rng() * 0.4; // mostly upward
      const horiz = Math.sqrt(1 - el * el);
      return {
        dir: new Vector3(Math.cos(az) * horiz, el, Math.sin(az) * horiz),
        speed: p.base * (1.6 + rng() * 1.8),
        size: p.base * (0.04 + rng() * 0.06),
      };
    });

    // ice seracs scattered on the glacier (−X) half
    const ice: { pos: [number, number, number]; rotY: number; tilt: number; scale: [number, number, number] }[] = [];
    for (let i = 0; i < Math.max(4, Math.round(9 * pscale)); i++) {
      const theta = Math.PI + (rng() - 0.5) * 1.7;
      const rFrac = 0.2 + rng() * 0.58;
      const f = geom.footprintAt(theta);
      const lx = Math.cos(theta) * f * rFrac;
      const lz = Math.sin(theta) * f * rFrac;
      const h = radius * (0.05 + rng() * 0.08); // shorter
      const wf = h * (0.5 + rng() * 0.3); // wider base → serac block
      ice.push({
        pos: [ix + lx, iy + geom.capHeightAt(lx, lz) + h * 0.45, iz + lz],
        rotY: rng() * Math.PI * 2,
        tilt: (rng() - 0.5) * 0.16,
        scale: [wf, h, wf],
      });
    }

    // a frozen pond on the glacier
    const pondTheta = Math.PI + 0.4;
    const pf = geom.footprintAt(pondTheta) * 0.4;
    const plx = Math.cos(pondTheta) * pf;
    const plz = Math.sin(pondTheta) * pf;
    const pond: [number, number, number] = [ix + plx, iy + geom.capHeightAt(plx, plz) + 0.05, iz + plz];
    const pondR = radius * 0.16;

    // expedition camps (foot of the cone) — interactive groups
    const camps: Camp[] = p.camps.map((c) => {
      const cx = ix + c.x;
      const cz = iz + c.z;
      const cy = iy + geom.capHeightAt(c.x, c.z);
      const tents: Tent[] = [];
      for (let k = 0; k < 3; k++) {
        const a = rng() * Math.PI * 2;
        const off = p.base * (0.22 + rng() * 0.2);
        const ts = p.base * (k === 2 ? 0.12 + rng() * 0.03 : 0.17 + rng() * 0.05);
        tents.push({ x: Math.cos(a) * off, y: 0, z: Math.sin(a) * off, rotY: rng() * Math.PI * 2, scale: ts });
      }
      return { cx, cy, cz, tents };
    });

    const river = buildGlacierRiver(geom, radius);
    const riverLip = new Vector3(ix + river.lip.x, iy + river.lip.y, iz + river.lip.z);
    const riverMat = new ShaderMaterial({
      vertexShader: riverVert,
      fragmentShader: riverFrag,
      uniforms: { uTime: { value: 0 } },
      transparent: true,
      depthWrite: false,
      side: DoubleSide,
      fog: false,
    });

    const dreamId = island.structures.find((s) => s.type === "dream_mountain")?.id ?? null;
    const campId = island.structures.find((s) => s.type === "expedition_camp")?.id ?? null;

    return { p, geo, wx, wz, meshBaseY, topY, craterY, streaks, puffs, bombs, ejecta, ice, pond, pondR, camps, river, riverLip, riverMat, dreamId, campId };
  }, [island, geom]);

  useFrame((st) => {
    const t = st.clock.elapsedTime;
    const cy = t % ERUPT_PERIOD;
    const burst = cy < BURST_DUR ? Math.pow(1 - cy / BURST_DUR, 2) : 0;
    const smokeEnv = cy < SMOKE_DUR ? smoothstep(0, 0.5, cy) * (1 - smoothstep(SMOKE_DUR - 2.5, SMOKE_DUR, cy)) : 0;
    const ejectaEnv = cy < EJECTA_DUR ? 1 - cy / EJECTA_DUR : 0;
    const bombEnv = cy < BOMB_DUR ? 1 - smoothstep(BOMB_DUR - 1.5, BOMB_DUR, cy) : 0;

    if (craterRef.current) {
      const pulse = 0.55 + 0.3 * Math.sin(t * 2.4) + 0.12 * Math.sin(t * 6.1);
      const sx = v.p.craterR * 0.8;
      const sy = v.p.height * CRATER_DEPTH_FRAC * 0.42;
      const intensity = 0.55 + pulse * 0.3 + burst * 2.4 + smokeEnv * 0.5;
      craterRef.current.scale.set(sx * (1 + burst * 0.6), sy * intensity, sx * (1 + burst * 0.6));
    }

    const smoke = smokeRef.current;
    if (smoke) {
      for (let i = 0; i < v.puffs.length; i++) {
        const f = v.puffs[i];
        const p = (t * f.speed + f.phase) % 1;
        const grow = (0.18 + p * 0.7) * (1 - Math.max(0, (p - 0.78) / 0.22));
        const sc = Math.max(0.001, v.p.base * grow * smokeEnv * (0.7 + burst * 1.4));
        const drift = Math.sin(t * f.wobble + f.phase * 6) * v.p.base * 0.25 * p;
        tmpV.set(v.wx + Math.cos(f.ang) * f.rad + drift, v.topY + p * v.p.height * 1.5, v.wz + Math.sin(f.ang) * f.rad + Math.cos(t * f.wobble) * v.p.base * 0.15 * p);
        tmpM.compose(tmpV, tmpQ.identity(), tmpS.setScalar(sc));
        smoke.setMatrixAt(i, tmpM);
      }
      smoke.instanceMatrix.needsUpdate = true;
    }

    const bomb = bombRef.current;
    if (bomb) {
      for (let i = 0; i < v.bombs.length; i++) {
        const b = v.bombs[i];
        const p = (t * b.speed + b.phase) % 1;
        const r = p * b.range;
        const y = v.topY + 4 * p * (1 - p) * b.arc;
        tmpV.set(v.wx + Math.cos(b.ang) * r, y, v.wz + Math.sin(b.ang) * r);
        tmpM.compose(tmpV, tmpQ.identity(), tmpS.setScalar(b.size * bombEnv));
        bomb.setMatrixAt(i, tmpM);
      }
      bomb.instanceMatrix.needsUpdate = true;
    }

    const ej = ejectaRef.current;
    if (ej) {
      for (let i = 0; i < v.ejecta.length; i++) {
        const e = v.ejecta[i];
        const age = cy;
        tmpV.set(
          v.wx + e.dir.x * e.speed * age,
          v.topY + e.dir.y * e.speed * age - 5.0 * age * age,
          v.wz + e.dir.z * e.speed * age
        );
        const sc = e.size * ejectaEnv;
        tmpM.compose(tmpV, tmpQ.setFromAxisAngle(UP, age * 6 + i), tmpS.setScalar(Math.max(0.001, sc)));
        ej.setMatrixAt(i, tmpM);
      }
      ej.instanceMatrix.needsUpdate = true;
    }

    v.riverMat.uniforms.uTime.value = t;
  });

  const rockMat = getToonMaterial("volcano-mtn", { vertexColors: true, flatShading: true, rimColor: "#ff6b35", rimStrength: 0.3, grain: 0.16 });
  rockMat.side = DoubleSide;
  const tentMat = getToonMaterial("camp-tent", { vertexColors: true, flatShading: true, rimStrength: 0.32 });
  tentMat.side = DoubleSide;
  const crateMat = getToonMaterial("camp-crate", { color: "#8a6a44", flatShading: true, rimStrength: 0.3 });
  const iceMat = getToonMaterial("glacier-ice", { color: "#cfeaf6", flatShading: true, rimColor: "#ffffff", rimStrength: 0.5 });

  const inspect = (structureId: string | null, target: [number, number, number]) => (e: ThreeEvent<MouseEvent>): void => {
    e.stopPropagation();
    const cam = useCameraStore.getState();
    if (structureId) cam.inspectStructure(island.id, structureId, target);
    else cam.flyToIsland(island.id, islandCenter(island));
  };
  const hoverOn = (key: string) => (e: ThreeEvent<PointerEvent>): void => {
    e.stopPropagation();
    setHovered(key);
    document.body.style.cursor = "pointer";
  };
  const hoverOff = (): void => {
    setHovered(null);
    document.body.style.cursor = "";
  };

  const tip = (text: string, pos: [number, number, number]) => (
    <Html position={pos} center zIndexRange={[20, 5]} style={{ pointerEvents: "none" }}>
      <div className="glass whitespace-nowrap px-2.5 py-1 text-center">
        <span className="font-heading text-[0.7rem] font-bold text-ink">{text}</span>
        <span className="ml-1.5 font-label text-[0.56rem] font-semibold uppercase tracking-wider text-ink-soft">click to inspect</span>
      </div>
    </Html>
  );

  return (
    <group>
      {/* rugged displaced mountain — click = inspect "See Japan" (dream_mountain) */}
      <mesh
        geometry={v.geo}
        material={rockMat}
        position={[v.wx, v.meshBaseY, v.wz]}
        castShadow
        receiveShadow
        onPointerOver={hoverOn("volcano")}
        onPointerOut={hoverOff}
        onClick={inspect(v.dreamId, [v.wx, v.topY, v.wz])}
      />
      {hovered === "volcano" && tip("Dream Mountain", [v.wx, v.topY + 1.5, v.wz])}

      <mesh
        ref={craterRef}
        geometry={craterGeo}
        material={craterMat}
        position={[v.wx, v.craterY + v.p.height * 0.04, v.wz]}
        scale={[v.p.craterR * 0.8, v.p.height * CRATER_DEPTH_FRAC * 0.42, v.p.craterR * 0.8]}
      />
      <instancedMesh
        args={[streakGeo, lavaMat, v.streaks.length]}
        ref={(m) => {
          if (!m) return;
          v.streaks.forEach((s, i) => {
            tmpQ.set(...s.quat);
            tmpM.compose(tmpV.set(...s.pos), tmpQ, tmpS.set(...s.scale));
            m.setMatrixAt(i, tmpM);
          });
          m.instanceMatrix.needsUpdate = true;
        }}
        frustumCulled={false}
      />
      <instancedMesh ref={smokeRef} args={[smokeGeo, smokeMat, v.puffs.length]} frustumCulled={false} renderOrder={6} />
      <instancedMesh ref={bombRef} args={[bombGeo, bombMat, v.bombs.length]} frustumCulled={false} />
      <instancedMesh ref={ejectaRef} args={[ejectaGeo, ejectaMat, v.ejecta.length]} frustumCulled={false} />

      {/* glacier: ice seracs + frozen pond */}
      <instancedMesh
        args={[iceGeo, iceMat, v.ice.length]}
        ref={(m) => {
          if (!m) return;
          v.ice.forEach((s, i) => {
            tmpQ.setFromEuler(eulerTilt(s.tilt, s.rotY));
            tmpM.compose(tmpV.set(...s.pos), tmpQ, tmpS.set(...s.scale));
            m.setMatrixAt(i, tmpM);
          });
          m.instanceMatrix.needsUpdate = true;
        }}
        castShadow
        frustumCulled={false}
      />
      <mesh geometry={pondGeo} material={pondMat} position={v.pond} scale={[v.pondR, 0.12, v.pondR]} />

      {/* expedition camps — click = inspect "Weekend Hikes" (expedition_camp) */}
      {v.camps.map((camp, ci) => (
        <group
          key={ci}
          position={[camp.cx, camp.cy, camp.cz]}
          onPointerOver={hoverOn(`camp${ci}`)}
          onPointerOut={hoverOff}
          onClick={inspect(v.campId, [camp.cx, camp.cy + 1.4, camp.cz])}
        >
          {camp.tents.map((tn, ti) => (
            <mesh key={ti} geometry={tentGeo} material={tentMat} position={[tn.x, tn.y, tn.z]} rotation={[0, tn.rotY, 0]} scale={tn.scale} castShadow receiveShadow />
          ))}
          <mesh geometry={campfireGeo} material={campfireMat} position={[0, 0.16, 0]} scale={v.p.base * 0.12} />
          <mesh geometry={crateGeo} material={crateMat} position={[v.p.base * 0.22, v.p.base * 0.09, -v.p.base * 0.15]} scale={v.p.base * 0.3} castShadow />
          {hovered === `camp${ci}` && tip("Expedition Camp", [0, v.p.base * 0.9, 0])}
        </group>
      ))}

      {/* glacier river (flowing shader) + its waterfall over the rim */}
      <mesh geometry={v.river.geometry} material={v.riverMat} position={island.position} />
      <Waterfall lip={v.riverLip} dir={v.river.dir} style="water" />
    </group>
  );
}

const _euler = new Euler();
function eulerTilt(tilt: number, rotY: number): Euler {
  return _euler.set(tilt, rotY, tilt * 0.5);
}

/** Erupting volcano + glacier + camps on the Adventure island. */
export default function VolcanoLayer({ built }: { built: BuiltIsland[] }) {
  const volcanoes = built.filter(
    (b) =>
      !b.island.locked &&
      CORE_KINGDOM_IDS.includes(b.island.id as CoreKingdomId) &&
      ECOSYSTEMS[b.island.id as CoreKingdomId].split
  );
  if (volcanoes.length === 0) return null;
  return (
    <group>
      {volcanoes.map((b) => (
        <Volcano key={b.island.id} {...b} />
      ))}
    </group>
  );
}
