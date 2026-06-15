"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import {
  BoxGeometry,
  CircleGeometry,
  ConeGeometry,
  CylinderGeometry,
  Euler,
  Group,
  MeshStandardMaterial,
  OctahedronGeometry,
  Quaternion,
  SphereGeometry,
  TorusGeometry,
  Vector3,
} from "three";
import type { BuiltIsland } from "@/components/canvas/WorldGraph";
import { CORE_KINGDOM_IDS, type CoreKingdomId } from "@/engine/schema/world";
import { islandRadius } from "@/engine/resolver/layout";
import { SIZE_SCALE, SLOT_MAPS } from "@/engine/resolver/slots";
import { slotLocalXZ } from "@/engine/resolver/resolve";
import InstancedPool, { type PoolInstance } from "@/components/canvas/InstancedPool";

const colGeo = new CylinderGeometry(1, 1, 1, 16);
const boxGeo = new BoxGeometry(1, 1, 1);
const domeGeo = new SphereGeometry(1, 28, 16, 0, Math.PI * 2, 0, Math.PI * 0.5);
const coneGeo = new ConeGeometry(1, 1, 18);
const lensGeo = new CircleGeometry(1, 24);
const sphereGeo = new SphereGeometry(0.5, 14, 10);
const torusGeo = new TorusGeometry(1, 0.13, 10, 24);
const octaGeo = new OctahedronGeometry(0.5, 0);

const stoneMat = new MeshStandardMaterial({ color: "#ffffff", metalness: 0.06, roughness: 0.72 });
const metalMat = new MeshStandardMaterial({ color: "#ffffff", metalness: 0.85, roughness: 0.32 });
const roadMat = new MeshStandardMaterial({ color: "#c3b89c", metalness: 0, roughness: 0.95 });
const lensMat = new MeshStandardMaterial({ color: "#23406e", metalness: 0.4, roughness: 0.1, emissive: "#16314f", emissiveIntensity: 0.45 });
const teleBrass = new MeshStandardMaterial({ color: "#b8893a", metalness: 0.95, roughness: 0.32 });
const teleWhite = new MeshStandardMaterial({ color: "#ece7dd", metalness: 0.25, roughness: 0.5 });
const teleDark = new MeshStandardMaterial({ color: "#2a2c30", metalness: 0.6, roughness: 0.45 });

const MARBLE = "#ece7da";
const MARBLE_SH = "#cdc6b3";
const VERDIGRIS = "#7fa597";
const TERRACOTTA = "#b5673f";
const GOLD = "#c9a24a";
const METALDOME = "#9aa3a8";

type Euler3 = [number, number, number];
const UP = new Vector3(0, 1, 0);
const tmpQ = new Quaternion();
const tmpE = new Euler();

interface Leg { pos: [number, number, number]; rot: Euler3; len: number }

