"use client";

import { useEffect, useMemo } from "react";
import {
  BoxGeometry,
  ConeGeometry,
  CylinderGeometry,
  IcosahedronGeometry,
  SphereGeometry,
  Vector3,
} from "three";
import {
  buildIsland,
  buildStalactites,
  type IslandGeometry,
} from "@/engine/generation/island";
import { scatterOnCap } from "@/engine/generation/scatter";
import type { PrimKind } from "@/engine/generation/greybox";
import {
  islandRadius,
  KINGDOM_LAYOUTS,
  type KingdomLayout,
} from "@/engine/resolver/layout";
import { SLOT_MAPS, SIZE_SCALE } from "@/engine/resolver/slots";
import { resolveGreybox, slotLocalXZ } from "@/engine/resolver/resolve";
import {
  CORE_KINGDOM_IDS,
  type CoreKingdomId,
  type Island,
  type KingdomId,
  type WorldState,
} from "@/engine/schema/world";
import { getToonMaterial } from "@/engine/materials/toon";
import { PALETTE } from "@/lib/constants";
import { mulberry32, seedFrom } from "@/lib/noise";
import { useWorldStore } from "@/stores/worldStore";
import InstancedPool, { type PoolInstance } from "@/components/canvas/InstancedPool";
import KingdomIsland from "@/components/canvas/islands/KingdomIsland";
import BridgeLayer from "@/components/canvas/effects/BridgeLayer";
import Waterfall from "@/components/canvas/effects/Waterfall";

interface BuiltIsland {
  island: Island;
  geom: IslandGeometry;
  layout?: KingdomLayout;
}

interface Archipelago {
  islands: BuiltIsland[];
  geometries: Map<KingdomId, IslandGeometry>;
  stalactites: PoolInstance[];
  trunks: PoolInstance[];
  canopies: PoolInstance[];
  grass: PoolInstance[];
  flowers: PoolInstance[];
  waterfalls: { lip: Vector3; dir: Vector3 }[];
}

function lerpHex(a: string, b: string, t: number): string {
  const pa = parseInt(a.slice(1), 16);
  const pb = parseInt(b.slice(1), 16);
  const ch = (sa: number, sb: number): number => Math.round(sa + (sb - sa) * t);
  const r = ch((pa >> 16) & 255, (pb >> 16) & 255);
  const g = ch((pa >> 8) & 255, (pb >> 8) & 255);
  const bl = ch(pa & 255, pb & 255);
  return `#${((r << 16) | (g << 8) | bl).toString(16).padStart(6, "0")}`;
}

function buildArchipelago(state: WorldState): Archipelago {
  const out: Archipelago = {
    islands: [],
    geometries: new Map(),
    stalactites: [],
    trunks: [],
    canopies: [],
    grass: [],
    flowers: [],
    waterfalls: [],
  };

  for (const island of state.islands) {
    const core = CORE_KINGDOM_IDS.includes(island.id as CoreKingdomId);
    const layout = core ? KINGDOM_LAYOUTS[island.id as CoreKingdomId] : undefined;
    const seed = seedFrom(state.worldSeed, island.id);
    const radius = island.locked ? 7.2 : islandRadius(island);

    const geom = buildIsland({
      seed,
      radius,
      capHeight: layout?.capHeight ?? 1.5,
      depth: layout?.depth ?? 10,
      angularSegments: island.locked ? 48 : 112,
    });
    out.islands.push({ island, geom, layout });
    out.geometries.set(island.id, geom);

    const [ix, iy, iz] = island.position;

    for (const st of buildStalactites(seed, geom, island.locked ? 8 : 20)) {
      out.stalactites.push({
        position: [
          ix + st.position.x,
          iy + st.position.y - st.scale.y * 0.5 + 0.3,
          iz + st.position.z,
        ],
        rotation: [Math.PI + st.tiltX, 0, st.tiltZ],
        scale: [st.scale.x, st.scale.y, st.scale.z],
      });
    }

    if (island.locked || !layout) continue;

    // keep flora away from structure slots and the waterfall lip
    const slots = SLOT_MAPS[island.id as CoreKingdomId];
    const avoid = island.structures.map((s) => {
      const slot = slots[s.slot % slots.length];
      const { x, z } = slotLocalXZ(geom, slot);
      return { x, z, r: 2.3 * SIZE_SCALE[slot.size] };
    });
    if (layout.hasWaterfall) {
      avoid.push({ x: geom.waterfall.lip.x, z: geom.waterfall.lip.z, r: 3.2 });
      out.waterfalls.push({
        lip: geom.waterfall.lip.clone().add(new Vector3(ix, iy, iz)),
        dir: geom.waterfall.dir.clone(),
      });
    }

    const flora = island.ecosystem.flora;
    const blobRng = mulberry32(seed ^ 0xb10b);

    const trees = scatterOnCap(seed ^ 0x71ee5, geom, {
      count: Math.round((7 + flora * 20) * layout.treeFactor),
      minDistance: 3.0,
      radialMax: 0.85,
      maxSlope: 0.8,
      scaleRange: [1.0, 1.9],
      avoid,
    });
    for (const t of trees) {
      const s = t.scale;
      out.trunks.push({
        position: [ix + t.x, iy + t.y + 0.5 * s - 0.08, iz + t.z],
        rotation: [0, t.rotationY, 0],
        scale: s,
      });
      const baseY = iy + t.y + s * 1.5;
      for (let j = 0; j < 3; j++) {
        const a = t.rotationY + j * 2.4 + blobRng() * 0.8;
        const off = j === 0 ? 0 : s * (0.55 + blobRng() * 0.25);
        const bs = s * (j === 0 ? 1.3 : 0.78 + blobRng() * 0.22);
        out.canopies.push({
          position: [
            ix + t.x + Math.cos(a) * off,
            baseY + (j === 0 ? 0.25 * s : s * (0.1 + blobRng() * 0.45)),
            iz + t.z + Math.sin(a) * off,
          ],
          rotation: [0, a, 0],
          scale: [bs * 1.15, bs, bs * 1.15],
          color: lerpHex(PALETTE.canopyDeep, PALETTE.canopyLight, blobRng()),
        });
      }
    }

    const grassRng = mulberry32(seed ^ 0x6e55);
    for (const g of scatterOnCap(seed ^ 0x6e55, geom, {
      count: Math.round(70 * flora),
      minDistance: 0.8,
      radialMax: 0.92,
      maxSlope: 1.1,
      scaleRange: [0.95, 1.7],
      avoid,
    })) {
      out.grass.push({
        position: [ix + g.x, iy + g.y + 0.22 * g.scale, iz + g.z],
        rotation: [0, g.rotationY, (grassRng() - 0.5) * 0.3],
        scale: g.scale,
        color: lerpHex(PALETTE.grassDeep, PALETTE.grassLight, grassRng()),
      });
    }

    for (const f of scatterOnCap(seed ^ 0xf10e, geom, {
      count: Math.round(6 + flora * 16),
      minDistance: 1.4,
      radialMax: 0.88,
      maxSlope: 0.9,
      scaleRange: [0.8, 1.4],
      avoid,
    })) {
      out.flowers.push({
        position: [ix + f.x, iy + f.y + 0.1, iz + f.z],
        scale: f.scale,
      });
    }
  }

  return out;
}

