/**
 * WorldState → render props. Flattens every structure on every unlocked
 * island into per-primitive instance pools — two material families (toon
 * body / unlit glow), one InstancedMesh per (family × primitive) for the
 * whole archipelago. The resolver owns ALL aesthetics.
 */

import { Color } from "three";
import type { IslandGeometry } from "@/engine/generation/island";
import type { Part, PrimKind } from "@/engine/generation/structures/kit";
import { buildStructureParts } from "@/engine/generation/structures/recipes";
import {
  CORE_KINGDOM_IDS,
  type CoreKingdomId,
  type KingdomId,
  type WorldState,
} from "@/engine/schema/world";
import { KINGDOM_LAYOUTS } from "./layout";
import { islandAnalytics } from "./analytics";
import { SIZE_SCALE, SLOT_MAPS } from "./slots";
import { DEG } from "@/lib/constants";

export interface PartInstance {
  position: [number, number, number];
  rotY: number;
  scale: [number, number, number];
  /** Color may exceed 1.0 (HDR) — glowing windows feed Bloom directly. */
  color: string | Color;
}

export type PartPools = Record<PrimKind, PartInstance[]>;

export interface ResolvedStructures {
  body: PartPools;
  glow: PartPools;
}

const emptyPools = (): PartPools => ({
  box: [],
  cylinder: [],
  cone: [],
  dome: [],
  sphere: [],
});

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

const tmpColor = new Color();

export function resolveStructures(
  state: WorldState,
  geometries: Map<KingdomId, IslandGeometry>
): ResolvedStructures {
  const body = emptyPools();
  const glow = emptyPools();

  for (const island of state.islands) {
    if (island.locked) continue;
    if (!CORE_KINGDOM_IDS.includes(island.id as CoreKingdomId)) continue;
    const geom = geometries.get(island.id);
    if (!geom) continue;

    const layout = KINGDOM_LAYOUTS[island.id as CoreKingdomId];
    const analytics = islandAnalytics(island);
    const slots = SLOT_MAPS[island.id as CoreKingdomId];
    const stageScale = 0.9 + island.evolutionStage * 0.07;

    for (const structure of island.structures) {
      const slot = slots[structure.slot % slots.length];
      const { x: lx, z: lz } = slotLocalXZ(geom, slot);
      const ly = geom.capHeightAt(lx, lz) - 0.08; // settle into the grass

      const growthScale = 0.45 + 0.55 * structure.growth;
      const structScale = SIZE_SCALE[slot.size] * growthScale * stageScale;
      const yaw = (slot.rot + hash01(structure.id) * 14 - 7) * DEG;
      const cosY = Math.cos(yaw);
      const sinY = Math.sin(yaw);

      // structure state tunes color: dormant fades, ruined darkens
      const dimBody =
        structure.state === "dormant" ? 0.62 : structure.state === "ruined" ? 0.45 : 1;
      const glowBoost = structure.state === "glowing" ? 1.5 : 1;

      const parts: Part[] = buildStructureParts(
        structure.type,
        layout.palette,
        island.evolutionStage
      );

      for (const part of parts) {
        const [ox, oy, oz] = part.offset;
        const rx = (ox * cosY - oz * sinY) * structScale;
        const rz = (ox * sinY + oz * cosY) * structScale;
        const instance: PartInstance = {
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
          color: part.color,
        };

        if (part.glow) {
          // lightingIntensity drives window brightness — diegetic analytics.
          // HDR color (can exceed 1) so Bloom reads it as a light source.
          instance.color = tmpColor
            .set(part.color)
            .multiplyScalar((0.8 + analytics.glowMul) * glowBoost)
            .clone();
          glow[part.kind].push(instance);
        } else {
          if (dimBody < 1) {
            instance.color = tmpColor.set(part.color).multiplyScalar(dimBody).clone();
          }
          body[part.kind].push(instance);
        }
      }
    }
  }

  return { body, glow };
}
