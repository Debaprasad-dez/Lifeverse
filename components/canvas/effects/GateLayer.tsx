"use client";

import { useMemo } from "react";
import type { ThreeEvent } from "@react-three/fiber";
import {
  BoxGeometry,
  Color,
  CylinderGeometry,
  MeshBasicMaterial,
  OctahedronGeometry,
  SphereGeometry,
  TorusGeometry,
} from "three";
import type { BuiltIsland } from "@/components/canvas/WorldGraph";
import InstancedPool, { type PoolInstance } from "@/components/canvas/InstancedPool";
import { gateFrame } from "@/engine/generation/structures/gate";
import { islandRadius, islandCenter, KINGDOM_LAYOUTS } from "@/engine/resolver/layout";
import { CORE_KINGDOM_IDS, type CoreKingdomId } from "@/engine/schema/world";
import { getToonMaterial } from "@/engine/materials/toon";
import { useCameraStore } from "@/stores/cameraStore";

// unit primitives — one geometry, many instances (gates cost ~5 draw calls)
const GEO = {
  pillar: new CylinderGeometry(1, 1.14, 1, 12),
  block: new BoxGeometry(1, 1, 1),
  arch: new TorusGeometry(1, 0.16, 10, 28, Math.PI), // top half = the arch
  keystone: new OctahedronGeometry(1, 0),
  lantern: new SphereGeometry(1, 12, 10),
};

const STONE = "#cdb99c";
const STONE_DARK = "#a98f6f";

const cStone = new Color(STONE);
function archColor(accent: string): Color {
  // brand the arch with the kingdom accent, kept stony so it reads as carved
  return new Color(STONE).lerp(new Color(accent), 0.42);
}

interface GatePools {
  pillars: PoolInstance[];
  blocks: PoolInstance[]; // plinths + capitals
  arches: PoolInstance[];
  keystones: PoolInstance[];
  lanterns: PoolInstance[];
  /** instanceId → islandId for the double-click-to-enter pools. */
  pillarIsland: string[];
  archIsland: string[];
}

function buildGates(built: BuiltIsland[]): GatePools {
  const out: GatePools = {
    pillars: [],
    blocks: [],
    arches: [],
    keystones: [],
    lanterns: [],
    pillarIsland: [],
    archIsland: [],
  };

  for (const b of built) {
    const { island, geom } = b;
    if (island.locked) continue;
    if (!CORE_KINGDOM_IDS.includes(island.id as CoreKingdomId)) continue;
    const layout = KINGDOM_LAYOUTS[island.id as CoreKingdomId];

    const radius = islandRadius(island);
    const g = gateFrame(island, geom, radius);
    const [ix, iy, iz] = island.position;
    const cos = Math.cos(g.yaw);
    const sin = Math.sin(g.yaw);
    // gate-local (dx along span, dz inward) → island-local XZ
    const localXZ = (dx: number, dz: number): [number, number] => [
      g.x + dx * cos + dz * sin,
      g.z - dx * sin + dz * cos,
    ];
    const groundY = (lx: number, lz: number): number => iy + geom.capHeightAt(lx, lz);

    const archAccent = archColor(layout.accent);
    const glow = new Color(layout.palette.glow).multiplyScalar(1.55);

    // two columns
    let springSum = 0;
    for (const s of [-1, 1] as const) {
      const [lx, lz] = localXZ(s * g.width, 0);
      const gy = groundY(lx, lz);
      springSum += gy + g.pillarH;
      const wx = ix + lx;
      const wz = iz + lz;

      out.pillars.push({
        position: [wx, gy + g.pillarH / 2, wz],
        rotation: [0, g.yaw, 0],
        scale: [g.thick, g.pillarH, g.thick],
        color: cStone,
      });
      out.pillarIsland.push(island.id);
      // plinth + capital frame the column ends
      out.blocks.push({
        position: [wx, gy + 0.14, wz],
        rotation: [0, g.yaw, 0],
        scale: [g.thick * 3.1, 0.28, g.thick * 3.1],
        color: STONE_DARK,
      });
      out.blocks.push({
        position: [wx, gy + g.pillarH - 0.04, wz],
        rotation: [0, g.yaw, 0],
        scale: [g.thick * 2.5, 0.22, g.thick * 2.5],
        color: STONE_DARK,
      });
      // a warm lantern flanks the threshold (golden-hour identity light)
      out.lanterns.push({
        position: [wx, gy + g.pillarH + 0.22, wz],
        scale: [g.thick * 1.5, g.thick * 1.7, g.thick * 1.5],
        color: glow,
      });
    }

    // the arch spans the two springlines; apex = springline + width
    const springY = springSum / 2;
    out.arches.push({
      position: [ix + g.x, springY, iz + g.z],
      rotation: [0, g.yaw, 0],
      scale: [g.width, g.width, g.width],
      color: archAccent,
    });
    out.archIsland.push(island.id);
    // glowing keystone at the apex — kingdom crest, feeds Bloom
    out.keystones.push({
      position: [ix + g.x, springY + g.width * 0.97, iz + g.z],
      rotation: [0, g.yaw, Math.PI / 4],
      scale: [g.thick * 2.1, g.thick * 2.6, g.thick * 2.1],
      color: glow,
    });
  }

  return out;
}

/** Arc gates: one ceremonial arch per island, the kingdom's front door. */
export default function GateLayer({ built }: { built: BuiltIsland[] }) {
  const data = useMemo(() => buildGates(built), [built]);

  const stoneMat = useMemo(
    () => getToonMaterial("gate-stone", { rimColor: "#ffe6c2", rimStrength: 0.34 }),
    []
  );
  const glowMat = useMemo(() => new MeshBasicMaterial({ toneMapped: false }), []);

  const enter =
    (idxMap: string[]) =>
    (e: ThreeEvent<MouseEvent>): void => {
      if (e.instanceId === undefined) return;
      const id = idxMap[e.instanceId];
      const island = built.find((b) => b.island.id === id)?.island;
      if (!island) return;
      e.stopPropagation();
      useCameraStore.getState().flyToIsland(island.id, islandCenter(island));
    };
  const cursorOn = (e: ThreeEvent<PointerEvent>): void => {
    e.stopPropagation();
    document.body.style.cursor = "pointer";
  };
  const cursorOff = (): void => {
    document.body.style.cursor = "";
  };

  if (data.pillars.length === 0) return null;

  return (
    <group>
      <InstancedPool
        geometry={GEO.pillar}
        material={stoneMat}
        instances={data.pillars}
        castShadow
        receiveShadow
        onPointerOver={cursorOn}
        onPointerOut={cursorOff}
        onDoubleClick={enter(data.pillarIsland)}
      />
      <InstancedPool
        geometry={GEO.block}
        material={stoneMat}
        instances={data.blocks}
        castShadow
        receiveShadow
      />
      <InstancedPool
        geometry={GEO.arch}
        material={stoneMat}
        instances={data.arches}
        castShadow
        onPointerOver={cursorOn}
        onPointerOut={cursorOff}
        onDoubleClick={enter(data.archIsland)}
      />
      <InstancedPool geometry={GEO.keystone} material={glowMat} instances={data.keystones} />
      <InstancedPool geometry={GEO.lantern} material={glowMat} instances={data.lanterns} />
    </group>
  );
}
