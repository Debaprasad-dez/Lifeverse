/**
 * StructureType → parametric recipe. evolutionStage 1–5 adds tiers, props
 * and glow; the silhouettes stay chunky and readable per the reference
 * renders. Replaces the Phase-2 greybox catalog.
 */

import type { StructureType } from "@/engine/schema/world";
import {
  bannerKit,
  boatKit,
  bookstackKit,
  crystalKit,
  domeKit,
  gableKit,
  gearKit,
  lanternKit,
  place,
  tentKit,
  towerKit,
  type KingdomPalette,
  type Part,
} from "./kit";

type Recipe = (pal: KingdomPalette, stage: number) => Part[];

const s2 = (stage: number): boolean => stage >= 2;
const s3 = (stage: number): boolean => stage >= 3;
const s4 = (stage: number): boolean => stage >= 4;
const s5 = (stage: number): boolean => stage >= 5;

// shared composites ----------------------------------------------------------

const grandTower: Recipe = (pal, stage) => [
  ...towerKit(pal, 2 + Math.min(stage, 4), 1.15),
  ...(s2(stage) ? place(bannerKit(pal), [0.85, 0, 0.4]) : []),
  ...(s4(stage) ? place(towerKit(pal, 2, 0.5, { capSpire: false }), [0.95, 0, -0.5]) : []),
  ...(s5(stage) ? place(crystalKit(pal.glow, 3, 0.5), [-0.9, 0, 0.55]) : []),
];

const hall: Recipe = (pal, stage) => [
  ...gableKit(pal, 2.1, 1.3, { windows: 3 }),
  ...(s2(stage) ? place(lanternKit(pal), [1.25, 0, 0.55]) : []),
  ...(s3(stage) ? place(lanternKit(pal), [-1.25, 0, 0.55]) : []),
  ...(s4(stage) ? place(gableKit(pal, 1.1, 0.8, { door: false, windows: 1 }), [1.5, 0, -0.4], { rotY: 90 }) : []),
];

const observatory: Recipe = (pal, stage) => [
  ...domeKit(pal, 0.95),
  // telescope barrel
  { kind: "cylinder", offset: [0.25, 1.35, 0.2], scale: [0.16, 0.9, 0.16], rotY: 0, color: pal.trim },
  ...(s3(stage) ? place(crystalKit(pal.glow, 1, 0.4), [0.7, 0, -0.6]) : []),
  ...(s4(stage) ? place(domeKit(pal, 0.5), [-1.0, 0, 0.4]) : []),
];

const temple: Recipe = (pal, stage) => {
  const parts: Part[] = [
    { kind: "cylinder", offset: [0, 0.1, 0], scale: [2.2, 0.2, 2.2], color: pal.bodyB },
    { kind: "cylinder", offset: [0, 0.26, 0], scale: [1.7, 0.14, 1.7], color: pal.bodyA },
  ];
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    parts.push({
      kind: "cylinder",
      offset: [Math.cos(a) * 0.75, 0.75, Math.sin(a) * 0.75],
      scale: [0.16, 1.0, 0.16],
      color: pal.bodyA,
    });
  }
  parts.push({ kind: "cone", offset: [0, 1.5, 0], scale: [1.9, 0.5, 1.9], color: pal.roof });
  if (s3(stage)) parts.push({ kind: "sphere", offset: [0, 1.95, 0], scale: [0.22, 0.22, 0.22], color: pal.glow, glow: true });
  if (s5(stage)) parts.push(...place(crystalKit(pal.glow, 3, 0.45), [1.6, 0, 1.0]));
  return parts;
};

