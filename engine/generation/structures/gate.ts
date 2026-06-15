/**
 * Ceremonial arc gate — one per island. A columned stone arch standing at the
 * kingdom's "front" rim (the same facing the floating label uses), so it reads
 * as the natural threshold you fly through to enter. Pure placement: it returns
 * a local frame that both the renderer (GateLayer) and the flora keep-out
 * (WorldGraph) consume, so the gate and the meadow never fight for the spot.
 */

import type { IslandGeometry } from "@/engine/generation/island";
import { CORE_KINGDOM_IDS, type CoreKingdomId, type Island } from "@/engine/schema/world";
import { clamp } from "@/lib/noise";
import { ECOSYSTEMS } from "@/engine/ecosystem";
import { GATE_RIVER_U, glacierRiverRFrac, glacierRiverTheta } from "./volcano";

/** Split biomes (Adventure) put the gate over the glacier river near the rim. */
function isSplitBiome(island: Island): boolean {
  return (
    CORE_KINGDOM_IDS.includes(island.id as CoreKingdomId) &&
    !!ECOSYSTEMS[island.id as CoreKingdomId].split
  );
}

export interface GateFrame {
  /** Gate center on the cap, island-local XZ + cap height. */
  x: number;
  z: number;
  y: number;
  /** Rotate about Y so local +X → tangent (the span), local +Z → inward. */
  yaw: number;
  /** Half-span = arch major radius = pillar offset from center. */
  width: number;
  /** Column height to the springline (where the arch springs). */
  pillarH: number;
  /** Member thickness (columns / arch tube). */
  thick: number;
  /** Flora keep-out disc (island-local), so the approach stays clear. */
  keepOut: { x: number; z: number; r: number };
}

/** Azimuth of the island's "front" — toward world center, label-matched.
 *  Adventure overrides this to the glacier-river crossing near the rim. */
export function gateTheta(island: Island): number {
  if (isSplitBiome(island)) return glacierRiverTheta(GATE_RIVER_U);
  const [px, , pz] = island.position;
  return Math.hypot(px, pz) < 5 ? 0.45 : Math.atan2(-pz, -px);
}

export function gateFrame(island: Island, geom: IslandGeometry, radius: number): GateFrame {
  // Adventure straddles the river at its rim crossing; Creativity stands over
  // its waterfall at the border; others sit inboard at the kingdom's front.
  let theta: number;
  let rFrac: number;
  if (isSplitBiome(island)) {
    theta = glacierRiverTheta(GATE_RIVER_U);
    rFrac = glacierRiverRFrac(GATE_RIVER_U);
  } else if (island.id === "creativity") {
    theta = geom.waterfall.theta;
    rFrac = 0.9;
  } else {
    theta = gateTheta(island);
    rFrac = 0.8;
  }
  const f = geom.footprintAt(theta);
  const x = Math.cos(theta) * f * rFrac;
  const z = Math.sin(theta) * f * rFrac;
  const y = geom.capHeightAt(x, z);
  // local +X must map to the tangent (-sinθ, cosθ): solve three's rotY basis
  const yaw = Math.atan2(-Math.cos(theta), -Math.sin(theta));
  const width = clamp(radius * 0.17, 1.7, 3.0);
  return {
    x,
    z,
    y,
    yaw,
    width,
    pillarH: width * 1.22,
    thick: clamp(width * 0.15, 0.22, 0.4),
    keepOut: { x, z, r: width * 1.7 },
  };
}
