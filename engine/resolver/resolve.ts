/**
 * WorldState → render props. Flattens every structure on every unlocked
 * island into per-primitive instance pools (one InstancedMesh per primitive
 * kind for the whole archipelago) using the hand-authored slot maps.
 */

import type { IslandGeometry } from "@/engine/generation/island";
import { GREYBOX_RECIPES, type PrimKind } from "@/engine/generation/greybox";
import {
  CORE_KINGDOM_IDS,
  type CoreKingdomId,
  type KingdomId,
  type WorldState,
} from "@/engine/schema/world";
import { SIZE_SCALE, SLOT_MAPS } from "./slots";
import { DEG } from "@/lib/constants";

export interface PartInstance {
  position: [number, number, number];
  rotY: number;
  scale: [number, number, number];
  /** Grey value 0–1 (glowing structures run bright, dormant dim). */
  shade: number;
}

export type GreyboxPools = Record<PrimKind, PartInstance[]>;

/** Slot anchor in island-local XZ (shared by structures + flora keep-out). */
export function slotLocalXZ(
  geom: IslandGeometry,
  slot: { t: number; r: number }
): { x: number; z: number } {
  const theta = slot.t * DEG;
  const footprint = geom.footprintAt(theta);
  return {
    x: Math.cos(theta) * footprint * slot.r,
    z: Math.sin(theta) * footprint * slot.r,
  };
}

function hash01(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 1000) / 1000;
}

export function resolveGreybox(
  state: WorldState,
  geometries: Map<KingdomId, IslandGeometry>
): GreyboxPools {
  const pools: GreyboxPools = { box: [], cylinder: [], cone: [], dome: [] };

  for (const island of state.islands) {
    if (island.locked) continue;
    if (!CORE_KINGDOM_IDS.includes(island.id as CoreKingdomId)) continue;
    const geom = geometries.get(island.id);
    if (!geom) continue;

    const slots = SLOT_MAPS[island.id as CoreKingdomId];
    const stageScale = 0.92 + island.evolutionStage * 0.06;

    for (const structure of island.structures) {
      const slot = slots[structure.slot % slots.length];
      const { x: lx, z: lz } = slotLocalXZ(geom, slot);
      const ly = geom.capHeightAt(lx, lz);

      const growthScale = 0.45 + 0.55 * structure.growth;
      const structScale = SIZE_SCALE[slot.size] * growthScale * stageScale;
      const yaw = (slot.rot + hash01(structure.id) * 14 - 7) * DEG;

      let shade = 0.8 + hash01(structure.id + "s") * 0.08;
      if (structure.state === "glowing") shade = 1.0;
      if (structure.state === "dormant") shade = 0.58;
      if (structure.state === "ruined") shade = 0.45;
      if (structure.state === "seed") shade = 0.7;

      const cosY = Math.cos(yaw);
      const sinY = Math.sin(yaw);

      for (const part of GREYBOX_RECIPES[structure.type]) {
        const [ox, oy, oz] = part.offset;
        const rx = (ox * cosY - oz * sinY) * structScale;
        const rz = (ox * sinY + oz * cosY) * structScale;
        pools[part.kind].push({
          position: [
            island.position[0] + lx + rx,
            island.position[1] + ly + oy * structScale,
            island.position[2] + lz + rz,
          ],
          rotY: yaw + (part.rotY ?? 0) * DEG,
          scale: [
            part.scale[0] * structScale,
            part.scale[1] * structScale,
            part.scale[2] * structScale,
          ],
          shade,
        });
      }
    }
  }

  return pools;
}