const fortress: Recipe = (pal, stage) => {
  const parts: Part[] = [
    { kind: "box", offset: [0, 0.55, 0], scale: [1.7, 1.1, 1.7], color: pal.bodyA },
  ];
  for (const [x, z] of [[0.85, 0.85], [-0.85, 0.85], [0.85, -0.85], [-0.85, -0.85]] as const) {
    parts.push({ kind: "cylinder", offset: [x, 0.8, z], scale: [0.34, 1.6, 0.34], color: pal.bodyB });
    parts.push({ kind: "cone", offset: [x, 1.78, z], scale: [0.42, 0.4, 0.42], color: pal.roof });
  }
  parts.push({ kind: "box", offset: [0, 0.4, 0.88], scale: [0.4, 0.8, 0.08], color: pal.trim });
  if (s2(stage)) parts.push({ kind: "box", offset: [0, 1.18, 0], scale: [1.2, 0.16, 1.2], color: pal.glow, glow: true });
  if (s4(stage)) parts.push({ kind: "box", offset: [0, 1.5, 0], scale: [0.9, 0.6, 0.9], color: pal.bodyA });
  return parts;
};

const harbor: Recipe = (pal, stage) => [
  { kind: "box", offset: [0, 0.1, 0], scale: [2.2, 0.2, 0.95], color: pal.trim },
  ...place(gableKit(pal, 0.9, 0.7, { windows: 1 }), [-0.6, 0.2, 0]),
  { kind: "cylinder", offset: [0.85, 0.75, 0.3], scale: [0.07, 1.3, 0.07], color: pal.bodyB },
  { kind: "sphere", offset: [0.85, 1.45, 0.3], scale: [0.12, 0.12, 0.12], color: pal.glow, glow: true },
  ...place(boatKit(pal), [1.3, 0.0, -0.5], { rotY: 20 }),
  ...(s3(stage) ? place(boatKit(pal), [-1.5, 0, -0.6], { rotY: -35, scale: 0.8 }) : []),
  ...(s4(stage) ? place(bannerKit(pal), [0.2, 0.2, 0.45]) : []),
];

const gardenBeds: Recipe = (pal, stage) => {
  const parts: Part[] = [{ kind: "cylinder", offset: [0, 0.07, 0], scale: [1.5, 0.14, 1.5], color: pal.trim }];
  const beds = 2 + Math.min(stage, 4);
  for (let i = 0; i < beds; i++) {
    const a = (i / beds) * Math.PI * 2;
    parts.push({
      kind: "dome",
      offset: [Math.cos(a) * 0.55, 0.14, Math.sin(a) * 0.55],
      scale: [0.34, 0.3, 0.34],
      color: i % 2 === 0 ? pal.roof : pal.glow,
      glow: i % 2 !== 0,
    });
  }
  if (s4(stage)) parts.push(...place(lanternKit(pal, 0.7), [0, 0, 0]));
  return parts;
};

const peakKit: Recipe = (pal, stage) => [
  { kind: "cone", offset: [0, 0.9, 0], scale: [1.3, 1.8, 1.3], color: pal.bodyB },
  { kind: "cone", offset: [0.6, 0.55, 0.3], scale: [0.7, 1.1, 0.7], color: pal.bodyA },
  { kind: "cone", offset: [0, 1.62, 0], scale: [0.5, 0.45, 0.5], color: "#f4f8fb" },
  ...(s2(stage) ? place(bannerKit(pal, 1.2), [0.12, 1.6, 0]) : []),
  ...(s5(stage) ? place(crystalKit(pal.glow, 2, 0.4), [-0.7, 0.1, 0.5]) : []),
];

const grove: Recipe = (pal, stage) => {
  const parts: Part[] = [];
  const n = 2 + Math.min(stage, 3);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + 0.6;
    const r = i === 0 ? 0 : 0.62;
    const h = i === 0 ? 1.5 : 1.0 + (i % 2) * 0.3;
    parts.push({ kind: "cylinder", offset: [Math.cos(a) * r, h * 0.3, Math.sin(a) * r], scale: [0.12, h * 0.6, 0.12], color: pal.trim });
    parts.push({ kind: "sphere", offset: [Math.cos(a) * r, h * 0.78, Math.sin(a) * r], scale: [h * 0.5, h * 0.42, h * 0.5], color: i % 2 === 0 ? "#5fb45a" : "#7fcf68" });
  }
  return parts;
};

