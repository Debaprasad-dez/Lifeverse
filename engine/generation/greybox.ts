/**
 * Greybox structure kit (Phase 2): every StructureType maps to a recipe of
 * shared primitives so the whole archipelago's buildings render as ~5
 * InstancedMesh draw calls. Distinct silhouettes now; kingdom dressing
 * replaces these in Phase 3.
 */

import type { StructureType } from "@/engine/schema/world";

export type PrimKind = "box" | "cylinder" | "cone" | "dome";

export interface GreyboxPart {
  kind: PrimKind;
  /** Offset from the structure anchor, in structure-local units (pre-scale). */
  offset: [number, number, number];
  scale: [number, number, number];
  rotY?: number;
}

// -- silhouette archetypes ---------------------------------------------------

const tower = (floors: number, w = 1): GreyboxPart[] => {
  const parts: GreyboxPart[] = [];
  let y = 0;
  for (let i = 0; i < floors; i++) {
    const fw = w * (1 - i * 0.16);
    const fh = 1.05 - i * 0.08;
    parts.push({ kind: "box", offset: [0, y + fh / 2, 0], scale: [fw, fh, fw], rotY: i * 12 });
    y += fh;
  }
  parts.push({ kind: "cone", offset: [0, y + 0.32, 0], scale: [w * 0.5, 0.65, w * 0.5] });
  return parts;
};

const hall = (w = 2, d = 1.2): GreyboxPart[] => [
  { kind: "box", offset: [0, 0.45, 0], scale: [w, 0.9, d] },
  { kind: "cone", offset: [0, 1.18, 0], scale: [d * 0.78, 0.55, d * 0.78], rotY: 45 },
];

const domed = (r = 0.9): GreyboxPart[] => [
  { kind: "cylinder", offset: [0, 0.38, 0], scale: [r, 0.76, r] },
  { kind: "dome", offset: [0, 0.76, 0], scale: [r * 0.92, r * 0.8, r * 0.92] },
];

const garden = (): GreyboxPart[] => [
  { kind: "cylinder", offset: [0, 0.06, 0], scale: [1.25, 0.12, 1.25] },
  { kind: "dome", offset: [0.45, 0.2, 0.2], scale: [0.3, 0.26, 0.3] },
  { kind: "dome", offset: [-0.4, 0.2, -0.25], scale: [0.34, 0.3, 0.34] },
  { kind: "dome", offset: [0.05, 0.2, -0.45], scale: [0.26, 0.22, 0.26] },
];

const fortress = (): GreyboxPart[] => [
  { kind: "box", offset: [0, 0.55, 0], scale: [1.7, 1.1, 1.7] },
  { kind: "cylinder", offset: [0.85, 0.75, 0.85], scale: [0.3, 1.5, 0.3] },
  { kind: "cylinder", offset: [-0.85, 0.75, 0.85], scale: [0.3, 1.5, 0.3] },
  { kind: "cylinder", offset: [0.85, 0.75, -0.85], scale: [0.3, 1.5, 0.3] },
  { kind: "cylinder", offset: [-0.85, 0.75, -0.85], scale: [0.3, 1.5, 0.3] },
];

const harbor = (): GreyboxPart[] => [
  { kind: "box", offset: [0, 0.1, 0], scale: [2.0, 0.2, 0.9] },
  { kind: "box", offset: [-0.55, 0.5, 0], scale: [0.7, 0.6, 0.6] },
  { kind: "cylinder", offset: [0.7, 0.65, 0.25], scale: [0.07, 1.1, 0.07] },
];

const peak = (): GreyboxPart[] => [
  { kind: "cone", offset: [0, 0.85, 0], scale: [1.1, 1.7, 1.1] },
  { kind: "cone", offset: [0.55, 0.5, 0.3], scale: [0.6, 1.0, 0.6] },
];

const grove = (): GreyboxPart[] => [
  { kind: "cone", offset: [0, 0.65, 0], scale: [0.55, 1.3, 0.55] },
  { kind: "cone", offset: [0.55, 0.5, 0.25], scale: [0.45, 1.0, 0.45] },
  { kind: "cone", offset: [-0.5, 0.55, -0.2], scale: [0.5, 1.1, 0.5] },
];

const plaza = (): GreyboxPart[] => [
  { kind: "cylinder", offset: [0, 0.07, 0], scale: [1.3, 0.14, 1.3] },
  { kind: "box", offset: [0.55, 0.5, 0], scale: [0.18, 1.0, 0.18] },
  { kind: "box", offset: [-0.55, 0.5, 0], scale: [0.18, 1.0, 0.18] },
  { kind: "box", offset: [0, 1.02, 0], scale: [1.35, 0.18, 0.22] },
];

const lake = (): GreyboxPart[] => [
  { kind: "cylinder", offset: [0, 0.05, 0], scale: [1.4, 0.1, 1.4] },
  { kind: "dome", offset: [0.9, 0.18, 0.4], scale: [0.22, 0.2, 0.22] },
];

const camp = (): GreyboxPart[] => [
  { kind: "cone", offset: [0, 0.4, 0], scale: [0.65, 0.8, 0.65], rotY: 30 },
  { kind: "cone", offset: [0.7, 0.3, 0.3], scale: [0.5, 0.6, 0.5] },
];

// -- catalog -----------------------------------------------------------------

export const GREYBOX_RECIPES: Record<StructureType, GreyboxPart[]> = {
  // career
  career_tower: tower(4, 1.1),
  promotion_hall: hall(2.1, 1.3),
  skill_academy: hall(1.7, 1.1),
  leadership_castle: fortress(),
  opportunity_harbor: harbor(),
  mentor_observatory: domed(0.85),
  project_museum: hall(2.3, 1.5),
  // health
  fitness_forest: grove(),
  habit_garden: garden(),
  wellness_lake: lake(),
  energy_mountain: peak(),
  meditation_sanctuary: domed(0.7),
  recovery_center: hall(1.5, 1.0),
  nutrition_village: camp(),
  // learning
  knowledge_library: hall(2.4, 1.4),
  research_observatory: domed(0.95),
  skill_tower: tower(3, 0.85),
  wisdom_temple: plaza(),
  learning_academy: hall(1.8, 1.2),
  scholar_hub: domed(0.65),
  discovery_forest: grove(),
  // finance
  merchant_harbor: harbor(),
  investment_tower: tower(4, 0.9),
  asset_vault: fortress(),
  income_district: hall(1.9, 1.3),
  business_plaza: plaza(),
  savings_fortress: fortress(),
  // relationships
  family_village: camp(),
  friendship_district: hall(1.7, 1.2),
  relationship_bridge: plaza(),
  community_square: plaza(),
  memory_garden: garden(),
  celebration_plaza: plaza(),
  // creativity
  art_studio: hall(1.4, 1.0),
  music_hall: domed(0.9),
  film_theater: hall(1.9, 1.2),
  idea_factory: tower(2, 1.0),
  dream_workshop: camp(),
  innovation_lab: domed(0.75),
  // adventure
  quest_port: harbor(),
  expedition_camp: camp(),
  dream_mountain: peak(),
  exploration_isle: grove(),
  future_observatory: domed(1.0),
};
