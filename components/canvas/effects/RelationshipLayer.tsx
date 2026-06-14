"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { MeshReflectorMaterial } from "@react-three/drei";
import {
  BufferAttribute,
  BufferGeometry,
  CatmullRomCurve3,
  Color,
  CylinderGeometry,
  IcosahedronGeometry,
  InstancedMesh,
  Matrix4,
  MeshBasicMaterial,
  PlaneGeometry,
  QuadraticBezierCurve3,
  Quaternion,
  SphereGeometry,
  TubeGeometry,
  Vector3,
} from "three";
import type { BuiltIsland } from "@/components/canvas/WorldGraph";
import { CORE_KINGDOM_IDS, type CoreKingdomId } from "@/engine/schema/world";
import { islandRadius } from "@/engine/resolver/layout";
import { getToonMaterial } from "@/engine/materials/toon";
import { mulberry32 } from "@/lib/noise";
import { particleScale } from "@/lib/quality";
import { buildBlossomVale } from "@/engine/generation/structures/blossomvale";
import Waterfall from "@/components/canvas/effects/Waterfall";

const lanternGeo = new SphereGeometry(0.16, 8, 6);
const fireflyGeo = new SphereGeometry(0.05, 5, 4);
const smokeGeo = new IcosahedronGeometry(0.5, 0);
const petalGeo = new PlaneGeometry(0.28, 0.28);
const trunkGeo = new CylinderGeometry(0.09, 0.13, 1, 6);
const blossomGeo = new IcosahedronGeometry(1, 1);
const mossGeo = new IcosahedronGeometry(1, 0);

const lanternMat = new MeshBasicMaterial({ color: new Color("#ffc27a").multiplyScalar(1.7), toneMapped: false });
const fireflyMat = new MeshBasicMaterial({ color: new Color("#ffd27a").multiplyScalar(1.8), toneMapped: false });
const smokeMat = new MeshBasicMaterial({ color: new Color("#f5f2ee"), transparent: true, opacity: 0.42, depthWrite: false });
const petalMat = new MeshBasicMaterial({ color: new Color("#ffc2d6"), transparent: true, opacity: 0.85, depthWrite: false, side: 2 });

const tmpM = new Matrix4();
const tmpQ = new Quaternion();
const tmpV = new Vector3();
const tmpS = new Vector3();
const UP = new Vector3(0, 1, 0);

interface Firefly { c: Vector3; r: number; speed: number; phase: number }
interface Puff { base: Vector3; speed: number; phase: number }
interface Petal { i0: number; speed: number; phase: number }

