"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import {
  BoxGeometry,
  CircleGeometry,
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

const cylGeo = new CylinderGeometry(0.5, 0.5, 1, 16);
const boxGeo = new BoxGeometry(1, 1, 1);
const torusGeo = new TorusGeometry(1, 0.14, 12, 28);
const discGeo = new CircleGeometry(1, 28);
const sphereGeo = new SphereGeometry(0.5, 14, 10);
const octaGeo = new OctahedronGeometry(0.5, 0);

const brassMat = new MeshStandardMaterial({ color: "#b8893a", metalness: 0.95, roughness: 0.32 });
const brassDark = new MeshStandardMaterial({ color: "#7d5d24", metalness: 0.9, roughness: 0.4 });
const tubeMat = new MeshStandardMaterial({ color: "#ece7dd", metalness: 0.25, roughness: 0.5 });
const darkMat = new MeshStandardMaterial({ color: "#2a2c30", metalness: 0.6, roughness: 0.45 });
const lensMat = new MeshStandardMaterial({ color: "#23406e", metalness: 0.4, roughness: 0.08, emissive: "#16314f", emissiveIntensity: 0.5 });

const UP = new Vector3(0, 1, 0);
const tmpQ = new Quaternion();
const tmpE = new Euler();

interface Leg {
  pos: [number, number, number];
  rot: [number, number, number];
  len: number;
}

