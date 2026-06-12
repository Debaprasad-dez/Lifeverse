/**
 * Hand-authored slot maps — 12+ anchor points per kingdom. Procedural
 * placement, art-directed positions: the resolver assigns structure.slot →
 * one of these, guaranteeing good composition no matter what the AI emits.
 *
 * t = azimuth degrees, r = radial fraction of footprint, size class scales
 * the whole structure, rot = base yaw degrees.
 */

import type { CoreKingdomId } from "@/engine/schema/world";

export type SlotSize = "S" | "M" | "L";

export interface Slot {
  t: number;
  r: number;
  size: SlotSize;
  rot: number;
}

export const SIZE_SCALE: Record<SlotSize, number> = { S: 0.85, M: 1.2, L: 1.8 };

export const SLOT_MAPS: Record<CoreKingdomId, Slot[]> = {
  // dense tech-city: hero tower center, civic ring, outskirts
  career: [
    { t: 0, r: 0.12, size: "L", rot: 15 },
    { t: 55, r: 0.42, size: "M", rot: 235 },
    { t: 115, r: 0.45, size: "M", rot: 295 },
    { t: 180, r: 0.4, size: "M", rot: 0 },
    { t: 245, r: 0.44, size: "M", rot: 65 },
    { t: 305, r: 0.42, size: "M", rot: 125 },
    { t: 30, r: 0.68, size: "S", rot: 210 },
    { t: 85, r: 0.72, size: "S", rot: 265 },
    { t: 150, r: 0.7, size: "S", rot: 330 },
    { t: 215, r: 0.71, size: "S", rot: 35 },
    { t: 275, r: 0.69, size: "S", rot: 95 },
    { t: 335, r: 0.72, size: "S", rot: 155 },
    { t: 200, r: 0.18, size: "M", rot: 20 },
  ],
  // organic forest clearings
  health: [
    { t: 200, r: 0.3, size: "L", rot: 20 },
    { t: 80, r: 0.5, size: "M", rot: 260 },
    { t: 320, r: 0.58, size: "M", rot: 140 },
    { t: 140, r: 0.46, size: "M", rot: 320 },
    { t: 25, r: 0.72, size: "S", rot: 205 },
    { t: 105, r: 0.76, size: "S", rot: 285 },
    { t: 170, r: 0.7, size: "S", rot: 350 },
    { t: 250, r: 0.66, size: "S", rot: 70 },
    { t: 290, r: 0.78, size: "S", rot: 110 },
    { t: 355, r: 0.55, size: "S", rot: 175 },
    { t: 60, r: 0.25, size: "M", rot: 240 },
    { t: 230, r: 0.55, size: "M", rot: 50 },
  ],
  // scholarly crescent facing the world center
  learning: [
    { t: 210, r: 0.32, size: "L", rot: 30 },
    { t: 150, r: 0.52, size: "M", rot: 330 },
    { t: 270, r: 0.55, size: "M", rot: 90 },
    { t: 120, r: 0.72, size: "S", rot: 300 },
    { t: 180, r: 0.7, size: "S", rot: 0 },
    { t: 240, r: 0.74, size: "S", rot: 60 },
    { t: 300, r: 0.7, size: "S", rot: 120 },
    { t: 30, r: 0.5, size: "M", rot: 210 },
    { t: 75, r: 0.68, size: "S", rot: 255 },
    { t: 330, r: 0.45, size: "M", rot: 150 },
    { t: 0, r: 0.16, size: "M", rot: 180 },
    { t: 105, r: 0.4, size: "S", rot: 285 },
  ],
  // harbor cluster on one shore, vault inland
  finance: [
    { t: 45, r: 0.42, size: "L", rot: 225 },
    { t: 0, r: 0.6, size: "M", rot: 180 },
    { t: 90, r: 0.58, size: "M", rot: 270 },
    { t: 330, r: 0.75, size: "S", rot: 150 },
    { t: 45, r: 0.78, size: "S", rot: 225 },
    { t: 120, r: 0.74, size: "S", rot: 300 },
    { t: 200, r: 0.15, size: "M", rot: 20 },
    { t: 250, r: 0.5, size: "M", rot: 70 },
    { t: 290, r: 0.62, size: "S", rot: 110 },
    { t: 165, r: 0.55, size: "S", rot: 345 },
    { t: 215, r: 0.68, size: "S", rot: 35 },
    { t: 140, r: 0.32, size: "M", rot: 320 },
  ],
  // village ring around a central plaza
  relationships: [
    { t: 0, r: 0.08, size: "L", rot: 0 },
    { t: 36, r: 0.48, size: "M", rot: 216 },
    { t: 108, r: 0.5, size: "M", rot: 288 },
    { t: 180, r: 0.48, size: "M", rot: 0 },
    { t: 252, r: 0.5, size: "M", rot: 72 },
    { t: 324, r: 0.48, size: "M", rot: 144 },
    { t: 20, r: 0.74, size: "S", rot: 200 },
    { t: 90, r: 0.76, size: "S", rot: 270 },
    { t: 160, r: 0.73, size: "S", rot: 340 },
    { t: 230, r: 0.75, size: "S", rot: 50 },
    { t: 300, r: 0.74, size: "S", rot: 120 },
    { t: 145, r: 0.3, size: "S", rot: 325 },
  ],
  // loose spiral out from the muse fountain
  creativity: [
    { t: 0, r: 0.1, size: "L", rot: 0 },
    { t: 70, r: 0.28, size: "M", rot: 250 },
    { t: 140, r: 0.4, size: "M", rot: 320 },
    { t: 210, r: 0.5, size: "M", rot: 30 },
    { t: 280, r: 0.58, size: "S", rot: 100 },
    { t: 350, r: 0.66, size: "S", rot: 170 },
    { t: 60, r: 0.72, size: "S", rot: 240 },
    { t: 130, r: 0.76, size: "S", rot: 310 },
    { t: 240, r: 0.74, size: "S", rot: 60 },
    { t: 310, r: 0.4, size: "M", rot: 130 },
    { t: 170, r: 0.62, size: "S", rot: 350 },
    { t: 30, r: 0.46, size: "M", rot: 210 },
  ],
  // peaks at the rim, camps between, port on the cliff edge
  adventure: [
    { t: 10, r: 0.68, size: "L", rot: 190 },
    { t: 100, r: 0.64, size: "M", rot: 280 },
    { t: 190, r: 0.66, size: "M", rot: 10 },
    { t: 280, r: 0.62, size: "M", rot: 100 },
    { t: 55, r: 0.85, size: "M", rot: 235 },
    { t: 145, r: 0.42, size: "S", rot: 325 },
    { t: 235, r: 0.4, size: "S", rot: 55 },
    { t: 325, r: 0.44, size: "S", rot: 145 },
    { t: 0, r: 0.15, size: "M", rot: 180 },
    { t: 75, r: 0.3, size: "S", rot: 255 },
    { t: 165, r: 0.78, size: "S", rot: 345 },
    { t: 255, r: 0.76, size: "S", rot: 75 },
  ],
};
