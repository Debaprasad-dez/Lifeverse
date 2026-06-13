/**
 * Collectibles — hidden creatures, artifacts, relics drifting in the world,
 * found by exploring. Placement is deterministic (worldSeed + id): island-
 * bound ones orbit above their kingdom's cap; islandless ones (e.g. the
 * Cloud Whale) wander the open sky. The engine owns look + spawn; the schema
 * only knows found/not-found.
 */

import { mulberry32, seedFrom } from "@/lib/noise";
import type { Collectible } from "@/engine/schema/world";

export type CollectibleShape = "creature" | "artifact" | "relic" | "isle";

export interface CollectibleVisual {
  shape: CollectibleShape;
  body: string;
  glow: string;
  scale: number;
}

const VISUALS: Record<Collectible["kind"], CollectibleVisual> = {
  creature: { shape: "creature", body: "#ffe3b0", glow: "#ffd166", scale: 1.0 },
  artifact: { shape: "artifact", body: "#bfe3ff", glow: "#7ec8ff", scale: 0.9 },
  relic: { shape: "relic", body: "#e6c9ff", glow: "#c79cff", scale: 1.0 },
  hidden_isle: { shape: "isle", body: "#cdeccf", glow: "#9be8a8", scale: 1.3 },
};

export function collectibleVisual(kind: Collectible["kind"]): CollectibleVisual {
  return VISUALS[kind];
}

export interface CollectibleSpawn {
  id: string;
  collectible: Collectible;
  visual: CollectibleVisual;
  /** World anchor it bobs/orbits around. */
  anchor: [number, number, number];
  orbitR: number;
  orbitSpeed: number;
  phase: number;
  bobAmp: number;
  height: number;
}

interface IslandRef {
  id: string;
  position: [number, number, number];
  capTop: number; // world Y of cap surface near center
}

/**
 * Resolve spawn transforms for every UNFOUND collectible. islandRefs gives
 * each unlocked island's position + cap height; islandless collectibles use
 * the archipelago centroid and float higher/wider.
 */
export function resolveCollectibleSpawns(
  worldSeed: number,
  collectibles: Collectible[],
  islandRefs: IslandRef[]
): CollectibleSpawn[] {
  if (islandRefs.length === 0) return [];
  const cx = islandRefs.reduce((s, i) => s + i.position[0], 0) / islandRefs.length;
  const cz = islandRefs.reduce((s, i) => s + i.position[2], 0) / islandRefs.length;
  const cy = islandRefs.reduce((s, i) => s + i.position[1], 0) / islandRefs.length;

  const out: CollectibleSpawn[] = [];
  for (const c of collectibles) {
    if (c.found) continue;
    const rng = mulberry32(seedFrom(worldSeed, c.id));
    const host = c.islandId ? islandRefs.find((i) => i.id === c.islandId) : undefined;

    let anchor: [number, number, number];
    let orbitR: number;
    let height: number;
    if (host) {
      anchor = host.position;
      orbitR = 6 + rng() * 4;
      height = host.capTop - host.position[1] + 3.5 + rng() * 2;
    } else {
      // islandless wanderer — drifts through open sky over the archipelago
      anchor = [cx, cy, cz];
      orbitR = 60 + rng() * 30;
      height = 14 + rng() * 10;
    }

    out.push({
      id: c.id,
      collectible: c,
      visual: collectibleVisual(c.kind),
      anchor,
      orbitR,
      orbitSpeed: (0.08 + rng() * 0.1) * (rng() < 0.5 ? 1 : -1),
      phase: rng() * Math.PI * 2,
      bobAmp: 0.6 + rng() * 0.6,
      height,
    });
  }
  return out;
}
