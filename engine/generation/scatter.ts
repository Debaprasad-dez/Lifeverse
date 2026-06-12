/**
 * Seeded scatter sampling on an island cap — flora placement with minimum
 * spacing, slope rejection, and keep-out zones (waterfall lip, label, paths).
 */

import { mulberry32 } from "@/lib/noise";
import type { IslandGeometry } from "./island";

export interface ScatterPoint {
  x: number;
  y: number;
  z: number;
  scale: number;
  rotationY: number;
}

export interface ScatterOptions {
  count: number;
  minDistance: number;
  /** Radial band on the cap, as fractions of the footprint. */
  radialMin?: number;
  radialMax?: number;
  /** Reject points where the cap is steeper than this (rise per unit). */
  maxSlope?: number;
  scaleRange?: [number, number];
  avoid?: { x: number; z: number; r: number }[];
}

export function scatterOnCap(
  seed: number,
  island: IslandGeometry,
  options: ScatterOptions
): ScatterPoint[] {
  const {
    count,
    minDistance,
    radialMin = 0.05,
    radialMax = 0.86,
    maxSlope = 0.85,
    scaleRange = [0.8, 1.3],
    avoid = [],
  } = options;
  const rng = mulberry32(seed);
  const points: ScatterPoint[] = [];
  const maxAttempts = count * 30;

  for (let attempt = 0; attempt < maxAttempts && points.length < count; attempt++) {
    const theta = rng() * Math.PI * 2;
    // sqrt for area-uniform radial distribution
    const sFrac = radialMin + (radialMax - radialMin) * Math.sqrt(rng());
    const f = island.footprintAt(theta);
    const x = Math.cos(theta) * f * sFrac;
    const z = Math.sin(theta) * f * sFrac;

    if (avoid.some((a) => Math.hypot(x - a.x, z - a.z) < a.r)) continue;
    if (points.some((p) => Math.hypot(x - p.x, z - p.z) < minDistance)) continue;

    const y = island.capHeightAt(x, z);
    const e = 0.6;
    const slopeX = (island.capHeightAt(x + e, z) - island.capHeightAt(x - e, z)) / (2 * e);
    const slopeZ = (island.capHeightAt(x, z + e) - island.capHeightAt(x, z - e)) / (2 * e);
    if (Math.hypot(slopeX, slopeZ) > maxSlope) continue;

    points.push({
      x,
      y,
      z,
      scale: scaleRange[0] + rng() * (scaleRange[1] - scaleRange[0]),
      rotationY: rng() * Math.PI * 2,
    });
  }
  return points;
}