function Academy({ island, geom }: BuiltIsland) {
  const panRef = useRef<Group>(null);

  const v = useMemo(() => {
    const radius = islandRadius(island);
    const [ix, iy, iz] = island.position;
    const at = (lx: number, lz: number): number => iy + geom.capHeightAt(lx, lz);

    const stone = { col: [] as PoolInstance[], box: [] as PoolInstance[], dome: [] as PoolInstance[], cone: [] as PoolInstance[] };
    const metal = { col: [] as PoolInstance[], cone: [] as PoolInstance[] };
    const roads: PoolInstance[] = [];
    const lenses: { pos: [number, number, number]; rot: Euler3; s: number }[] = [];

    // current building frame (center + yaw so local +Z faces island centre)
    let BX = 0, BY = 0, BZ = 0, BC = 1, BS = 0, BYAW = 0;
    const setB = (cx: number, by: number, cz: number, yaw: number): void => { BX = cx; BY = by; BZ = cz; BC = Math.cos(yaw); BS = Math.sin(yaw); BYAW = yaw; };
    const wp = (dx: number, dy: number, dz: number): [number, number, number] => [BX + dx * BC + dz * BS, BY + dy, BZ - dx * BS + dz * BC];
    const sCol = (dx: number, dy: number, dz: number, rot: Euler3, sc: [number, number, number], c: string): void => { stone.col.push({ position: wp(dx, dy, dz), rotation: [rot[0], rot[1] + BYAW, rot[2]], scale: sc, color: c }); };
    const sBox = (dx: number, dy: number, dz: number, rot: Euler3, sc: [number, number, number], c: string): void => { stone.box.push({ position: wp(dx, dy, dz), rotation: [rot[0], rot[1] + BYAW, rot[2]], scale: sc, color: c }); };
    const sDome = (dx: number, dy: number, dz: number, sc: [number, number, number], c: string): void => { stone.dome.push({ position: wp(dx, dy, dz), rotation: [0, BYAW, 0], scale: sc, color: c }); };
    const mCone = (dx: number, dy: number, dz: number, rot: Euler3, sc: [number, number, number], c: string): void => { metal.cone.push({ position: wp(dx, dy, dz), rotation: [rot[0], rot[1] + BYAW, rot[2]], scale: sc, color: c }); };
    const mCol = (dx: number, dy: number, dz: number, rot: Euler3, sc: [number, number, number], c: string): void => { metal.col.push({ position: wp(dx, dy, dz), rotation: [rot[0], rot[1] + BYAW, rot[2]], scale: sc, color: c }); };

    // front-facing colonnade row (spans local X at local dz)
    const colonnade = (dz: number, dy: number, count: number, gap: number, h: number, cr: number): void => {
      for (let i = 0; i < count; i++) {
        const o = (i - (count - 1) / 2) * gap;
        sBox(o, dy + 0.06 * h, dz, [0, 0, 0], [cr * 2.6, 0.12 * h, cr * 2.6], MARBLE_SH);
        sCol(o, dy + 0.5 * h, dz, [0, 0, 0], [cr, h, cr], MARBLE);
        sBox(o, dy + 0.96 * h, dz, [0, 0, 0], [cr * 2.6, 0.12 * h, cr * 2.6], MARBLE_SH);
      }
    };

    const university = (S: number): void => {
      sBox(0, S * 0.05, 0, [0, 0, 0], [S * 3.0, S * 0.1, S * 2.1], MARBLE_SH);
      sBox(0, S * 0.75, 0, [0, 0, 0], [S * 2.4, S * 1.1, S * 1.5], MARBLE);
      colonnade(S * 0.85, S * 0.2, 7, S * 0.33, S * 1.0, S * 0.09);
      sBox(0, S * 1.28, S * 0.85, [0, 0, 0], [S * 2.55, S * 0.16, S * 0.3], MARBLE_SH);
      sBox(0, S * 1.5, S * 0.85, [0, 0, 0], [S * 1.5, S * 0.46, S * 0.16], MARBLE);
      sBox(-S * 0.56, S * 1.56, S * 0.85, [0, 0, 0.5], [S * 1.0, S * 0.1, S * 0.28], MARBLE_SH);
      sBox(S * 0.56, S * 1.56, S * 0.85, [0, 0, -0.5], [S * 1.0, S * 0.1, S * 0.28], MARBLE_SH);
      // central dome
      const d = S * 1.3;
      sCol(0, d + S * 0.4, 0, [0, 0, 0], [S * 0.85, S * 0.82, S * 0.85], MARBLE);
      for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2; sCol(Math.cos(a) * S * 0.85, d + S * 0.4, Math.sin(a) * S * 0.85, [0, 0, 0], [S * 0.055, S * 0.82, S * 0.055], MARBLE_SH); }
      sCol(0, d + S * 0.83, 0, [0, 0, 0], [S * 0.92, S * 0.07, S * 0.92], GOLD);
      sDome(0, d + S * 0.85, 0, [S * 0.86, S * 0.82, S * 0.86], VERDIGRIS);
      sCol(0, d + S * 1.7, 0, [0, 0, 0], [S * 0.26, S * 0.28, S * 0.26], MARBLE);
      sDome(0, d + S * 1.83, 0, [S * 0.26, S * 0.24, S * 0.26], VERDIGRIS);
      mCone(0, d + S * 2.13, 0, [0, 0, 0], [S * 0.1, S * 0.26, S * 0.1], GOLD);
      mCol(0, d + S * 2.38, 0, [0, 0, 0], [S * 0.028, S * 0.26, S * 0.028], GOLD);
      mCol(0, d + S * 2.44, 0, [0, 0, Math.PI / 2], [S * 0.028, S * 0.16, S * 0.028], GOLD);
      for (const sx of [-1, 1] as const) { sCol(sx * S * 1.05, S * 1.0, -S * 0.3, [0, 0, 0], [S * 0.36, S * 0.5, S * 0.36], MARBLE); sDome(sx * S * 1.05, S * 1.25, -S * 0.3, [S * 0.38, S * 0.36, S * 0.38], VERDIGRIS); }
    };

    const library = (S: number): void => {
      sBox(0, S * 0.06, 0, [0, 0, 0], [S * 2.3, S * 0.12, S * 1.6], MARBLE_SH);
      sBox(0, S * 0.7, 0, [0, 0, 0], [S * 1.9, S * 1.05, S * 1.25], MARBLE);
      colonnade(S * 0.72, S * 0.18, 5, S * 0.34, S * 0.95, S * 0.085);
      sBox(0, S * 1.2, S * 0.72, [0, 0, 0], [S * 2.0, S * 0.15, S * 0.3], MARBLE_SH);
      sBox(-S * 0.46, S * 1.44, S * 0.72, [0, 0, 0.5], [S * 0.85, S * 0.1, S * 0.28], TERRACOTTA);
      sBox(S * 0.46, S * 1.44, S * 0.72, [0, 0, -0.5], [S * 0.85, S * 0.1, S * 0.28], TERRACOTTA);
      sBox(0, S * 1.44, -S * 0.05, [0.5, 0, 0], [S * 1.95, S * 0.1, S * 0.9], TERRACOTTA);
      sBox(0, S * 1.44, -S * 0.05, [-0.5, 0, 0], [S * 1.95, S * 0.1, S * 0.9], TERRACOTTA);
      sCol(0, S * 1.4, -S * 0.05, [0, 0, 0], [S * 0.46, S * 0.5, S * 0.46], MARBLE);
      sDome(0, S * 1.64, -S * 0.05, [S * 0.48, S * 0.46, S * 0.48], MARBLE_SH);
      mCone(0, S * 1.98, -S * 0.05, [0, 0, 0], [S * 0.08, S * 0.24, S * 0.08], GOLD);
    };

    const observatory = (S: number): void => {
      sBox(0, S * 0.06, 0, [0, 0, 0], [S * 1.8, S * 0.12, S * 1.8], MARBLE_SH);
      sCol(0, S * 0.5, 0, [0, 0, 0], [S * 0.85, S * 1.0, S * 0.85], MARBLE);
      sBox(0, S * 0.45, S * 0.82, [0, 0, 0], [S * 0.3, S * 0.7, S * 0.1], MARBLE_SH);
      sDome(0, S * 1.0, 0, [S * 0.9, S * 0.66, S * 0.9], METALDOME);
      sBox(0, S * 1.2, S * 0.5, [0.5, 0, 0], [S * 0.2, S * 0.85, S * 0.06], "#2a2e30"); // slit
    };

    // ---- placement: 4 separated clear spots, fronts facing centre ---------
    const slots = SLOT_MAPS[island.id as CoreKingdomId] ?? [];
    const avoid = island.structures.map((sm) => { const sl = slots[sm.slot % slots.length]; const { x, z } = slotLocalXZ(geom, sl); return { x, z, r: 2.2 * SIZE_SCALE[sl.size] }; });
    const chosen: { x: number; z: number }[] = [];
    const rFracs = [0.3, 0.52, 0.58, 0.56];
    const sizes = [radius * 0.26, radius * 0.2, radius * 0.18, radius * 0.32];
    for (let k = 0; k < 4; k++) {
      for (let i = 0; i < 20; i++) {
        const theta = (i / 20) * Math.PI * 2 + k * 1.1 + 0.3;
        const f = geom.footprintAt(theta);
        const lx = Math.cos(theta) * f * rFracs[k];
        const lz = Math.sin(theta) * f * rFracs[k];
        if (avoid.some((a) => Math.hypot(lx - a.x, lz - a.z) < a.r + sizes[k])) continue;
        if (chosen.some((c) => Math.hypot(lx - c.x, lz - c.z) < radius * 0.34)) continue;
        chosen.push({ x: lx, z: lz });
        break;
      }
    }
    while (chosen.length < 4) chosen.push({ x: 0, z: 0 });

    const yawTo = (lx: number, lz: number): number => Math.atan2(-lx, -lz); // local +Z → island centre

    setB(ix + chosen[0].x, at(chosen[0].x, chosen[0].z), iz + chosen[0].z, yawTo(chosen[0].x, chosen[0].z));
    university(sizes[0]);
    setB(ix + chosen[1].x, at(chosen[1].x, chosen[1].z), iz + chosen[1].z, yawTo(chosen[1].x, chosen[1].z));
    library(sizes[1]);
    setB(ix + chosen[2].x, at(chosen[2].x, chosen[2].z), iz + chosen[2].z, yawTo(chosen[2].x, chosen[2].z));
    observatory(sizes[2]);

    // ---- standalone telescope (spot 4), safe distance, gently panning -----
    const tS = sizes[3];
    const tx = chosen[3].x;
    const tz = chosen[3].z;
    const teleBase: [number, number, number] = [ix + tx, at(tx, tz), iz + tz];
    const hubY = tS * 0.72;
    const legs: Leg[] = [];
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2 + 0.5;
      const foot = new Vector3(Math.cos(a) * tS * 0.42, 0, Math.sin(a) * tS * 0.42);
      const top = new Vector3(0, hubY, 0);
      const dir = foot.clone().sub(top);
      const len = dir.length();
      tmpQ.setFromUnitVectors(UP, dir.normalize());
      tmpE.setFromQuaternion(tmpQ);
      legs.push({ pos: [(foot.x) / 2, (foot.y + top.y) / 2, (foot.z) / 2], rot: [tmpE.x, tmpE.y, tmpE.z], len });
    }

    // ---- roads link buildings + telescope + centre + a ring ---------------
    const link = (ax: number, az: number, bx: number, bz: number): void => {
      const dx = bx - ax; const dz = bz - az; const len = Math.hypot(dx, dz);
      if (len < 0.5) return;
      roads.push({ position: [ix + (ax + bx) / 2, (at(ax, az) + at(bx, bz)) / 2 + 0.05, iz + (az + bz) / 2], rotation: [0, -Math.atan2(dz, dx), 0], scale: [len, radius * 0.012, radius * 0.07], color: "#c3b89c" });
    };
    for (const c of chosen) link(c.x, c.z, 0, 0);
    link(chosen[0].x, chosen[0].z, chosen[1].x, chosen[1].z);
    link(chosen[2].x, chosen[2].z, chosen[3].x, chosen[3].z);
    const ringN = 12;
    for (let i = 0; i < ringN; i++) {
      const t0 = (i / ringN) * Math.PI * 2; const t1 = ((i + 1) / ringN) * Math.PI * 2;
      const f0 = geom.footprintAt(t0) * 0.66; const f1 = geom.footprintAt(t1) * 0.66;
      link(Math.cos(t0) * f0, Math.sin(t0) * f0, Math.cos(t1) * f1, Math.sin(t1) * f1);
    }

    return { stone, metal, roads, lenses, teleBase, tS, hubY, legs };
  }, [island, geom]);

  useFrame((st) => {
    if (panRef.current) panRef.current.rotation.y = Math.sin(st.clock.elapsedTime * 0.18) * 0.5;
  });

  const S = v.tS;

  return (
    <group>
      <InstancedPool geometry={boxGeo} material={roadMat} instances={v.roads} receiveShadow />
      <InstancedPool geometry={colGeo} material={stoneMat} instances={v.stone.col} castShadow receiveShadow />
      <InstancedPool geometry={boxGeo} material={stoneMat} instances={v.stone.box} castShadow receiveShadow />
      <InstancedPool geometry={domeGeo} material={stoneMat} instances={v.stone.dome} castShadow receiveShadow />
      <InstancedPool geometry={coneGeo} material={stoneMat} instances={v.stone.cone} castShadow />
      <InstancedPool geometry={colGeo} material={metalMat} instances={v.metal.col} castShadow />
      <InstancedPool geometry={coneGeo} material={metalMat} instances={v.metal.cone} castShadow />
      {v.lenses.map((l, i) => (
        <mesh key={i} geometry={lensGeo} material={lensMat} position={l.pos} rotation={l.rot} scale={[l.s, l.s, 1]} />
      ))}

      {/* standalone telescope */}
      <group position={v.teleBase}>
        {v.legs.map((leg, i) => (
          <mesh key={i} geometry={colGeo} material={teleDark} position={leg.pos} rotation={leg.rot} scale={[S * 0.05, leg.len, S * 0.05]} castShadow />
        ))}
        <mesh geometry={colGeo} material={teleBrass} position={[0, v.hubY, 0]} scale={[S * 0.16, S * 0.12, S * 0.16]} castShadow />
        <group ref={panRef} position={[0, v.hubY, 0]}>
          <mesh geometry={boxGeo} material={teleDark} position={[0, S * 0.08, 0]} scale={[S * 0.22, S * 0.18, S * 0.22]} castShadow />
          <mesh geometry={colGeo} material={teleBrass} position={[0, S * 0.08, -S * 0.28]} rotation={[Math.PI / 2, 0, 0]} scale={[S * 0.04, S * 0.5, S * 0.04]} />
          <mesh geometry={sphereGeo} material={teleDark} position={[0, S * 0.08, -S * 0.52]} scale={[S * 0.18, S * 0.18, S * 0.18]} castShadow />
          <group rotation={[-0.92, 0, 0]} position={[0, S * 0.14, 0]}>
            <mesh geometry={colGeo} material={teleWhite} position={[0, S * 0.42, 0]} scale={[S * 0.13, S * 0.95, S * 0.13]} castShadow />
            <mesh geometry={colGeo} material={teleBrass} position={[0, S * 0.18, 0]} scale={[S * 0.145, S * 0.07, S * 0.145]} />
            <mesh geometry={colGeo} material={teleBrass} position={[0, S * 0.66, 0]} scale={[S * 0.145, S * 0.07, S * 0.145]} />
            <mesh geometry={torusGeo} material={teleBrass} position={[0, S * 0.9, 0]} rotation={[Math.PI / 2, 0, 0]} scale={[S * 0.15, S * 0.15, S * 0.15]} />
            <mesh geometry={lensGeo} material={lensMat} position={[0, S * 0.9, 0]} rotation={[-Math.PI / 2, 0, 0]} scale={[S * 0.14, S * 0.14, 1]} />
            <mesh geometry={colGeo} material={teleDark} position={[0, S * 0.02, S * 0.12]} rotation={[Math.PI / 2, 0, 0]} scale={[S * 0.07, S * 0.18, S * 0.07]} />
            <mesh geometry={colGeo} material={teleBrass} position={[0, S * 0.02, S * 0.24]} rotation={[Math.PI / 2, 0, 0]} scale={[S * 0.05, S * 0.14, S * 0.05]} />
            <mesh geometry={octaGeo} material={teleBrass} position={[S * 0.1, S * 0.08, S * 0.1]} scale={[S * 0.05, S * 0.05, S * 0.05]} />
            <mesh geometry={octaGeo} material={teleBrass} position={[-S * 0.1, S * 0.08, S * 0.1]} scale={[S * 0.05, S * 0.05, S * 0.05]} />
            <mesh geometry={colGeo} material={teleBrass} position={[S * 0.18, S * 0.55, 0]} scale={[S * 0.04, S * 0.4, S * 0.04]} />
          </group>
        </group>
      </group>
    </group>
  );
}

/** Learning academy: Vatican-style university, library, observatory + telescope + roads. */
export default function LearningLayer({ built }: { built: BuiltIsland[] }) {
  const isles = built.filter(
    (b) => !b.island.locked && CORE_KINGDOM_IDS.includes(b.island.id as CoreKingdomId) && b.island.id === "learning"
  );
  if (isles.length === 0) return null;
  return (
    <group>
      {isles.map((b) => (
        <Academy key={b.island.id} {...b} />
      ))}
    </group>
  );
}
