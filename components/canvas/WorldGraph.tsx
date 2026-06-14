"use client";

import { useEffect, useMemo } from "react";
import {
  BoxGeometry,
  Color,
  ConeGeometry,
  CylinderGeometry,
  IcosahedronGeometry,
  OctahedronGeometry,
  SphereGeometry,
  Vector3,
} from "three";
import {
  buildIsland,
  buildStalactites,
  type IslandGeometry,
} from "@/engine/generation/island";
import { scatterOnCap } from "@/engine/generation/scatter";
import type { PrimKind } from "@/engine/generation/structures/kit";
import {
  islandRadius,
  KINGDOM_LAYOUTS,
  type KingdomLayout,
} from "@/engine/resolver/layout";
import { SLOT_MAPS, SIZE_SCALE } from "@/engine/resolver/slots";
import { resolveStructures, slotLocalXZ } from "@/engine/resolver/resolve";
import { gateFrame } from "@/engine/generation/structures/gate";
import { volcanoPlacement } from "@/engine/generation/structures/volcano";
import { ECOSYSTEMS, type EcosystemTheme } from "@/engine/ecosystem";
import { islandAnalytics } from "@/engine/resolver/analytics";
import {
  CORE_KINGDOM_IDS,
  type CoreKingdomId,
  type Island,
  type KingdomId,
  type WorldState,
} from "@/engine/schema/world";
import { getToonMaterial } from "@/engine/materials/toon";
import { PALETTE } from "@/lib/constants";
import { lerp, mulberry32, seedFrom } from "@/lib/noise";
import { useWorldStore } from "@/stores/worldStore";
import InstancedPool, { type PoolInstance } from "@/components/canvas/InstancedPool";
import KingdomIsland from "@/components/canvas/islands/KingdomIsland";
import BridgeLayer from "@/components/canvas/effects/BridgeLayer";
import Waterfall, { type WaterfallStyle } from "@/components/canvas/effects/Waterfall";
import AmbientLife from "@/components/canvas/effects/AmbientLife";
import WeatherLayer from "@/components/canvas/effects/WeatherLayer";
import HoverMarker from "@/components/canvas/HoverMarker";
import ContextualUI from "@/components/canvas/ContextualUI";
import GrowthFX from "@/components/canvas/effects/GrowthFX";
import BeaconLayer from "@/components/canvas/effects/BeaconLayer";
import GateLayer from "@/components/canvas/effects/GateLayer";
import VolcanoLayer from "@/components/canvas/effects/VolcanoLayer";
import CareerLayer from "@/components/canvas/effects/CareerLayer";
import EcoMotes from "@/components/canvas/effects/EcoMotes";
import SeasonLayer from "@/components/canvas/effects/SeasonLayer";
import CollectibleLayer from "@/components/canvas/effects/CollectibleLayer";
import GrassField, { type GrassInstance } from "@/components/canvas/effects/GrassField";
import ContactBlobs, { type BlobSpec } from "@/components/canvas/effects/ContactBlobs";
import { useUIStore } from "@/stores/uiStore";
import { useCameraStore } from "@/stores/cameraStore";
import { useGenesisStore } from "@/stores/genesisStore";
import { playChime } from "@/lib/sound";
import type { ThreeEvent } from "@react-three/fiber";
import { MeshBasicMaterial } from "three";

export interface BuiltIsland {
  island: Island;
  geom: IslandGeometry;
  geomMid?: IslandGeometry;
  geomLow?: IslandGeometry;
  layout?: KingdomLayout;
}

interface Archipelago {
  islands: BuiltIsland[];
  geometries: Map<KingdomId, IslandGeometry>;
  stalactites: PoolInstance[];
  trunks: PoolInstance[];
  canopies: PoolInstance[];
  /** Per-kingdom flora shapes (pine/topiary cones, gem/leaf octa, balls). */
  cones: PoolInstance[];
  spheres: PoolInstance[];
  octas: PoolInstance[];
  /** Unlit emissive flora — gems, crystals, bioluminescence → Bloom. */
  glowCones: PoolInstance[];
  glowOctas: PoolInstance[];
  glowSpheres: PoolInstance[];
  grass: GrassInstance[];
  flowers: PoolInstance[];
  boulders: PoolInstance[];
  shrubs: PoolInstance[];
  blobs: BlobSpec[];
  waterfalls: { lip: Vector3; dir: Vector3; style: WaterfallStyle }[];
}

/** Meadow variety — gold, pink, lilac, white, peach. */
const FLOWER_COLORS = ["#ffd34d", "#ff9ecf", "#c5a3ff", "#fff3f3", "#ffa94d"];