const plazaKit: Recipe = (pal, stage) => [
  { kind: "cylinder", offset: [0, 0.08, 0], scale: [1.6, 0.16, 1.6], color: pal.bodyB },
  { kind: "box", offset: [0.62, 0.55, 0], scale: [0.18, 1.1, 0.18], color: pal.bodyA },
  { kind: "box", offset: [-0.62, 0.55, 0], scale: [0.18, 1.1, 0.18], color: pal.bodyA },
  { kind: "box", offset: [0, 1.14, 0], scale: [1.5, 0.2, 0.24], color: pal.roof },
  ...(s2(stage) ? place(lanternKit(pal, 0.8), [1.1, 0, 0.6]) : []),
  ...(s3(stage) ? place(lanternKit(pal, 0.8), [-1.1, 0, -0.6]) : []),
  ...(s4(stage) ? [{ kind: "sphere" as const, offset: [0, 1.4, 0] as [number, number, number], scale: [0.2, 0.2, 0.2] as [number, number, number], color: pal.glow, glow: true }] : []),
];

const lakeKit: Recipe = (pal, stage) => [
  { kind: "cylinder", offset: [0, 0.05, 0], scale: [1.7, 0.1, 1.7], color: "#7fd4e8", glow: true },
  { kind: "cylinder", offset: [0, 0.03, 0], scale: [1.95, 0.07, 1.95], color: pal.trim },
  ...(s2(stage) ? [{ kind: "dome" as const, offset: [0.9, 0.12, 0.5] as [number, number, number], scale: [0.26, 0.2, 0.26] as [number, number, number], color: pal.bodyB }] : []),
  ...(s4(stage) ? place(lanternKit(pal, 0.7), [-1.1, 0, -0.7]) : []),
];

const village: Recipe = (pal, stage) => [
  ...place(gableKit(pal, 1.1, 0.85, { windows: 1, chimney: true }), [-0.55, 0, 0.3], { rotY: 12 }),
  ...place(gableKit(pal, 0.95, 0.75, { windows: 1 }), [0.7, 0, -0.25], { rotY: -28, scale: 0.92 }),
  ...(s2(stage) ? place(gableKit(pal, 0.85, 0.7, { windows: 1, chimney: true }), [0.15, 0, 0.85], { rotY: 64, scale: 0.85 }) : []),
  ...(s3(stage) ? place(lanternKit(pal), [0, 0, 0]) : []),
];

const studio: Recipe = (pal, stage) => [
  ...gableKit(pal, 1.5, 1.05, { windows: 2 }),
  { kind: "box", offset: [0.3, 1.32, 0.2], scale: [0.5, 0.4, 0.5], rotY: 18, color: pal.bodyB },
  { kind: "box", offset: [0.3, 1.56, 0.2], scale: [0.54, 0.08, 0.54], rotY: 18, color: pal.glow, glow: true },
  ...(s3(stage) ? place(crystalKit(pal.glow, 2, 0.35), [-0.85, 0, 0.5]) : []),
];

// catalog ---------------------------------------------------------------------

