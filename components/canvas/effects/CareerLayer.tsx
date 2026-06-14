"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import {
  BoxGeometry,
  Color,
  ConeGeometry,
  CylinderGeometry,
  IcosahedronGeometry,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  OctahedronGeometry,
  Quaternion,
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
import InstancedPool from "@/components/canvas/InstancedPool";
import { buildSkyline, type BKind } from "@/engine/generation/structures/career";

const highwayGeo = new TorusGeometry(1, 0.025, 8, 64);
const dataGeo = new BoxGeometry(1, 1, 0.08); // thin holographic chip
const steamGeo = new IcosahedronGeometry(1, 0);
const trunkGeo = new CylinderGeometry(0.7, 0.85, 1, 6);
const leafGeo = new OctahedronGeometry(1, 0); // stamped silver leaf

const SKY_GEO: Record<BKind, BoxGeometry | CylinderGeometry | ConeGeometry | OctahedronGeometry | SphereGeometry> = {
  box: new BoxGeometry(1, 1, 1),
  cyl: new CylinderGeometry(0.5, 0.5, 1, 12),
  cone: new ConeGeometry(0.5, 1, 8),
  octa: new OctahedronGeometry(0.6, 0),
  sphere: new SphereGeometry(0.5, 12, 10),
};
const SKY_KINDS: BKind[] = ["box", "cyl", "cone", "octa", "sphere"];
const cityGlowMat = new MeshBasicMaterial({ toneMapped: false });

const highwayMat = new MeshBasicMaterial({ color: new Color("#6fd8ff").multiplyScalar(1.5), toneMapped: false, transparent: true, opacity: 0.85 });
const dataMat = new MeshBasicMaterial({ color: new Color("#9fe6ff").multiplyScalar(1.4), toneMapped: false, transparent: true, opacity: 0.8, depthWrite: false });
const steamMat = new MeshBasicMaterial({ color: new Color("#f3f6fa"), transparent: true, opacity: 0.5, depthWrite: false });

const tmpM = new Matrix4();
const tmpQ = new Quaternion();
const tmpV = new Vector3();
const tmpS = new Vector3();

interface DataBit { x: number; z: number; baseY: number; rise: number; speed: number; phase: number; size: number }
interface Vent { x: number; y: number; z: number; phase: number }