const cA = new Color();
const cB = new Color();
/** Vitality drains color toward dry hay — saturation IS the analytics. */
function vitalityTint(full: string, saturation: number, rng: number): string {
  cA.set(full);
  cB.set("#c4b687");
  cB.lerp(cA, saturation);
  cB.multiplyScalar(0.92 + rng * 0.16);
  return `#${cB.getHexString()}`;
}

const tmpGlow = new Color();
/** HDR emissive color (Bloom reads >1 as light). */
function glowColor(hex: string, mul = 1.3): Color {
  return tmpGlow.set(hex).multiplyScalar(mul).clone();
}

/**
 * Per-kingdom flora kit. Each kingdom grows a distinct silhouette into the
 * shared instanced pools — NOT a tree on every island:
 *   topiary  → career  (polished trunk + manicured / reflective metal balls)
 *   crystal  → finance (silver column + glowing geometric gem leaves)
 *   redwood  → health  (tall trunk + jade canopy + bioluminescent nubs)
 *   spiral   → creativity (helix trunk + floating pastel glow leaves)
 *   pine     → adventure (stacked frost cones + snow cap)
 *   autumn/sakura/broadleaf → organic broadleaf (trunk + canopy blobs)
 */
function pushTree(
  out: Archipelago,
  theme: EcosystemTheme,
  sat: number,
  base: [number, number, number],
  s: number,
  rotY: number,
  rng: () => number,
  volcano = false
): void {
  const [bx, by, bz] = base;
  out.blobs.push({ position: [bx, by + 0.07, bz], radius: s * 1.7 });

  // Adventure volcano half: charred dead trees + an ember at the base
  if (volcano) {
    out.trunks.push({ position: [bx, by + 0.7 * s, bz], rotation: [0, rotY, 0], scale: [s * 0.4, s * 1.5, s * 0.4], color: "#1a130e" });
    const branches = 2 + Math.floor(rng() * 3);
    for (let k = 0; k < branches; k++) {
      const a = rng() * Math.PI * 2;
      out.trunks.push({
        position: [bx + Math.cos(a) * s * 0.2, by + s * (0.9 + rng() * 0.5), bz + Math.sin(a) * s * 0.2],
        rotation: [(rng() - 0.5) * 1.3, a, (rng() - 0.5) * 1.3],
        scale: [s * 0.16, s * 0.7, s * 0.16],
        color: "#160f0b",
      });
    }
    if (rng() < 0.5) {
      out.glowSpheres.push({
        position: [bx, by + 0.1, bz],
        scale: [s * 0.5, s * 0.14, s * 0.5],
        color: glowColor("#FF4500", 1.25),
      });
    }
    return;
  }

  switch (theme.foliage) {
    case "topiary": {
      out.trunks.push({ position: [bx, by + 0.4 * s, bz], rotation: [0, rotY, 0], scale: [s * 0.7, s * 0.9, s * 0.7], color: "#4a3f36" });
      if (rng() < 0.4) {
        // reflective metallic ball-tree
        out.spheres.push({ position: [bx, by + 1.05 * s, bz], scale: [s * 1.7, s * 1.7, s * 1.7], color: "#c6ccd4" });
      } else {
        out.spheres.push({ position: [bx, by + 0.95 * s, bz], scale: [s * 1.8, s * 1.7, s * 1.8], color: vitalityTint(theme.canopy[0], sat, rng()) });
        out.spheres.push({ position: [bx, by + 1.7 * s, bz], scale: [s * 1.1, s * 1.1, s * 1.1], color: vitalityTint(theme.canopy[1], sat, rng()) });
      }
      break;
    }
    case "crystal": {
      out.trunks.push({ position: [bx, by + 0.55 * s, bz], rotation: [0, rotY, 0], scale: [s * 0.7, s * 1.1, s * 0.7], color: "#c0c0c8" });
      const gemCols = ["#50C878", "#B9F2FF", "#FFD700"];
      const gems = 4 + Math.floor(rng() * 3);
      for (let i = 0; i < gems; i++) {
        const a = (i / gems) * Math.PI * 2 + rng();
        const r = s * (0.35 + rng() * 0.3);
        const gs = s * (0.4 + rng() * 0.3);
        out.glowOctas.push({
          position: [bx + Math.cos(a) * r, by + s * (1.1 + rng() * 0.5), bz + Math.sin(a) * r],
          rotation: [rng(), a, rng()],
          scale: [gs, gs * 1.3, gs],
          color: glowColor(gemCols[i % gemCols.length], 1.35),
        });
      }
      break;
    }
    case "redwood": {
      out.trunks.push({ position: [bx, by + 0.95 * s, bz], rotation: [0, rotY, 0], scale: [s * 0.85, s * 2.0, s * 0.85], color: "#4A3728" });
      const cy = by + s * 2.2;
      for (let j = 0; j < 3; j++) {
        const a = rotY + j * 2.4 + rng() * 0.8;
        const off = j === 0 ? 0 : s * (0.5 + rng() * 0.25);
        const bs = s * (j === 0 ? 1.4 : 0.85 + rng() * 0.2);
        out.canopies.push({
          position: [bx + Math.cos(a) * off, cy + (j === 0 ? 0.2 * s : s * (0.1 + rng() * 0.4)), bz + Math.sin(a) * off],
          rotation: [0, a, 0],
          scale: [bs * 1.2, bs, bs * 1.2],
          color: vitalityTint(rng() < 0.5 ? theme.canopy[1] : theme.canopy[0], sat, rng()),
        });
      }
      const bio = ["#2EC4B6", "#9B7EDE", "#B8FFE0"];
      for (let i = 0; i < 3; i++) {
        const a = rng() * Math.PI * 2;
        const r = s * (0.4 + rng() * 0.5);
        out.glowSpheres.push({
          position: [bx + Math.cos(a) * r, cy - s * (0.3 + rng() * 0.6), bz + Math.sin(a) * r],
          scale: [s * 0.16, s * 0.16, s * 0.16],
          color: glowColor(bio[i % bio.length], 1.3),
        });
      }
      break;
    }
    case "spiral": {
      for (let k = 0; k < 5; k++) {
        const a = rotY + k * 1.1;
        const rr = s * 0.18;
        out.trunks.push({ position: [bx + Math.cos(a) * rr, by + (0.2 + k * 0.3) * s, bz + Math.sin(a) * rr], rotation: [0, a, 0.2], scale: [s * 0.45, s * 0.4, s * 0.45], color: "#D4B3FF" });
      }
      const pastels = ["#FFB3DE", "#B3E5FC", "#D4B3FF", "#FFE5A8"];
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2 + rng();
        const r = s * (0.4 + rng() * 0.5);
        const ls = s * (0.3 + rng() * 0.2);
        out.glowOctas.push({
          position: [bx + Math.cos(a) * r, by + s * (1.5 + rng() * 0.8), bz + Math.sin(a) * r],
          rotation: [rng(), a, rng()],
          scale: [ls, ls, ls],
          color: glowColor(pastels[i % pastels.length], 1.25),
        });
      }
      break;
    }
    case "pine": {
      const ps = s * 0.6; // pines read small against the volcano
      out.trunks.push({ position: [bx, by + 0.3 * ps, bz], rotation: [0, rotY, 0], scale: [ps * 0.5, ps * 0.6, ps * 0.5], color: "#3a2e22" });
      const tiers = 3;
      for (let k = 0; k < tiers; k++) {
        const cs = ps * (1.2 - k * 0.3);
        out.cones.push({
          position: [bx, by + ps * (0.6 + k * 0.55), bz],
          rotation: [0, rotY, 0],
          scale: [cs, ps * 0.95, cs],
          color: vitalityTint(k % 2 === 0 ? theme.canopy[1] : theme.canopy[0], sat, rng()),
        });
      }
      out.spheres.push({ position: [bx, by + ps * (0.6 + tiers * 0.55), bz], scale: [ps * 0.28, ps * 0.28, ps * 0.28], color: "#eef6ff" });
      break;
    }
    default: {
      // autumn / sakura / broadleaf — organic trunk + 3 canopy blobs
      out.trunks.push({ position: [bx, by + 0.5 * s - 0.08, bz], rotation: [0, rotY, 0], scale: s, color: PALETTE.trunk });
      const cy = by + s * 1.5;
      for (let j = 0; j < 3; j++) {
        const a = rotY + j * 2.4 + rng() * 0.8;
        const off = j === 0 ? 0 : s * (0.55 + rng() * 0.25);
        const bs = s * (j === 0 ? 1.3 : 0.78 + rng() * 0.22);
        out.canopies.push({
          position: [bx + Math.cos(a) * off, cy + (j === 0 ? 0.25 * s : s * (0.1 + rng() * 0.45)), bz + Math.sin(a) * off],
          rotation: [0, a, 0],
          scale: [bs * 1.15, bs, bs * 1.15],
          color: vitalityTint(rng() < 0.5 ? theme.canopy[1] : theme.canopy[0], sat, rng()),
        });
      }
      break;
    }
  }
}