function Telescope({ island, geom }: BuiltIsland) {
  const panRef = useRef<Group>(null);

  const v = useMemo(() => {
    const radius = islandRadius(island);
    const [ix, iy, iz] = island.position;
    // pick a clear spot away from the placed structures
    const slots = SLOT_MAPS[island.id as CoreKingdomId] ?? [];
    const avoid = island.structures.map((s) => {
      const sl = slots[s.slot % slots.length];
      const { x, z } = slotLocalXZ(geom, sl);
      return { x, z, r: 2.2 * SIZE_SCALE[sl.size] };
    });
    let lx = 0;
    let lz = 0;
    for (let i = 0; i < 12; i++) {
      const theta = (i / 12) * Math.PI * 2 + 0.4;
      const f = geom.footprintAt(theta);
      const cx = Math.cos(theta) * f * 0.46;
      const cz = Math.sin(theta) * f * 0.46;
      if (!avoid.some((a) => Math.hypot(cx - a.x, cz - a.z) < a.r + radius * 0.18)) {
        lx = cx;
        lz = cz;
        break;
      }
    }
    const base: [number, number, number] = [ix + lx, iy + geom.capHeightAt(lx, lz), iz + lz];
    const S = radius * 0.34; // overall size
    const hubY = S * 0.72;

    // tripod legs
    const legs: Leg[] = [];
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2 + 0.5;
      const foot = new Vector3(Math.cos(a) * S * 0.42, 0, Math.sin(a) * S * 0.42);
      const top = new Vector3(0, hubY, 0);
      const dir = foot.clone().sub(top);
      const len = dir.length();
      tmpQ.setFromUnitVectors(UP, dir.normalize());
      tmpE.setFromQuaternion(tmpQ);
      legs.push({ pos: [(foot.x + top.x) / 2, (foot.y + top.y) / 2, (foot.z + top.z) / 2], rot: [tmpE.x, tmpE.y, tmpE.z], len });
    }

    return { base, S, hubY, legs };
  }, [island, geom]);

  useFrame((st) => {
    const t = st.clock.elapsedTime;
    if (panRef.current) panRef.current.rotation.y = Math.sin(t * 0.18) * 0.5;
  });

  const S = v.S;

  return (
    <group position={v.base}>
      {/* tripod legs + feet */}
      {v.legs.map((leg, i) => (
        <group key={i}>
          <mesh geometry={cylGeo} material={darkMat} position={leg.pos} rotation={leg.rot} scale={[S * 0.05, leg.len, S * 0.05]} castShadow />
        </group>
      ))}
      <mesh geometry={cylGeo} material={brassDark} position={[0, v.hubY, 0]} scale={[S * 0.16, S * 0.12, S * 0.16]} castShadow />

      {/* azimuth pan head */}
      <group ref={panRef} position={[0, v.hubY, 0]}>
        <mesh geometry={boxGeo} material={darkMat} position={[0, S * 0.08, 0]} scale={[S * 0.22, S * 0.18, S * 0.22]} castShadow />
        {/* counterweight bar + weight */}
        <mesh geometry={cylGeo} material={brassMat} position={[0, S * 0.08, -S * 0.28]} rotation={[Math.PI / 2, 0, 0]} scale={[S * 0.04, S * 0.5, S * 0.04]} />
        <mesh geometry={sphereGeo} material={darkMat} position={[0, S * 0.08, -S * 0.52]} scale={[S * 0.18, S * 0.18, S * 0.18]} castShadow />

        {/* elevation: the optical assembly tilted up at the sky */}
        <group rotation={[-0.92, 0, 0]} position={[0, S * 0.14, 0]}>
          {/* main optical tube (white body + brass rings) */}
          <mesh geometry={cylGeo} material={tubeMat} position={[0, S * 0.42, 0]} scale={[S * 0.13, S * 0.95, S * 0.13]} castShadow />
          <mesh geometry={cylGeo} material={brassMat} position={[0, S * 0.18, 0]} scale={[S * 0.145, S * 0.07, S * 0.145]} />
          <mesh geometry={cylGeo} material={brassMat} position={[0, S * 0.66, 0]} scale={[S * 0.145, S * 0.07, S * 0.145]} />
          {/* objective cell + lens (front, up) */}
          <mesh geometry={torusGeo} material={brassMat} position={[0, S * 0.9, 0]} rotation={[Math.PI / 2, 0, 0]} scale={[S * 0.15, S * 0.15, S * 0.15]} />
          <mesh geometry={discGeo} material={lensMat} position={[0, S * 0.9, 0]} rotation={[-Math.PI / 2, 0, 0]} scale={[S * 0.14, S * 0.14, 1]} />
          {/* focuser + eyepiece (back, down) */}
          <mesh geometry={cylGeo} material={darkMat} position={[0, S * 0.02, S * 0.12]} rotation={[Math.PI / 2, 0, 0]} scale={[S * 0.07, S * 0.18, S * 0.07]} />
          <mesh geometry={cylGeo} material={brassDark} position={[0, S * 0.02, S * 0.24]} rotation={[Math.PI / 2, 0, 0]} scale={[S * 0.05, S * 0.14, S * 0.05]} />
          {/* focuser knobs */}
          <mesh geometry={octaGeo} material={brassMat} position={[S * 0.1, S * 0.08, S * 0.1]} scale={[S * 0.05, S * 0.05, S * 0.05]} />
          <mesh geometry={octaGeo} material={brassMat} position={[-S * 0.1, S * 0.08, S * 0.1]} scale={[S * 0.05, S * 0.05, S * 0.05]} />
          {/* finderscope (small parallel tube) */}
          <mesh geometry={cylGeo} material={brassMat} position={[S * 0.18, S * 0.55, 0]} scale={[S * 0.04, S * 0.4, S * 0.04]} />
          <mesh geometry={cylGeo} material={darkMat} position={[S * 0.18, S * 0.36, 0]} scale={[S * 0.02, S * 0.12, S * 0.02]} />
        </group>
      </group>
    </group>
  );
}

/** A detailed refractor telescope on the Learning island (island-scoped). */
export default function LearningLayer({ built }: { built: BuiltIsland[] }) {
  const isles = built.filter(
    (b) => !b.island.locked && CORE_KINGDOM_IDS.includes(b.island.id as CoreKingdomId) && b.island.id === "learning"
  );
  if (isles.length === 0) return null;
  return (
    <group>
      {isles.map((b) => (
        <Telescope key={b.island.id} {...b} />
      ))}
    </group>
  );
}
