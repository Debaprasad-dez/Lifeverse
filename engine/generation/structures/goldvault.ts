/**
 * Gold Vault — pure placement for the Finance Kingdom re-skin (visual only,
 * island-scoped). Produces island-LOCAL anchors the renderer (FinanceLayer)
 * turns into meshes: the hero Crystal Vault spire, gem-tree clusters, crystal
 * outcroppings on the tier edges, a liquid-silver pool, and ground sparkle
 * glints. Avoids the placed structures so picking/entry stay intact.
 */

import { Vector3 } from "three";
import type { IslandGeometry } from "@/engine/generation/island";
import { type CoreKingdomId, type Island } from "@/engine/schema/world";
import { SIZE_SCALE, SLOT_MAPS } from "@/engine/resolver/slots";
import { slotLocalXZ } from "@/engine/resolver/resolve";
import { mulberry32 } from "@/lib/noise";

export interface GemTree { x: number; z: number; y: number; h: number; w: number }
export interface Outcrop { x: number; z: number; y: number; h: number; rot: number; tilt: number; tint: number }
export interface GoldVault {
  vault: { x: number; z: number; y: number; h: number; w: number };
  gemTrees: GemTree[];
  outcrops: Outcrop[];
  pool: { x: number; z: number; y: number; r: number };
  sparkles: Vector3[];
  vaultStructureId: string | null;
}

export function buildGoldVault(island: Island, geom: IslandGeometry, radius: number): GoldVault {
  const rng = mulberry32(0x60d0 ^ Math.round(radius * 100));
  const slots = SLOT_MAPS[island.id as CoreKingdomId] ?? [];
  const avoid = island.structures.map((s) => {
    const sl = slots[s.slot % slots.length];
    const { x, z } = slotLocalXZ(geom, sl);
    return { x, z, r: 2.2 * SIZE_SCALE[sl.size] };
  });
  const placed: { x: number; z: number; r: number }[] = [];
  const clearOf = (x: number, z: number, r: number): boolean =>
    !avoid.some((a) => Math.hypot(x - a.x, z - a.z) < a.r + r) &&
    !placed.some((p) => Math.hypot(x - p.x, z - p.z) < p.r + r);

  const localAt = (theta: number, rFrac: number): { x: number; z: number; y: number } => {
    const f = geom.footprintAt(theta);
    const x = Math.cos(theta) * f * rFrac;
    const z = Math.sin(theta) * f * rFrac;
    return { x, z, y: geom.capHeightAt(x, z) };
  };

  // hero Crystal Vault — citadel, clear of structures
  const vp = localAt(0.0, 0.2);
  const vaultW = radius * 0.16;
  const vault = { x: vp.x, z: vp.z, y: vp.y, h: radius * 0.7, w: vaultW };
  placed.push({ x: vp.x, z: vp.z, r: vaultW * 1.5 });

  // gem-tree clusters across the tiers
  const gemTrees: GemTree[] = [];
  for (let i = 0; i < 26; i++) {
    const theta = rng() * Math.PI * 2;
    const rFrac = 0.14 + rng() * 0.66;
    const p = localAt(theta, rFrac);
    const w = radius * (0.05 + rng() * 0.03);
    if (!clearOf(p.x, p.z, w * 1.6)) continue;
    placed.push({ x: p.x, z: p.z, r: w * 1.6 });
    gemTrees.push({ x: p.x, z: p.z, y: p.y, h: radius * (0.14 + rng() * 0.12), w });
  }

  // crystal outcroppings along the tier edges
  const outcrops: Outcrop[] = [];
  for (let i = 0; i < 16; i++) {
    const theta = rng() * Math.PI * 2;
    const rFrac = 0.55 + rng() * 0.34;
    const p = localAt(theta, rFrac);
    outcrops.push({
      x: p.x,
      z: p.z,
      y: p.y,
      h: radius * (0.06 + rng() * 0.1),
      rot: rng() * Math.PI * 2,
      tilt: (rng() - 0.5) * 0.5,
      tint: Math.floor(rng() * 3),
    });
  }

  // liquid-silver pool on a mid tier
  const pp = localAt(2.1, 0.42);
  const pool = { x: pp.x, z: pp.z, y: pp.y, r: radius * 0.15 };

  // ground sparkle glints
  const sparkles: Vector3[] = [];
  for (let i = 0; i < 60; i++) {
    const theta = rng() * Math.PI * 2;
    const rFrac = 0.08 + rng() * 0.82;
    const p = localAt(theta, rFrac);
    sparkles.push(new Vector3(p.x, p.y + 0.08, p.z));
  }

  const vaultStructureId =
    island.structures.find((s) => s.type === "asset_vault")?.id ??
    island.structures.find((s) => s.type === "investment_tower")?.id ??
    island.structures.find((s) => s.type === "savings_fortress")?.id ??
    null;

  return { vault, gemTrees, outcrops, pool, sparkles, vaultStructureId };
}
