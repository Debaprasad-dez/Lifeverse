/**
 * Life → world. Every check-in maps to typed WorldDeltas; streaks add
 * rare rewards (3 days: vitality surge, 7 days: aurora over the kingdom).
 * Decay is gentle — neglect reads as "sleeping", never as punishment.
 */

import { clamp } from "@/lib/noise";
import type { CoreKingdomId, StructureType, WorldDelta, WorldState } from "@/engine/schema/world";

export type LifeEventKind =
  | "exercise"
  | "meditate"
  | "read"
  | "study"
  | "save"
  | "skill_practice"
  | "ship"
  | "outreach"
  | "create"
  | "explore";

export interface LifeEvent {
  kind: LifeEventKind;
  at: string; // ISO
}

export interface LifeEventSpec {
  islandId: CoreKingdomId;
  label: string;
  /** Structure type whose growth advances (first match on the island). */
  grows?: StructureType;
  growthStep: number;
  vitalityStep: number;
  floraStep?: number;
  bridge?: [CoreKingdomId, CoreKingdomId];
}

export const LIFE_EVENTS: Record<LifeEventKind, LifeEventSpec> = {
  exercise: {
    islandId: "health",
    label: "Worked out",
    grows: "fitness_forest",
    growthStep: 0.05,
    vitalityStep: 0.04,
    floraStep: 0.03,
  },
  meditate: {
    islandId: "health",
    label: "Meditated",
    grows: "meditation_sanctuary",
    growthStep: 0.06,
    vitalityStep: 0.03,
  },
  read: {
    islandId: "learning",
    label: "Read 30 min",
    grows: "knowledge_library",
    growthStep: 0.05,
    vitalityStep: 0.03,
  },
  study: {
    islandId: "learning",
    label: "Studied a skill",
    grows: "skill_tower",
    growthStep: 0.06,
    vitalityStep: 0.03,
  },
  save: {
    islandId: "finance",
    label: "Saved money",
    grows: "savings_fortress",
    growthStep: 0.05,
    vitalityStep: 0.04,
  },
  skill_practice: {
    islandId: "career",
    label: "Practiced a skill",
    grows: "skill_academy",
    growthStep: 0.06,
    vitalityStep: 0.03,
  },
  ship: {
    islandId: "career",
    label: "Shipped work",
    grows: "career_tower",
    growthStep: 0.07,
    vitalityStep: 0.05,
  },
  outreach: {
    islandId: "relationships",
    label: "Reached out",
    grows: "family_village",
    growthStep: 0.05,
    vitalityStep: 0.04,
    bridge: ["relationships", "health"],
  },
  create: {
    islandId: "creativity",
    label: "Made something",
    grows: "art_studio",
    growthStep: 0.06,
    vitalityStep: 0.05,
  },
  explore: {
    islandId: "adventure",
    label: "Explored",
    grows: "expedition_camp",
    growthStep: 0.05,
    vitalityStep: 0.04,
  },
};

export function lifeEventToDeltas(
  kind: LifeEventKind,
  state: WorldState,
  streakDays: number
): WorldDelta[] {
  const spec = LIFE_EVENTS[kind];
  const island = state.islands.find((i) => i.id === spec.islandId);
  if (!island || island.locked) return [];

  const deltas: WorldDelta[] = [];
  // streaks amplify gently: 1x → 1.5x at 7+ days
  const mult = 1 + Math.min(streakDays, 7) * 0.07;

  deltas.push({
    type: "vitality_changed",
    islandId: spec.islandId,
    vitality: clamp(island.vitality + spec.vitalityStep * mult, 0, 1),
  });

  if (spec.floraStep) {
    deltas.push({
      type: "ecosystem_changed",
      islandId: spec.islandId,
      ecosystem: {
        flora: clamp(island.ecosystem.flora + spec.floraStep * mult, 0, 1),
      },
    });
  }

  if (spec.grows) {
    const target = island.structures.find((s) => s.type === spec.grows);
    if (target) {
      const growth = clamp(target.growth + spec.growthStep * mult, 0, 1);
      deltas.push({
        type: "structure_grown",
        islandId: spec.islandId,
        structureId: target.id,
        growth,
        state: growth >= 1 ? "glowing" : target.state === "seed" ? "rising" : target.state,
      });
    }
  }

  if (spec.bridge) {
    const [from, to] = spec.bridge;
    const existing = state.bridges.find(
      (b) => (b.from === from && b.to === to) || (b.from === to && b.to === from)
    );
    deltas.push({
      type: "bridge_strengthened",
      from,
      to,
      strength: clamp((existing?.strength ?? 0.2) + 0.04 * mult, 0, 1),
    });
  }

  // streak milestones — rare visual rewards
  if (streakDays === 3) {
    deltas.push({
      type: "ecosystem_changed",
      islandId: spec.islandId,
      ecosystem: { flora: clamp(island.ecosystem.flora + 0.08, 0, 1) },
    });
  }
  if (streakDays === 7) {
    deltas.push({ type: "weather_changed", islandId: spec.islandId, weather: "aurora" });
  }

  return deltas;
}