const GEOS = {
  stalactite: new ConeGeometry(1, 1, 5, 1),
  trunk: new CylinderGeometry(0.14, 0.24, 1, 6),
  canopy: new IcosahedronGeometry(1, 1),
  grassTuft: new ConeGeometry(0.1, 0.5, 5, 1),
  flower: new SphereGeometry(0.075, 6, 5),
  box: new BoxGeometry(1, 1, 1),
  cylinder: new CylinderGeometry(0.5, 0.5, 1, 10),
  cone: new ConeGeometry(0.5, 1, 8, 1),
  dome: new SphereGeometry(0.5, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2),
};

const PRIM_KINDS: PrimKind[] = ["box", "cylinder", "cone", "dome"];

/** The whole data-driven world: islands, flora, greybox structures, bridges. */
export default function WorldGraph() {
  const state = useWorldStore((s) => s.state);

  useEffect(() => {
    void useWorldStore.getState().boot();
  }, []);

  // Geometry rebuilds only when something structural changes — level
  // (radius), lock state, flora density, or the seed itself.
  const geoKey = state
    ? state.worldSeed +
      state.islands
        .map((i) => `${i.id}:${i.level}:${i.locked ? 1 : 0}:${i.ecosystem.flora.toFixed(2)}`)
        .join("|")
    : "";

  // eslint-disable-next-line react-hooks/exhaustive-deps -- geoKey is the real dependency
  const data = useMemo(() => (state ? buildArchipelago(state) : null), [geoKey]);

  const pools = useMemo(
    () => (state && data ? resolveGreybox(state, data.geometries) : null),
    [state, data]
  );

  const greyboxInstances = useMemo(() => {
    if (!pools) return null;
    const map: Partial<Record<PrimKind, PoolInstance[]>> = {};
    for (const kind of PRIM_KINDS) {
      map[kind] = pools[kind].map((p) => ({
        position: p.position,
        rotation: [0, p.rotY, 0] as [number, number, number],
        scale: p.scale,
        color: lerpHex("#3c444e", "#e8edf2", p.shade),
      }));
    }
    return map as Record<PrimKind, PoolInstance[]>;
  }, [pools]);

  if (!state || !data || !greyboxInstances) return null;

  const rockMat = getToonMaterial("stalactite", {
    color: PALETTE.rockUnder,
    flatShading: true,
    rimColor: "#d9c4ef",
    rimStrength: 0.22,
  });
  const greyboxMat = getToonMaterial("greybox", { rimStrength: 0.26 });

  return (
    <group>
      {data.islands.map((b) => (
        <KingdomIsland key={b.island.id} island={b.island} geom={b.geom} layout={b.layout} />
      ))}

      <InstancedPool geometry={GEOS.stalactite} material={rockMat} instances={data.stalactites} />
      <InstancedPool
        geometry={GEOS.trunk}
        material={getToonMaterial("trunk", { color: PALETTE.trunk })}
        instances={data.trunks}
        castShadow
      />
      <InstancedPool
        geometry={GEOS.canopy}
        material={getToonMaterial("canopy", { flatShading: true, rimStrength: 0.38 })}
        instances={data.canopies}
        castShadow
        receiveShadow
      />
      <InstancedPool
        geometry={GEOS.grassTuft}
        material={getToonMaterial("grass", { flatShading: true })}
        instances={data.grass}
      />
      <InstancedPool
        geometry={GEOS.flower}
        material={getToonMaterial("flower", {
          color: PALETTE.gold,
          emissive: "#ffc83d",
          emissiveIntensity: 0.85,
        })}
        instances={data.flowers}
      />

      {PRIM_KINDS.map((kind) => (
        <InstancedPool
          key={kind}
          geometry={GEOS[kind]}
          material={greyboxMat}
          instances={greyboxInstances[kind]}
          castShadow
          receiveShadow
        />
      ))}

      {data.waterfalls.map((w, i) => (
        <Waterfall key={i} lip={w.lip} dir={w.dir} />
      ))}

      <BridgeLayer state={state} />
    </group>
  );
}
