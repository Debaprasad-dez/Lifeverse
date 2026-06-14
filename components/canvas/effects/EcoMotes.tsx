"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import {
  AdditiveBlending,
  Color,
  InstancedMesh,
  Matrix4,
  NormalBlending,
  PlaneGeometry,
  Quaternion,
  Vector3,
  MeshBasicMaterial,
} from "three";
import type { BuiltIsland } from "@/components/canvas/WorldGraph";
import { ECOSYSTEMS, type MoteTheme } from "@/engine/ecosystem";
import { CORE_KINGDOM_IDS, type CoreKingdomId } from "@/engine/schema/world";
import { islandRadius } from "@/engine/resolver/layout";
import { mulberry32, seedFrom } from "@/lib/noise";
import { particleScale } from "@/lib/quality";

const geo = new PlaneGeometry(1, 1);
const tmpM = new Matrix4();
const tmpQ = new Quaternion();
const tmpV = new Vector3();
const tmpS = new Vector3();
const tmpAxis = new Vector3(0.3, 1, 0.2).normalize();
const tmpC = new Color();

interface Mote {
  cx: number;
  cz: number;
  rx: number;
  rz: number;
  homeY: number;
  topY: number;
  bottomY: number;
  y: number;
  speed: number;
  drift: number;
  phase: number;
  spin: number;
  size: number;
  /** +1 rise, -1 fall, 0 drift-bob. */
  dir: number;
}

function buildMotes(built: BuiltIsland[], glow: boolean): { motes: Mote[]; colors: string[] } {
  const motes: Mote[] = [];
  const colors: string[] = [];
  const scale = particleScale();

  for (const b of built) {
    const { island, geom } = b;
    if (island.locked) continue;
    if (!CORE_KINGDOM_IDS.includes(island.id as CoreKingdomId)) continue;
    const theme = ECOSYSTEMS[island.id as CoreKingdomId];
    const radius = islandRadius(island) * 0.95;
    const capTop = island.position[1] + geom.capHeightAt(0, 0);
    const bottomY = capTop + 0.5;
    const topY = capTop + 13;

    // Split-biome islands (Adventure) keep snow on the -X half, embers on +X.
    const entries: { mt: MoteTheme; side: number; tag: number }[] = [
      { mt: theme.motes, side: theme.split ? -1 : 0, tag: 0 },
    ];
    if (theme.split) entries.push({ mt: theme.split.motes, side: 1, tag: 1 });

    for (const { mt, side, tag } of entries) {
      if (mt.glow !== glow) continue;
      const count = Math.max(5, Math.round(mt.count * scale));
      const rng = mulberry32(seedFrom(0x110e5 ^ (glow ? 1 : 0) ^ (tag << 1), island.id));
      const dir = mt.behavior === "rise" ? 1 : mt.behavior === "fall" ? -1 : 0;

      for (let i = 0; i < count; i++) {
        const a = rng() * Math.PI * 2;
        const r = Math.sqrt(rng()) * radius;
        let rx = Math.cos(a) * r;
        if (side < 0) rx = -Math.abs(rx);
        else if (side > 0) rx = Math.abs(rx);
        const y = bottomY + rng() * (topY - bottomY);
        motes.push({
          cx: island.position[0],
          cz: island.position[2],
          rx,
          rz: Math.sin(a) * r,
          homeY: y,
          topY,
          bottomY,
          y,
          speed: (dir === 0 ? 0.4 : 1.2) * (0.6 + rng() * 0.8),
          drift: (0.4 + rng() * 0.9) * (mt.behavior === "drift" ? 1.4 : 1),
          phase: rng() * Math.PI * 2,
          spin: (rng() - 0.5) * 1.6,
          size: mt.size * (0.7 + rng() * 0.7),
          dir,
        });
        colors.push(mt.colors[Math.floor(rng() * mt.colors.length)]);
      }
    }
  }
  return { motes, colors };
}

function MotePool({ built, glow }: { built: BuiltIsland[]; glow: boolean }) {
  const ref = useRef<InstancedMesh>(null);
  const { motes, colors } = useMemo(() => buildMotes(built, glow), [built, glow]);

  const material = useMemo(
    () =>
      new MeshBasicMaterial({
        transparent: true,
        depthWrite: false,
        opacity: glow ? 0.85 : 0.5,
        toneMapped: !glow,
        blending: glow ? AdditiveBlending : NormalBlending,
        side: 2,
      }),
    [glow]
  );

  useFrame((s, delta) => {
    const mesh = ref.current;
    if (!mesh) return;
    const t = s.clock.elapsedTime;
    const dt = Math.min(delta, 0.05);
    for (let i = 0; i < motes.length; i++) {
      const m = motes[i];
      if (m.dir > 0) {
        m.y += m.speed * dt * 2.2;
        if (m.y > m.topY) m.y = m.bottomY;
      } else if (m.dir < 0) {
        m.y -= m.speed * dt * 2.2;
        if (m.y < m.bottomY) m.y = m.topY;
      } else {
        m.y = m.homeY + Math.sin(t * 0.4 + m.phase) * 1.3;
      }
      const swayX = Math.sin(t * 0.5 + m.phase) * m.drift;
      const swayZ = Math.cos(t * 0.43 + m.phase) * m.drift * 0.7;
      tmpV.set(m.cx + m.rx + swayX, m.y, m.cz + m.rz + swayZ);
      tmpQ.setFromAxisAngle(tmpAxis, t * m.spin + m.phase);
      tmpM.compose(tmpV, tmpQ, tmpS.setScalar(m.size));
      mesh.setMatrixAt(i, tmpM);
    }
    mesh.instanceMatrix.needsUpdate = true;
  });

  if (motes.length === 0) return null;

  return (
    <instancedMesh
      ref={(mesh) => {
        ref.current = mesh;
        if (mesh) {
          for (let i = 0; i < colors.length; i++) mesh.setColorAt(i, tmpC.set(colors[i]));
          if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
        }
      }}
      args={[geo, material, motes.length]}
      frustumCulled={false}
      renderOrder={7}
    />
  );
}

/** Per-kingdom ambient motes — mist, petals, leaves, snow, spores, sparkle. */
export default function EcoMotes({ built }: { built: BuiltIsland[] }) {
  return (
    <group>
      <MotePool built={built} glow={false} />
      <MotePool built={built} glow={true} />
    </group>
  );
}