export const RECIPES: Record<StructureType, Recipe> = {
  // career — neon-tech mini-city
  career_tower: grandTower,
  promotion_hall: hall,
  skill_academy: (pal, st) => [
    ...towerKit(pal, 2, 0.8),
    ...(s2(st) ? place(gableKit(pal, 1.0, 0.7, { windows: 1 }), [0.85, 0, 0.2], { rotY: -20, scale: 0.9 }) : []),
  ],
  leadership_castle: fortress,
  opportunity_harbor: harbor,
  mentor_observatory: observatory,
  project_museum: (pal, st) => [
    ...hall(pal, st),
    ...place(gearKit(pal, 0.42), [0, 1.85, 0]),
  ],
  // health
  fitness_forest: grove,
  habit_garden: gardenBeds,
  wellness_lake: lakeKit,
  energy_mountain: peakKit,
  meditation_sanctuary: (pal, st) => [
    ...domeKit(pal, 0.7),
    ...(s2(st) ? place(lanternKit(pal, 0.7), [0.85, 0, 0.35]) : []),
    ...(s3(st) ? place(lanternKit(pal, 0.7), [-0.85, 0, 0.35]) : []),
  ],
  recovery_center: hall,
  nutrition_village: village,
  // learning
  knowledge_library: (pal, st) => [
    ...hall(pal, st),
    ...place(bookstackKit(pal), [1.35, 0.9, 0.3], { scale: 1.2 }),
    ...(s3(st) ? place(bookstackKit(pal), [-1.3, 0.9, -0.2], { scale: 0.9 }) : []),
  ],
  research_observatory: observatory,
  skill_tower: (pal, st) => towerKit(pal, 1 + Math.min(st, 4), 0.75),
  wisdom_temple: temple,
  learning_academy: hall,
  scholar_hub: (pal, st) => [
    ...domeKit(pal, 0.6),
    ...(s2(st) ? place(bookstackKit(pal), [0.75, 0, 0.4]) : []),
  ],
  discovery_forest: grove,
  // finance
  merchant_harbor: harbor,
  investment_tower: grandTower,
  asset_vault: fortress,
  income_district: (pal, st) => [
    ...place(gableKit(pal, 1.2, 0.9, { windows: 2 }), [-0.6, 0, 0.2], { rotY: 8 }),
    ...place(towerKit(pal, 2, 0.6), [0.75, 0, -0.3]),
    ...(s3(st) ? place(lanternKit(pal), [0, 0, 0.8]) : []),
  ],
  business_plaza: plazaKit,
  savings_fortress: fortress,
  // relationships
  family_village: village,
  friendship_district: village,
  relationship_bridge: plazaKit,
  community_square: plazaKit,
  memory_garden: gardenBeds,
  celebration_plaza: (pal, st) => [
    ...plazaKit(pal, st),
    ...(s2(st) ? place(lanternKit(pal, 1.1), [0.8, 0, -0.8]) : []),
    ...(s3(st) ? place(lanternKit(pal, 1.3), [-0.85, 0, 0.75]) : []),
  ],
  // creativity
  art_studio: studio,
  music_hall: (pal, st) => [
    ...domeKit(pal, 0.9),
    ...(s2(st) ? place(crystalKit(pal.glow, 2, 0.35), [0.95, 0, 0.4]) : []),
  ],
  film_theater: hall,
  idea_factory: (pal, st) => [
    ...gableKit(pal, 1.6, 1.1, { windows: 2, chimney: true }),
    { kind: "sphere", offset: [0.45, 1.78, 0], scale: [0.2, 0.24, 0.2], color: pal.glow, glow: true },
    ...(s4(st) ? [{ kind: "sphere" as const, offset: [0.45, 2.15, 0] as [number, number, number], scale: [0.12, 0.14, 0.12] as [number, number, number], color: pal.glow, glow: true }] : []),
  ],
  dream_workshop: studio,
  innovation_lab: (pal, st) => [
    ...domeKit(pal, 0.75),
    ...(s3(st) ? place(gearKit(pal, 0.35), [0.85, 0.2, 0.4]) : []),
  ],
  // adventure
  quest_port: harbor,
  expedition_camp: (pal, st) => [
    ...tentKit(pal),
    ...place(tentKit(pal, 0.5), [0.95, 0, 0.35], { rotY: 40 }),
    { kind: "sphere", offset: [0.4, 0.16, -0.55], scale: [0.18, 0.14, 0.18], color: "#ff9f4a", glow: true },
    ...(s2(st) ? place(bannerKit(pal), [-0.6, 0, 0.55]) : []),
  ],
  dream_mountain: peakKit,
  exploration_isle: grove,
  future_observatory: (pal, st) => [
    ...observatory(pal, st),
    ...(s2(st) ? place(crystalKit("#d8b8ff", 3, 0.5), [-1.0, 0, -0.6]) : []),
  ],
};

export function buildStructureParts(
  type: StructureType,
  pal: KingdomPalette,
  stage: number
): Part[] {
  return RECIPES[type](pal, Math.max(1, Math.min(5, Math.round(stage))));
}