function Vale({ island, geom }: BuiltIsland) {
  const fireflyRef = useRef<InstancedMesh>(null);
  const smokeRef = useRef<InstancedMesh>(null);
  const petalRef = useRef<InstancedMesh>(null);

  const v = useMemo(() => {
    const radius = islandRadius(island);
    const rng = mulberry32(0xb10550 ^ Math.round(radius * 100));
    const bv = buildBlossomVale(island, geom, radius);
    const [ix, iy, iz] = island.position;
    const W = (p: Vector3): Vector3 => new Vector3(ix + p.x, iy + p.y, iz + p.z);
    const pscale = particleScale();

    // root cradle tubes (world curves)
    const roots = bv.roots.map((pts) => new TubeGeometry(new CatmullRomCurve3(pts.map(W)), 22, radius * 0.06, 6, false));
    const moss = bv.moss.map((m) => ({ pos: W(m.p), s: m.s }));

    // memory stream — flat reflective ribbon
    const sp = bv.stream.pts;
    const positions: number[] = [];
    const uvs: number[] = [];
    const idx: number[] = [];
    for (let i = 0; i < sp.length; i++) {
      const c = sp[i];
      const prev = sp[Math.max(0, i - 1)];
      const next = sp[Math.min(sp.length - 1, i + 1)];
      const tx = next.x - prev.x;
      const tz = next.z - prev.z;
      const tl = Math.hypot(tx, tz) || 1;
      const px = -tz / tl;
      const pz = tx / tl;
      const w = bv.stream.width * (0.7 + 0.5 * (i / sp.length));
      for (let s = 0; s < 2; s++) {
        const sign = s === 0 ? -1 : 1;
        positions.push(ix + c.x + px * w * sign, iy + c.y, iz + c.z + pz * w * sign);
        uvs.push(s, i / sp.length);
      }
      if (i < sp.length - 1) {
        const a = i * 2;
        idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
      }
    }
    const streamGeo = new BufferGeometry();
    streamGeo.setAttribute("position", new BufferAttribute(new Float32Array(positions), 3));
    streamGeo.setAttribute("uv", new BufferAttribute(new Float32Array(uvs), 2));
    streamGeo.setIndex(idx);
    streamGeo.computeVertexNormals();
    const streamLip = W(bv.stream.lip);
    const streamPtsW = sp.map((p) => new Vector3(ix + p.x, iy + p.y + 0.06, iz + p.z));

    // archways — two leaning trunks + a blossom canopy bridging
    const archParts: { trunks: { pos: [number, number, number]; rot: [number, number, number]; scale: [number, number, number] }[]; blossoms: { pos: [number, number, number]; s: number }[] } = { trunks: [], blossoms: [] };
    for (const a of bv.arches) {
      const cwx = ix + a.x;
      const cwz = iz + a.z;
      const cy = iy + a.y;
      const perpX = Math.cos(a.rot + Math.PI / 2);
      const perpZ = Math.sin(a.rot + Math.PI / 2);
      for (const side of [-1, 1] as const) {
        const fx = cwx + perpX * a.s * 0.9 * side;
        const fz = cwz + perpZ * a.s * 0.9 * side;
        archParts.trunks.push({
          pos: [fx, cy + a.s * 0.75, fz],
          rot: [side * perpZ * 0.4, a.rot, -side * perpX * 0.4],
          scale: [a.s * 0.12, a.s * 1.7, a.s * 0.12],
        });
      }
      for (let j = 0; j < 3; j++) {
        archParts.blossoms.push({
          pos: [cwx + perpX * (j - 1) * a.s * 0.7, cy + a.s * (1.45 + (j === 1 ? 0.15 : 0)), cwz + perpZ * (j - 1) * a.s * 0.7],
          s: a.s * (j === 1 ? 1.0 : 0.8),
        });
      }
    }

    // lantern strings — sagging rope + lanterns along
    const ropes: TubeGeometry[] = [];
    const lanterns: [number, number, number][] = [];
    for (const st of bv.strings) {
      const a = W(st.a);
      const b = W(st.b);
      const mid = a.clone().add(b).multiplyScalar(0.5).add(new Vector3(0, -a.distanceTo(b) * 0.16, 0));
      const curve = new QuadraticBezierCurve3(a, mid, b);
      ropes.push(new TubeGeometry(curve, 12, radius * 0.012, 4, false));
      for (const t of [0.2, 0.4, 0.6, 0.8]) {
        const p = curve.getPoint(t);
        lanterns.push([p.x, p.y - radius * 0.04, p.z]);
      }
    }

    // chimney smoke + fireflies
    const puffs: Puff[] = [];
    for (const c of bv.chimneys) {
      const base = W(c);
      for (let k = 0; k < 4; k++) puffs.push({ base, speed: 0.18 + rng() * 0.1, phase: k * 0.25 + rng() * 0.1 });
    }
    const fireflies: Firefly[] = bv.fireflies.flatMap((c) => {
      const w = W(c);
      return Array.from({ length: Math.max(2, Math.round(4 * pscale)) }, () => ({
        c: w,
        r: 0.6 + rng() * 1.4,
        speed: (0.25 + rng() * 0.3) * (rng() < 0.5 ? 1 : -1),
        phase: rng() * Math.PI * 2,
      }));
    });

    // surface petals drifting downstream
    const petals: Petal[] = Array.from({ length: Math.max(6, Math.round(16 * pscale)) }, () => ({
      i0: Math.floor(rng() * (streamPtsW.length - 1)),
      speed: 0.04 + rng() * 0.05,
      phase: rng(),
    }));

    return { roots, moss, streamGeo, streamLip, streamDir: bv.stream.dir, streamPtsW, archParts, ropes, lanterns, puffs, fireflies, petals, ix, iy, iz, islandPos: [ix, iy, iz] as [number, number, number], radius };
  }, [island, geom]);

  useFrame((st) => {
    const t = st.clock.elapsedTime;

    const fly = fireflyRef.current;
    if (fly) {
      for (let i = 0; i < v.fireflies.length; i++) {
        const f = v.fireflies[i];
        const a = f.phase + t * f.speed;
        const blink = 0.5 + 0.5 * Math.sin(t * 3 + f.phase * 5);
        tmpV.set(f.c.x + Math.cos(a) * f.r, f.c.y + Math.sin(t * 0.8 + f.phase) * 0.4, f.c.z + Math.sin(a) * f.r);
        tmpM.compose(tmpV, tmpQ.identity(), tmpS.setScalar(0.5 + blink));
        fly.setMatrixAt(i, tmpM);
      }
      fly.instanceMatrix.needsUpdate = true;
    }

    const sm = smokeRef.current;
    if (sm) {
      for (let i = 0; i < v.puffs.length; i++) {
        const p = v.puffs[i];
        const cyc = (t * p.speed + p.phase) % 1;
        const sc = Math.max(0.001, (0.3 + cyc * 1.1) * (1 - cyc) * 1.6);
        tmpV.set(p.base.x + Math.sin(t * 0.5 + p.phase * 6) * cyc * 0.8, p.base.y + cyc * 4.0, p.base.z + Math.cos(t * 0.4 + p.phase * 6) * cyc * 0.5);
        tmpM.compose(tmpV, tmpQ.identity(), tmpS.setScalar(sc));
        sm.setMatrixAt(i, tmpM);
      }
      sm.instanceMatrix.needsUpdate = true;
    }

    const pe = petalRef.current;
    if (pe) {
      const pts = v.streamPtsW;
      for (let i = 0; i < v.petals.length; i++) {
        const pl = v.petals[i];
        const prog = (pl.phase + t * pl.speed) % 1;
        const f = prog * (pts.length - 1);
        const i0 = Math.floor(f);
        const frac = f - i0;
        const a = pts[i0];
        const b = pts[Math.min(pts.length - 1, i0 + 1)];
        tmpV.set(a.x + (b.x - a.x) * frac, a.y + Math.sin(t * 2 + i) * 0.03, a.z + (b.z - a.z) * frac);
        tmpQ.setFromAxisAngle(UP, t + i);
        tmpM.compose(tmpV, tmpQ, tmpS.setScalar(1));
        pe.setMatrixAt(i, tmpM);
      }
      pe.instanceMatrix.needsUpdate = true;
    }
  });

  const barkMat = getToonMaterial("vale-root", { color: "#5a4636", flatShading: true, rimStrength: 0.3, grain: 0.14 });
  const mossMat = getToonMaterial("vale-moss", { color: "#4e7a44", flatShading: true, rimStrength: 0.3 });
  const trunkMat = getToonMaterial("vale-trunk", { color: "#6b4a3a", flatShading: true, rimStrength: 0.3 });
  const blossomMat = getToonMaterial("vale-blossom", { color: "#ffb7c5", flatShading: true, rimColor: "#ffe0ec", rimStrength: 0.5 });
  const ropeMat = getToonMaterial("vale-rope", { color: "#7a6a52", rimStrength: 0.2 });

  return (
    <group>
      {/* root cradle + moss */}
      {v.roots.map((g, i) => (
        <mesh key={`root-${i}`} geometry={g} material={barkMat} castShadow />
      ))}
      {v.moss.map((m, i) => (
        <mesh key={`moss-${i}`} geometry={mossGeo} material={mossMat} position={[m.pos.x, m.pos.y, m.pos.z]} scale={[m.s, m.s * 0.5, m.s]} />
      ))}

      {/* memory stream (planar reflector) + waterfall + drifting petals */}
      <mesh geometry={v.streamGeo} rotation={[0, 0, 0]}>
        <MeshReflectorMaterial
          resolution={256}
          mixBlur={1}
          mixStrength={2.4}
          blur={[120, 50]}
          minDepthThreshold={0.2}
          maxDepthThreshold={1.2}
          color="#dbeaf0"
          metalness={0.25}
          roughness={0.5}
        />
      </mesh>
      <Waterfall lip={v.streamLip} dir={v.streamDir} style="water" />
      <instancedMesh ref={petalRef} args={[petalGeo, petalMat, v.petals.length]} frustumCulled={false} renderOrder={6} />

      {/* sakura archways */}
      {v.archParts.trunks.map((tk, i) => (
        <mesh key={`at-${i}`} geometry={trunkGeo} material={trunkMat} position={tk.pos} rotation={tk.rot} scale={tk.scale} castShadow />
      ))}
      {v.archParts.blossoms.map((bl, i) => (
        <mesh key={`ab-${i}`} geometry={blossomGeo} material={blossomMat} position={bl.pos} scale={[bl.s * 1.25, bl.s, bl.s * 1.25]} castShadow />
      ))}

      {/* paper-lantern strings */}
      {v.ropes.map((g, i) => (
        <mesh key={`rope-${i}`} geometry={g} material={ropeMat} />
      ))}
      {v.lanterns.length > 0 && (
        <instancedMesh
          args={[lanternGeo, lanternMat, v.lanterns.length]}
          ref={(m) => {
            if (!m) return;
            v.lanterns.forEach((p, i) => {
              tmpM.compose(tmpV.set(p[0], p[1], p[2]), tmpQ.identity(), tmpS.set(1, 1.3, 1));
              m.setMatrixAt(i, tmpM);
            });
            m.instanceMatrix.needsUpdate = true;
          }}
          frustumCulled={false}
        />
      )}

      {/* chimney smoke + fireflies */}
      <instancedMesh ref={smokeRef} args={[smokeGeo, smokeMat, Math.max(1, v.puffs.length)]} frustumCulled={false} renderOrder={5} />
      <instancedMesh ref={fireflyRef} args={[fireflyGeo, fireflyMat, Math.max(1, v.fireflies.length)]} frustumCulled={false} />
    </group>
  );
}

/** Blossom Vale re-skin for the Relationship Kingdom (island-scoped, visual). */
export default function RelationshipLayer({ built }: { built: BuiltIsland[] }) {
  const vales = built.filter(
    (b) => !b.island.locked && CORE_KINGDOM_IDS.includes(b.island.id as CoreKingdomId) && b.island.id === "relationships"
  );
  if (vales.length === 0) return null;
  return (
    <group>
      {vales.map((b) => (
        <Vale key={b.island.id} {...b} />
      ))}
    </group>
  );
}
