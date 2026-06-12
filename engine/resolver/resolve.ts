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
import { memoryParts, monumentParts } from "@/engine/generation/structures/landmarks";
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
  /** Index into ResolvedStructures.anchors — instanceId → structure picking. */
  anchorIdx: number;
}

export type PartPools = Record<PrimKind, PartInstance[]>;

/** Interaction/UI anchor for one placed structure, monument, or memory. */
export interface StructureAnchor {
  /** What this anchor points at — routes the click to the right sheet. */
  kind: "structure" | "monument" | "memory";
  islandId: KingdomId;
  /** Structure id, monument id, or memory id (uniform picking key). */
  structureId: string;
  type: string;
  label: string;
  description: string;
  growth: number;
  state: string;
  /** ISO date for landmarks (monuments/memories). */
  date?: string;
  /** World position at the structure's base. */
  position: [number, number, number];
  /** Hit-proxy radius (also sheet anchor height hint). */
  radius: number;
  height: number;
}

export interface ResolvedStructures {
  body: PartPools;
  glow: PartPools;
  anchors: StructureAnchor[];
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
  const anchors: StructureAnchor[] = [];

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

      // structure state tunes color: dormant fades, ruined darkens
      const dimBody =
        structure.state === "dormant" ? 0.62 : structure.state === "ruined" ? 0.45 : 1;
      const glowBoost = structure.state === "glowing" ? 1.5 : 1;

      const parts: Part[] = buildStructureParts(
        structure.type,
        layout.palette,
        island.evolutionStage
      );

      let top = 0;
      for (const part of parts) {
        top = Math.max(top, (part.offset[1] + part.scale[1] / 2) * structScale);
      }
      anchors.push({
        kind: "structure",
        islandId: island.id,
        structureId: structure.id,
        type: structure.type,
        label: structure.meaning.label,
        description: structure.meaning.description,
        growth: structure.growth,
        state: structure.state,
        position: [island.position[0] + lx, island.position[1] + ly, island.position[2] + lz],
        radius: Math.max(1.3, structScale * 1.5),
        height: top,
      });

      pushParts(parts, {
        body,
        glow,
        anchorIdx: anchors.length - 1,
        origin: [island.position[0] + lx, island.position[1] + ly, island.position[2] + lz],
        yaw,
        scale: structScale,
        glowMul: (0.8 + analytics.glowMul) * glowBoost,
        dimBody,
      });
    }
  }

  // ---- landmarks: achievement monuments + memory landmarks ----------------
  // Placed deterministically on a rim ring (angle from id hash), outside the
  // structure slots; gold for achievements, pastels for memories.
  const placeLandmark = (
    islandId: KingdomId,
    id: string,
    rFrac: number,
    parts: Part[],
    scale: number,
    anchor: Omit<StructureAnchor, "position" | "radius" | "height">
  ): void => {
    const island = state.islands.find((i) => i.id === islandId);
    const geom = geometries.get(islandId);
    if (!island || island.locked || !geom) return;
    const theta = hash01(id) * Math.PI * 2;
    const footprint = geom.footprintAt(theta);
    const lx = Math.cos(theta) * footprint * rFrac;
    const lz = Math.sin(theta) * footprint * rFrac;
    const ly = geom.capHeightAt(lx, lz) - 0.06;
    const yaw = Math.atan2(-lz, -lx); // face island center

    let top = 0;
    for (const part of parts) {
      top = Math.max(top, (part.offset[1] + part.scale[1] / 2) * scale);
    }
    anchors.push({
      ...anchor,
      position: [island.position[0] + lx, island.position[1] + ly, island.position[2] + lz],
      radius: Math.max(1.1, scale * 1.4),
      height: top,
    });
    pushParts(parts, {
      body,
      glow,
      anchorIdx: anchors.length - 1,
      origin: [island.position[0] + lx, island.position[1] + ly, island.position[2] + lz],
      yaw,
      scale,
      glowMul: 1.25,
      dimBody: 1,
    });
  };

  for (const monument of state.monuments) {
    const layout = KINGDOM_LAYOUTS[monument.islandId as CoreKingdomId];
    if (!layout) continue;
    placeLandmark(
      monument.islandId,
      monument.id,
      0.78,
      monumentParts(monument.kind, layout.palette),
      1.5,
      {
        kind: "monument",
        islandId: monument.islandId,
        structureId: monument.id,
        type: monument.kind,
        label: monument.title,
        description: monument.story,
        growth: 1,
        state: "glowing",
        date: monument.date,
      }
    );
  }

  for (const memory of state.memories) {
    const layout = KINGDOM_LAYOUTS[memory.islandId as CoreKingdomId];
    if (!layout) continue;
    placeLandmark(
      memory.islandId,
      memory.id,
      0.62,
      memoryParts(memory.kind, layout.palette),
      0.95,
      {
        kind: "memory",
        islandId: memory.islandId,
        structureId: memory.id,
        type: memory.kind,
        label: memory.title,
        description: memory.story,
        growth: 1,
        state: "complete",
        date: memory.date,
      }
    );
  }

  return { body, glow, anchors };
}

interface PushOpts {
  body: PartPools;
  glow: PartPools;
  anchorIdx: number;
  origin: [number, number, number];
  yaw: number;
  scale: number;
  glowMul: number;
  dimBody: number;
}

function pushParts(parts: Part[], opts: PushOpts): void {
  const cosY = Math.cos(opts.yaw);
  const sinY = Math.sin(opts.yaw);
  for (const part of parts) {
    const [ox, oy, oz] = part.offset;
    const rx = (ox * cosY - oz * sinY) * opts.scale;
    const rz = (ox * sinY + oz * cosY) * opts.scale;
    const instance: PartInstance = {
      position: [opts.origin[0] + rx, opts.origin[1] + oy * opts.scale, opts.origin[2] + rz],
      rotY: opts.yaw + (part.rotY ?? 0) * DEG,
      scale: [part.scale[0] * opts.scale, part.scale[1] * opts.scale, part.scale[2] * opts.scale],
      color: part.color,
      anchorIdx: opts.anchorIdx,
    };

    if (part.glow) {
      // lightingIntensity drives window brightness — diegetic analytics.
      // HDR color (can exceed 1) so Bloom reads it as a light source.
      instance.color = tmpColor.set(part.color).multiplyScalar(opts.glowMul).clone();
      opts.glow[part.kind].push(instance);
    } else {
      if (opts.dimBody < 1) {
        instance.color = tmpColor.set(part.color).multiplyScalar(opts.dimBody).clone();
      }
      opts.body[part.kind].push(instance);
    }
  }
}