function buildArchipelago(state: WorldState): Archipelago {
  const out: Archipelago = {
    islands: [],
    geometries: new Map(),
    stalactites: [],
    trunks: [],
    canopies: [],
    cones: [],
    spheres: [],
    octas: [],
    glowCones: [],
    glowOctas: [],
    glowSpheres: [],
    grass: [],
    flowers: [],
    boulders: [],
    shrubs: [],
    blobs: [],
    waterfalls: [],
  };

  for (const island of state.islands) {
    const core = CORE_KINGDOM_IDS.includes(island.id as CoreKingdomId);
    const layout = core ? KINGDOM_LAYOUTS[island.id as CoreKingdomId] : undefined;
    const theme = core ? ECOSYSTEMS[island.id as CoreKingdomId] : undefined;
    const seed = seedFrom(state.worldSeed, island.id);
    const radius = island.locked ? 7.2 : islandRadius(island);
    const analytics = islandAnalytics(island);

    // dirt paths run to each occupied structure slot
    const islandSlots = core ? SLOT_MAPS[island.id as CoreKingdomId] : [];
    const pathAnchors = island.locked
      ? []
      : island.structures.map((s) => {
          const slot = islandSlots[s.slot % islandSlots.length];
          return { t: slot.t, r: slot.r };
        });
    // Adventure: extra worn roads from the center out to the volcano + camps
    if (theme?.split) {
      pathAnchors.push({ t: 0, r: 0.36 }, { t: 170, r: 0.24 }, { t: 196, r: 0.24 });
    }

    const baseParams = {
      seed,
      radius,
      capHeight: layout?.capHeight ?? 1.5,
      depth: layout?.depth ?? 10,
      paths: pathAnchors,
      ground: theme
        ? {
            grassLight: theme.grassLight,
            grassDeep: theme.grassDeep,
            cliffWarm: theme.cliffWarm,
            cliffDeep: theme.cliffDeep,
            volcano: theme.split
              ? {
                  grassLight: theme.split.grassLight,
                  grassDeep: theme.split.grassDeep,
                  cliffWarm: theme.split.cliffWarm,
                  cliffDeep: theme.split.cliffDeep,
                }
              : undefined,
            tiers: theme.tiers,
          }
        : undefined,
    };
    const geom = buildIsland({ ...baseParams, detail: island.locked ? 0.4 : 1 });
    const built: BuiltIsland = { island, geom, layout };
    if (!island.locked) {
      built.geomMid = buildIsland({ ...baseParams, detail: 0.55 });
      built.geomLow = buildIsland({ ...baseParams, detail: 0.3 });
    }
    out.islands.push(built);
    out.geometries.set(island.id, geom);

    const [ix, iy, iz] = island.position;

    for (const st of buildStalactites(seed, geom, island.locked ? 8 : 18)) {
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

    if (island.locked || !layout || !theme) continue;

    // keep flora away from structure slots and the waterfall lip
    const slots = SLOT_MAPS[island.id as CoreKingdomId];
    const avoid = island.structures.map((s) => {
      const slot = slots[s.slot % slots.length];
      const { x, z } = slotLocalXZ(geom, slot);
      return { x, z, r: 2.4 * SIZE_SCALE[slot.size] };
    });
    // keep the arc gate's threshold + approach clear of flora and rocks
    avoid.push(gateFrame(island, geom, radius).keepOut);
    // and the volcano footprint + camp clearings (Adventure)
    if (theme.split) {
      const vp = volcanoPlacement(island, geom, radius);
      avoid.push(vp.keepOut);
      for (const c of vp.camps) avoid.push({ x: c.x, z: c.z, r: vp.base * 0.85 });
    }
    if (layout.hasWaterfall) {
      avoid.push({ x: geom.waterfall.lip.x, z: geom.waterfall.lip.z, r: 3.2 });
      out.waterfalls.push({
        lip: geom.waterfall.lip.clone().add(new Vector3(ix, iy, iz)),
        dir: geom.waterfall.dir.clone(),
        style: layout.waterfallStyle ?? "water",
      });
    }

    const flora = island.ecosystem.flora;
    const sat = analytics.floraSaturation;
    const blobRng = mulberry32(seed ^ 0xb10b);

    const trees = scatterOnCap(seed ^ 0x71ee5, geom, {
      count: Math.round((7 + flora * 20) * layout.treeFactor * analytics.treeCountMul * theme.treeMul),
      minDistance: 3.0,
      radialMax: 0.85,
      maxSlope: 0.8,
      scaleRange: [0.8, 1.4],
      avoid,
    });
    for (const t of trees) {
      const volcano = !!theme.split && t.x > 0;
      pushTree(out, theme, sat, [ix + t.x, iy + t.y, iz + t.z], t.scale, t.rotationY, blobRng, volcano);
    }

    const grassRng = mulberry32(seed ^ 0x6e55);
    for (const g of scatterOnCap(seed ^ 0x6e55, geom, {
      count: Math.round(110 * flora * theme.grassMul),
      minDistance: 0.7,
      radialMax: 0.92,
      maxSlope: 1.1,
      scaleRange: [0.8, 1.5],
      avoid,
    })) {
      out.grass.push({
        position: [ix + g.x, iy + g.y + 0.02, iz + g.z],
        rotY: g.rotationY,
        scale: g.scale,
        color: vitalityTint(
          grassRng() < 0.5 ? theme.grassDeep : theme.grassLight,
          sat,
          grassRng()
        ),
      });
    }

    const flowerPalette = theme.flowers.length > 0 ? theme.flowers : FLOWER_COLORS;
    const flowerRng = mulberry32(seed ^ 0xf10e);
    for (const f of theme.flowers.length === 0
      ? []
      : scatterOnCap(seed ^ 0xf10e, geom, {
          count: Math.round((6 + flora * 16) * lerp(0.4, 1.2, island.vitality)),
          minDistance: 1.4,
          radialMax: 0.88,
          maxSlope: 0.9,
          scaleRange: [0.8, 1.4],
          avoid,
        })) {
      out.flowers.push({
        position: [ix + f.x, iy + f.y + 0.1, iz + f.z],
        scale: f.scale,
        color: flowerPalette[Math.floor(flowerRng() * flowerPalette.length)],
      });
    }

    // ---- weathered boulders: ground the rim, sparse so focus stays on
    // structures. A few wear moss where the meadow is healthy. ----------------
    const rockRng = mulberry32(seed ^ 0xb01de);
    const boulderLocals: { x: number; z: number; r: number }[] = [];
    for (const r of scatterOnCap(seed ^ 0xb01de, geom, {
      count: Math.round(5 + island.level * 0.35),
      minDistance: 3.2,
      radialMin: 0.45,
      radialMax: 0.9,
      maxSlope: 1.5,
      scaleRange: [0.6, 1.2],
      avoid,
    })) {
      const s = r.scale;
      const volcanoSide = !!theme.split && r.x > 0;
      if (theme.foliage === "crystal") {
        // Finance: quartz/amethyst/emerald shards sprout instead of rock
        const shardCols = ["#E8F4FF", "#9966CC", "#50C878"];
        const n = 2 + Math.floor(rockRng() * 3);
        for (let i = 0; i < n; i++) {
          const a = rockRng() * Math.PI * 2;
          const rr = s * 0.35 * i;
          const cs = s * (0.55 + rockRng() * 0.7);
          out.glowCones.push({
            position: [ix + r.x + Math.cos(a) * rr, iy + r.y + cs * 0.7, iz + r.z + Math.sin(a) * rr],
            rotation: [rockRng() * 0.3 - 0.15, a, rockRng() * 0.3 - 0.15],
            scale: [cs * 0.5, cs * 1.7, cs * 0.5],
            color: glowColor(shardCols[Math.floor(rockRng() * shardCols.length)], 1.3),
          });
        }
        out.blobs.push({ position: [ix + r.x, iy + r.y + 0.06, iz + r.z], radius: s * 1.0 });
      } else if (volcanoSide && theme.split) {
        // Adventure volcano half: obsidian boulders, basalt columns, lava cracks
        cA.set(theme.split.boulder[0]).lerp(cB.set(theme.split.boulder[1]), rockRng());
        if (rockRng() < 0.45) {
          // basalt column (dark, near-prismatic) using the trunk cylinder
          out.trunks.push({
            position: [ix + r.x, iy + r.y + s * 1.1, iz + r.z],
            rotation: [0, r.rotationY, 0],
            scale: [s * 0.55, s * 2.4, s * 0.55],
            color: `#${cA.getHexString()}`,
          });
        } else {
          out.boulders.push({
            position: [ix + r.x, iy + r.y + s * 0.18, iz + r.z],
            rotation: [rockRng() * 0.4 - 0.2, r.rotationY, rockRng() * 0.4 - 0.2],
            scale: [s * (0.9 + rockRng() * 0.4), s * (0.6 + rockRng() * 0.3), s * (0.9 + rockRng() * 0.4)],
            color: `#${cA.getHexString()}`,
          });
        }
        if (rockRng() < 0.55) {
          // glowing lava fissure pooled at the ground
          out.glowSpheres.push({
            position: [ix + r.x, iy + r.y + 0.08, iz + r.z],
            scale: [s * (0.6 + rockRng() * 0.5), s * 0.16, s * (0.6 + rockRng() * 0.5)],
            color: glowColor(theme.split.lava[Math.floor(rockRng() * theme.split.lava.length)], 1.3),
          });
        }
        out.blobs.push({ position: [ix + r.x, iy + r.y + 0.06, iz + r.z], radius: s * 1.1 });
      } else {
        cA.set(theme.boulder[0]).lerp(cB.set(theme.boulder[1]), rockRng());
        if (rockRng() < 0.35) cA.lerp(cB.set(theme.grassDeep), 0.4); // mossy/biome wear
        out.boulders.push({
          position: [ix + r.x, iy + r.y + s * 0.18, iz + r.z],
          rotation: [rockRng() * 0.4 - 0.2, r.rotationY, rockRng() * 0.4 - 0.2],
          scale: [s * (0.9 + rockRng() * 0.4), s * (0.6 + rockRng() * 0.3), s * (0.9 + rockRng() * 0.4)],
          color: `#${cA.getHexString()}`,
        });
        out.blobs.push({ position: [ix + r.x, iy + r.y + 0.06, iz + r.z], radius: s * 1.1 });
      }
      boulderLocals.push({ x: r.x, z: r.z, r: s * 1.2 });
    }

    // ---- shrubs: a mid-layer between grass and trees so the cap reads full
    // without crowding. Density tracks ecosystem flora. ----------------------
    const shrubRng = mulberry32(seed ^ 0x5417b);
    for (const sh of scatterOnCap(seed ^ 0x5417b, geom, {
      count: Math.round((3 + flora * 8) * (theme.split ? 0.55 : 1) * Math.min(1, Math.max(0.3, theme.treeMul))),
      minDistance: theme.split ? 2.8 : 2.2,
      radialMax: 0.86,
      maxSlope: 0.85,
      scaleRange: [0.6, 1.15],
      avoid: [...avoid, ...boulderLocals],
    })) {
      const s = sh.scale;
      // frontier biome: no soft green shrubs — small pines or ice shards
      if (theme.split) {
        if (shrubRng() < 0.5) {
          pushTree(out, theme, sat, [ix + sh.x, iy + sh.y, iz + sh.z], s * 0.8, sh.rotationY, shrubRng);
        } else {
          const h = s * 1.3;
          cA.set("#cfeaf6").lerp(cB.set("#9fc6dd"), shrubRng());
          out.cones.push({
            position: [ix + sh.x, iy + sh.y + h * 0.45, iz + sh.z],
            rotation: [(shrubRng() - 0.5) * 0.25, sh.rotationY, (shrubRng() - 0.5) * 0.25],
            scale: [h * 0.34, h, h * 0.34],
            color: `#${cA.getHexString()}`,
          });
        }
        continue;
      }
      out.shrubs.push({
        position: [ix + sh.x, iy + sh.y + s * 0.28, iz + sh.z],
        rotation: [0, sh.rotationY, 0],
        scale: [s * 0.85, s * 0.62, s * 0.85],
        color: vitalityTint(
          shrubRng() < 0.5 ? theme.canopy[1] : theme.canopy[0],
          sat,
          shrubRng()
        ),
      });
    }
  }

  return out;
}

const GEOS = {
  stalactite: new ConeGeometry(1, 1, 5, 1),
  trunk: new CylinderGeometry(0.14, 0.24, 1, 6),
  canopy: new IcosahedronGeometry(1, 1),
  boulder: new IcosahedronGeometry(1, 0),
  octa: new OctahedronGeometry(0.6, 0),
  grassTuft: new ConeGeometry(0.1, 0.5, 5, 1),
  flower: new SphereGeometry(0.075, 6, 5),
  box: new BoxGeometry(1, 1, 1),
  cylinder: new CylinderGeometry(0.5, 0.5, 1, 10),
  cone: new ConeGeometry(0.5, 1, 8, 1),
  dome: new SphereGeometry(0.5, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2),
  sphere: new SphereGeometry(0.5, 10, 8),
};

const PRIM_KINDS: PrimKind[] = ["box", "cylinder", "cone", "dome", "sphere"];

/** Unlit pool material — HDR instance colors read as light, Bloom does the rest. */
const glowMaterial = new MeshBasicMaterial({ toneMapped: false });

/** The whole data-driven world: islands, flora, structures, life, weather. */
export default function WorldGraph() {
  // render the temporal overlay (time-travel / future sim) if present, else
  // the live present — one extra key in geoKey keeps geometry in sync
  const state = useWorldStore((s) => s.preview ?? s.state);
  const era = useWorldStore((s) => s.era);
  const genesisPhase = useGenesisStore((s) => s.phase);
  const dressed = genesisPhase === "idle" || genesisPhase === "done";

  useEffect(() => {
    void useWorldStore.getState().boot();
  }, []);

  // Geometry rebuilds only when something structural changes — level
  // (radius), lock state, flora/vitality, or the seed itself.
  const geoKey = state
    ? era +
      state.worldSeed +
      state.islands
        .map(
          (i) =>
            `${i.id}:${i.level}:${i.locked ? 1 : 0}:${i.ecosystem.flora.toFixed(2)}:${i.vitality.toFixed(2)}:${i.structures.map((s) => s.slot).join(".")}`
        )
        .join("|")
    : "";

  // eslint-disable-next-line react-hooks/exhaustive-deps -- geoKey is the real dependency
  const data = useMemo(() => (state ? buildArchipelago(state) : null), [geoKey]);

  const pools = useMemo(
    () => (state && data ? resolveStructures(state, data.geometries) : null),
    [state, data]
  );

  // contact shadows: trees (from archipelago) + structures/landmarks (anchors)
  const allBlobs = useMemo((): BlobSpec[] => {
    if (!data || !pools) return [];
    return [
      ...data.blobs,
      ...pools.anchors.map((a) => ({
        position: [a.position[0], a.position[1] + 0.09, a.position[2]] as [
          number,
          number,
          number,
        ],
        radius: a.radius * 1.25,
      })),
    ];
  }, [data, pools]);

  const poolInstances = useMemo(() => {
    if (!pools) return null;
    const toPool = (src: typeof pools.body) => {
      const map = {} as Record<PrimKind, PoolInstance[]>;
      const anchorIdx = {} as Record<PrimKind, number[]>;
      for (const kind of PRIM_KINDS) {
        map[kind] = src[kind].map((p) => ({
          position: p.position,
          rotation: [0, p.rotY, 0] as [number, number, number],
          scale: p.scale,
          color: p.color,
        }));
        anchorIdx[kind] = src[kind].map((p) => p.anchorIdx);
      }
      return { map, anchorIdx };
    };
    const body = toPool(pools.body);
    const glow = toPool(pools.glow);
    return {
      body: body.map,
      glow: glow.map,
      bodyAnchorIdx: body.anchorIdx,
      glowAnchorIdx: glow.anchorIdx,
    };
  }, [pools]);

  if (!state || !data || !poolInstances || !pools) return null;

  const anchors = pools.anchors;
  const hoverHandler =
    (idxMap: number[]) =>
    (e: ThreeEvent<PointerEvent>): void => {
      if (e.instanceId === undefined) return;
      e.stopPropagation();
      const a = anchors[idxMap[e.instanceId]];
      if (a) {
        useUIStore.getState().setHoveredStructure(a.structureId);
        document.body.style.cursor = "pointer";
      }
    };
  const unhoverHandler = (): void => {
    useUIStore.getState().setHoveredStructure(null);
    document.body.style.cursor = "";
  };
  const clickHandler =
    (idxMap: number[]) =>
    (e: ThreeEvent<MouseEvent>): void => {
      if (e.instanceId === undefined) return;
      e.stopPropagation();
      const a = anchors[idxMap[e.instanceId]];
      if (!a) return;
      playChime();
      useCameraStore
        .getState()
        .inspectStructure(a.islandId, a.structureId, [
          a.position[0],
          a.position[1] + a.height * 0.5,
          a.position[2],
        ]);
    };

  const rockMat = getToonMaterial("stalactite", {
    color: PALETTE.rockUnder,
    flatShading: true,
    rimColor: "#d9c4ef",
    rimStrength: 0.22,
  });
  const bodyMat = getToonMaterial("structure-body", { rimStrength: 0.3 });

  return (
    <group>
      {data.islands.map((b, i) => (
        <KingdomIsland
          key={b.island.id}
          island={b.island}
          geom={b.geom}
          geomMid={b.geomMid}
          geomLow={b.geomLow}
          layout={b.layout}
          riseIndex={i}
        />
      ))}

      {/* dressing is world-space-baked — hidden until the genesis rise lands */}
      {dressed && (
        <>
          <InstancedPool
            geometry={GEOS.stalactite}
            material={rockMat}
            instances={data.stalactites}
          />
          <InstancedPool
            geometry={GEOS.trunk}
            material={getToonMaterial("trunk", { color: "#ffffff" })}
            instances={data.trunks}
            castShadow
          />
          <InstancedPool
            geometry={GEOS.canopy}
            material={getToonMaterial("canopy", {
              flatShading: true,
              rimStrength: 0.46,
              rimColor: "#ffeec2",
            })}
            instances={data.canopies}
            castShadow
            receiveShadow
          />
          <GrassField instances={data.grass} />
          <InstancedPool
            geometry={GEOS.flower}
            material={getToonMaterial("flower", {
              color: "#ffffff",
              emissive: "#fff0cd",
              emissiveIntensity: 0.45,
            })}
            instances={data.flowers}
          />
          <InstancedPool
            geometry={GEOS.boulder}
            material={getToonMaterial("boulder", {
              flatShading: true,
              rimColor: "#fff0d6",
              rimStrength: 0.24,
              grain: 0.18,
            })}
            instances={data.boulders}
            castShadow
            receiveShadow
          />
          <InstancedPool
            geometry={GEOS.canopy}
            material={getToonMaterial("canopy", {
              flatShading: true,
              rimStrength: 0.46,
              rimColor: "#ffeec2",
            })}
            instances={data.shrubs}
            castShadow
            receiveShadow
          />

          {/* per-kingdom flora shapes — pines/topiary cones, balls, gems */}
          <InstancedPool
            geometry={GEOS.cone}
            material={getToonMaterial("flora-cone", {
              flatShading: true,
              rimStrength: 0.42,
              rimColor: "#ffeec2",
            })}
            instances={data.cones}
            castShadow
            receiveShadow
          />
          <InstancedPool
            geometry={GEOS.sphere}
            material={getToonMaterial("flora-sphere", { rimStrength: 0.5, rimColor: "#ffffff" })}
            instances={data.spheres}
            castShadow
            receiveShadow
          />
          <InstancedPool
            geometry={GEOS.octa}
            material={getToonMaterial("flora-octa", {
              flatShading: true,
              rimStrength: 0.5,
              rimColor: "#ffffff",
            })}
            instances={data.octas}
            castShadow
          />
          <InstancedPool geometry={GEOS.cone} material={glowMaterial} instances={data.glowCones} />
          <InstancedPool geometry={GEOS.octa} material={glowMaterial} instances={data.glowOctas} />
          <InstancedPool geometry={GEOS.sphere} material={glowMaterial} instances={data.glowSpheres} />

          {PRIM_KINDS.map((kind) => (
            <InstancedPool
              key={`body-${kind}`}
              geometry={GEOS[kind]}
              material={bodyMat}
              instances={poolInstances.body[kind]}
              castShadow
              receiveShadow
              onPointerOver={hoverHandler(poolInstances.bodyAnchorIdx[kind])}
              onPointerOut={unhoverHandler}
              onClick={clickHandler(poolInstances.bodyAnchorIdx[kind])}
            />
          ))}
          {PRIM_KINDS.map((kind) => (
            <InstancedPool
              key={`glow-${kind}`}
              geometry={GEOS[kind]}
              material={glowMaterial}
              instances={poolInstances.glow[kind]}
              onPointerOver={hoverHandler(poolInstances.glowAnchorIdx[kind])}
              onPointerOut={unhoverHandler}
              onClick={clickHandler(poolInstances.glowAnchorIdx[kind])}
            />
          ))}

          <ContactBlobs blobs={allBlobs} />
          <HoverMarker anchors={pools.anchors} />
          <ContextualUI built={data.islands} anchors={pools.anchors} />

          {data.waterfalls.map((w, i) => (
            <Waterfall key={i} lip={w.lip} dir={w.dir} style={w.style} />
          ))}

          <BridgeLayer state={state} />
          <GateLayer built={data.islands} />
          <VolcanoLayer built={data.islands} />
          <CareerLayer built={data.islands} />
          <EcoMotes built={data.islands} />
          <AmbientLife state={state} built={data.islands} />
          <WeatherLayer state={state} built={data.islands} />
          <BeaconLayer state={state} built={data.islands} />
          <SeasonLayer season={state.season} />
          {era === "present" && <CollectibleLayer state={state} built={data.islands} />}
          <GrowthFX anchors={pools.anchors} built={data.islands} />
        </>
      )}
    </group>
  );
}