function Career({ island, geom }: BuiltIsland) {
  const highwayRef = useRef<Mesh>(null);
  const dataRef = useRef<InstancedMesh>(null);
  const steamRef = useRef<InstancedMesh>(null);

  const v = useMemo(() => {
    const radius = islandRadius(island);
    const [ix, iy, iz] = island.position;
    const rng = mulberry32(0xca4ee7 ^ Math.round(radius * 100));
    const pscale = particleScale();

    // light highway: a glowing transit ring around the lower tier
    const ringR = radius * 0.78;
    const ringY = iy + geom.capHeightAt(ringR, 0) + 0.4;

    // holographic data / blueprint chips drifting up between the plazas
    const data: DataBit[] = Array.from({ length: Math.max(10, Math.round(46 * pscale)) }, () => {
      const a = rng() * Math.PI * 2;
      const r = Math.sqrt(rng()) * radius * 0.7;
      const x = Math.cos(a) * r;
      const z = Math.sin(a) * r;
      return {
        x: ix + x,
        z: iz + z,
        baseY: iy + geom.capHeightAt(x, z) + 1.5,
        rise: 5 + rng() * 5,
        speed: 0.05 + rng() * 0.08,
        phase: rng(),
        size: 0.28 + rng() * 0.34,
      };
    });

    // steam vents at a few tier seams (puff periodically)
    const vents: Vent[] = Array.from({ length: 4 }, () => {
      const a = rng() * Math.PI * 2;
      const r = radius * (0.4 + rng() * 0.35);
      const x = Math.cos(a) * r;
      const z = Math.sin(a) * r;
      return { x: ix + x, y: iy + geom.capHeightAt(x, z) + 0.1, z: iz + z, phase: rng() };
    });

    // silver arbors — metallic ornamental trees on the plazas
    const arbors: { x: number; y: number; z: number; h: number; leaves: { dx: number; dy: number; dz: number; s: number }[] }[] = [];
    for (let i = 0; i < Math.max(3, Math.round(6 * pscale)); i++) {
      const a = rng() * Math.PI * 2;
      const r = radius * (0.2 + rng() * 0.45);
      const x = Math.cos(a) * r;
      const z = Math.sin(a) * r;
      const h = radius * (0.12 + rng() * 0.06);
      const leaves = Array.from({ length: 5 }, () => ({
        dx: (rng() - 0.5) * h * 0.8,
        dy: h * (0.8 + rng() * 0.5),
        dz: (rng() - 0.5) * h * 0.8,
        s: h * (0.18 + rng() * 0.12),
      }));
      arbors.push({ x: ix + x, y: iy + geom.capHeightAt(x, z), z: iz + z, h, leaves });
    }

    const skyline = buildSkyline(island, geom, radius);

    return { ringR, ringY, ix, iz, data, vents, arbors, skyline };
  }, [island, geom]);

  useFrame((st) => {
    const t = st.clock.elapsedTime;

    if (highwayRef.current) highwayRef.current.rotation.z = t * 0.06;

    const d = dataRef.current;
    if (d) {
      for (let i = 0; i < v.data.length; i++) {
        const b = v.data[i];
        const p = (t * b.speed + b.phase) % 1;
        const fade = 1 - Math.max(0, (p - 0.6) / 0.4); // dissolve as it climbs
        tmpV.set(b.x + Math.sin(t * 0.5 + b.phase * 6) * 0.4, b.baseY + p * b.rise, b.z);
        tmpQ.setFromAxisAngle(tmpS.set(0, 1, 0), t * 0.5 + b.phase * 6);
        tmpM.compose(tmpV, tmpQ, tmpS.setScalar(Math.max(0.001, b.size * fade)));
        d.setMatrixAt(i, tmpM);
      }
      d.instanceMatrix.needsUpdate = true;
    }

    const sm = steamRef.current;
    if (sm) {
      const perVent = 4;
      for (let vi = 0; vi < v.vents.length; vi++) {
        const vent = v.vents[vi];
        for (let k = 0; k < perVent; k++) {
          const idx = vi * perVent + k;
          // periodic burst: each vent puffs for a short window, then rests
          const cycle = (t * 0.4 + vent.phase + k * 0.12) % 1;
          const env = cycle < 0.4 ? Math.sin((cycle / 0.4) * Math.PI) : 0;
          const sc = Math.max(0.001, (0.3 + cycle * 1.2) * env);
          tmpV.set(vent.x, vent.y + cycle * 3.2, vent.z);
          tmpM.compose(tmpV, tmpQ.identity(), tmpS.setScalar(sc));
          sm.setMatrixAt(idx, tmpM);
        }
      }
      sm.instanceMatrix.needsUpdate = true;
    }
  });

  const trunkMat = getToonMaterial("arbor-trunk", { color: "#3a2a20", flatShading: true, rimStrength: 0.3 });
  const silverMat = getToonMaterial("arbor-silver", { color: "#dfe6ec", flatShading: true, rimColor: "#ffffff", rimStrength: 0.65 });
  const cityMat = getToonMaterial("city-glass", { rimColor: "#cfe8ff", rimStrength: 0.42, grain: 0.05 });
  const roadMat = getToonMaterial("city-road", { color: "#ffffff", rimStrength: 0.08, grain: 0.04 });

  return (
    <group>
      {/* asphalt road network between the towers */}
      <InstancedPool geometry={SKY_GEO.box} material={roadMat} instances={v.skyline.roads} receiveShadow />
      <InstancedPool geometry={SKY_GEO.box} material={cityGlowMat} instances={v.skyline.roadGlow} />

      {/* the skyline — dense procedural skyscrapers across the tiers */}
      {SKY_KINDS.map((k) => (
        <InstancedPool key={`cb-${k}`} geometry={SKY_GEO[k]} material={cityMat} instances={v.skyline.body[k]} castShadow receiveShadow />
      ))}
      {SKY_KINDS.map((k) => (
        <InstancedPool key={`cg-${k}`} geometry={SKY_GEO[k]} material={cityGlowMat} instances={v.skyline.glow[k]} />
      ))}

      {/* glowing transit light-highway ring */}
      <mesh
        ref={highwayRef}
        geometry={highwayGeo}
        material={highwayMat}
        position={[v.ix, v.ringY, v.iz]}
        rotation={[Math.PI / 2, 0, 0]}
        scale={[v.ringR, v.ringR, v.ringR]}
      />

      {/* holographic data / blueprint chips */}
      <instancedMesh ref={dataRef} args={[dataGeo, dataMat, v.data.length]} frustumCulled={false} renderOrder={6} />

      {/* steam vents */}
      <instancedMesh ref={steamRef} args={[steamGeo, steamMat, v.vents.length * 4]} frustumCulled={false} renderOrder={5} />

      {/* silver arbors */}
      {v.arbors.map((ab, i) => (
        <group key={i} position={[ab.x, ab.y, ab.z]}>
          <mesh geometry={trunkGeo} material={trunkMat} position={[0, ab.h * 0.4, 0]} scale={[ab.h * 0.1, ab.h * 0.8, ab.h * 0.1]} castShadow />
          {ab.leaves.map((lf, j) => (
            <mesh key={j} geometry={leafGeo} material={silverMat} position={[lf.dx, lf.dy, lf.dz]} scale={lf.s} castShadow />
          ))}
        </group>
      ))}
    </group>
  );
}

/** Career metropolis dressing: light highway, data motes, steam, silver arbors. */
export default function CareerLayer({ built }: { built: BuiltIsland[] }) {
  const careers = built.filter(
    (b) => !b.island.locked && CORE_KINGDOM_IDS.includes(b.island.id as CoreKingdomId) && b.island.id === "career"
  );
  if (careers.length === 0) return null;
  return (
    <group>
      {careers.map((b) => (
        <Career key={b.island.id} {...b} />
      ))}
    </group>
  );
}
