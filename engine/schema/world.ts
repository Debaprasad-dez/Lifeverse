/**
 * THE single source of truth: zod WorldState schema (LIFEVERSE_PLAN.md §3,
 * extended with the full product vision). AI and fixtures both produce this
 * shape; everything rendered is resolved from it. AI emits semantic state
 * only — the resolver owns every aesthetic decision.
 */

import { z } from "zod";

// ---------------------------------------------------------------------------
// Kingdoms
// ---------------------------------------------------------------------------

export const CORE_KINGDOM_IDS = [
  "career",
  "health",
  "learning",
  "finance",
  "relationships",
  "creativity",
  "adventure",
] as const;

export const UNLOCKABLE_KINGDOM_IDS = [
  "business",
  "family",
  "mindfulness",
  "community",
  "travel",
  "legacy",
] as const;

export const KINGDOM_IDS = [...CORE_KINGDOM_IDS, ...UNLOCKABLE_KINGDOM_IDS] as const;

export const KingdomIdSchema = z.enum(KINGDOM_IDS);
export type KingdomId = z.infer<typeof KingdomIdSchema>;
export type CoreKingdomId = (typeof CORE_KINGDOM_IDS)[number];

// ---------------------------------------------------------------------------
// Structures — full catalog per kingdom
// ---------------------------------------------------------------------------

export const STRUCTURE_TYPES = [
  // career
  "career_tower", "promotion_hall", "skill_academy", "leadership_castle",
  "opportunity_harbor", "mentor_observatory", "project_museum",
  // health
  "fitness_forest", "habit_garden", "wellness_lake", "energy_mountain",
  "meditation_sanctuary", "recovery_center", "nutrition_village",
  // learning
  "knowledge_library", "research_observatory", "skill_tower", "wisdom_temple",
  "learning_academy", "scholar_hub", "discovery_forest",
  // finance
  "merchant_harbor", "investment_tower", "asset_vault", "income_district",
  "business_plaza", "savings_fortress",
  // relationships
  "family_village", "friendship_district", "relationship_bridge",
  "community_square", "memory_garden", "celebration_plaza",
  // creativity
  "art_studio", "music_hall", "film_theater", "idea_factory",
  "dream_workshop", "innovation_lab",
  // adventure
  "quest_port", "expedition_camp", "dream_mountain", "exploration_isle",
  "future_observatory",
] as const;

export const StructureTypeSchema = z.enum(STRUCTURE_TYPES);
export type StructureType = z.infer<typeof StructureTypeSchema>;

export const StructureStateSchema = z.enum([
  "seed", "rising", "complete", "glowing", "dormant", "ruined",
]);
export type StructureState = z.infer<typeof StructureStateSchema>;

export const StructureSchema = z.object({
  id: z.string(),
  type: StructureTypeSchema,
  meaning: z.object({
    label: z.string(),
    description: z.string(),
    linkedGoalId: z.string().optional(),
  }),
  growth: z.number().min(0).max(1),
  state: StructureStateSchema,
  slot: z.number().int().min(0),
});
export type Structure = z.infer<typeof StructureSchema>;

// ---------------------------------------------------------------------------
// Islands
// ---------------------------------------------------------------------------

export const WeatherKindSchema = z.enum(["clear", "mist", "rain", "storm", "aurora"]);
export type WeatherKind = z.infer<typeof WeatherKindSchema>;

export const EcosystemSchema = z.object({
  flora: z.number().min(0).max(1),
  fauna: z.number().min(0).max(1),
  waterFlow: z.number().min(0).max(1),
  fogDensity: z.number().min(0).max(1),
  weather: WeatherKindSchema,
});
export type Ecosystem = z.infer<typeof EcosystemSchema>;

export const WorldEventSchema = z.object({
  id: z.string(),
  kind: z.string(), // e.g. "new_building_rising", "storm_clearing"
  islandId: KingdomIdSchema.optional(),
  at: z.string(), // ISO
});
export type WorldEvent = z.infer<typeof WorldEventSchema>;

export const IslandSchema = z.object({
  id: KingdomIdSchema,
  locked: z.boolean(),
  position: z.tuple([z.number(), z.number(), z.number()]),
  level: z.number().int().min(1).max(10),
  vitality: z.number().min(0).max(1),
  evolutionStage: z.number().int().min(1).max(5),
  structures: z.array(StructureSchema),
  ecosystem: EcosystemSchema,
  // diegetic analytics inputs (rendered as world, never charts)
  population: z.number().int().min(0),
  trafficFlow: z.number().min(0).max(1),
  lightingIntensity: z.number().min(0).max(1),
  localEvents: z.array(WorldEventSchema),
});
export type Island = z.infer<typeof IslandSchema>;

// ---------------------------------------------------------------------------
// World furniture
// ---------------------------------------------------------------------------

export const BridgeSchema = z.object({
  id: z.string(),
  from: KingdomIdSchema,
  to: KingdomIdSchema,
  strength: z.number().min(0).max(1),
});
export type Bridge = z.infer<typeof BridgeSchema>;

export const QuestSchema = z.object({
  id: z.string(),
  islandId: KingdomIdSchema,
  title: z.string(),
  narrative: z.string(),
  steps: z.array(z.object({ label: z.string(), done: z.boolean() })),
  reward: z.object({
    type: z.enum(["structure", "flora", "monument", "bridge", "creature", "relic"]),
    payload: z.string(),
  }),
  status: z.enum(["available", "active", "complete"]),
  xp: z.number().int().min(0).default(0),
});
export type Quest = z.infer<typeof QuestSchema>;

export const MemoryLandmarkSchema = z.object({
  id: z.string(),
  islandId: KingdomIdSchema,
  date: z.string(),
  kind: z.enum(["statue", "tree", "mural", "crystal", "fountain"]),
  title: z.string(),
  story: z.string(),
  photoIds: z.array(z.string()).default([]),
});
export type MemoryLandmark = z.infer<typeof MemoryLandmarkSchema>;

export const MonumentSchema = z.object({
  id: z.string(),
  islandId: KingdomIdSchema,
  kind: z.enum(["obelisk", "statue", "arch", "eternal_flame", "crystal_spire"]),
  title: z.string(),
  story: z.string(),
  date: z.string(),
});
export type Monument = z.infer<typeof MonumentSchema>;

export const CollectibleSchema = z.object({
  id: z.string(),
  kind: z.enum(["creature", "artifact", "relic", "hidden_isle"]),
  name: z.string(),
  islandId: KingdomIdSchema.optional(),
  found: z.boolean(),
  foundDate: z.string().optional(),
});
export type Collectible = z.infer<typeof CollectibleSchema>;

export const SeasonSchema = z.enum(["spring", "summer", "autumn", "winter"]);
export type Season = z.infer<typeof SeasonSchema>;

export const CompanionStateSchema = z.object({
  mood: z.enum(["celebrate", "encourage", "advise", "neutral"]),
  lastGreetingDate: z.string().optional(),
});
export type CompanionState = z.infer<typeof CompanionStateSchema>;

// ---------------------------------------------------------------------------
// WorldState — the contract
// ---------------------------------------------------------------------------

export const WORLD_SCHEMA_VERSION = "2.0.0";

export const WorldStateSchema = z.object({
  version: z.string(),
  timestamp: z.string(),
  worldSeed: z.number().int(),
  era: z.enum(["past", "present", "simulated"]),
  weather: z.object({
    kind: WeatherKindSchema,
    intensity: z.number().min(0).max(1),
  }),
  season: SeasonSchema,
  islands: z.array(IslandSchema),
  bridges: z.array(BridgeSchema),
  quests: z.array(QuestSchema),
  memories: z.array(MemoryLandmarkSchema),
  monuments: z.array(MonumentSchema),
  collectibles: z.array(CollectibleSchema),
  worldEvents: z.array(WorldEventSchema),
  companion: CompanionStateSchema,
});
export type WorldState = z.infer<typeof WorldStateSchema>;

// ---------------------------------------------------------------------------
// WorldDelta — typed change list (the only way the world ever mutates)
// ---------------------------------------------------------------------------

export const WorldDeltaSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("structure_added"),
    islandId: KingdomIdSchema,
    structure: StructureSchema,
  }),
  z.object({
    type: z.literal("structure_grown"),
    islandId: KingdomIdSchema,
    structureId: z.string(),
    growth: z.number().min(0).max(1),
    state: StructureStateSchema.optional(),
  }),
  z.object({
    type: z.literal("vitality_changed"),
    islandId: KingdomIdSchema,
    vitality: z.number().min(0).max(1),
  }),
  z.object({
    type: z.literal("level_changed"),
    islandId: KingdomIdSchema,
    level: z.number().int().min(1).max(10),
    evolutionStage: z.number().int().min(1).max(5).optional(),
  }),
  z.object({
    type: z.literal("bridge_strengthened"),
    from: KingdomIdSchema,
    to: KingdomIdSchema,
    strength: z.number().min(0).max(1),
  }),
  z.object({
    type: z.literal("monument_erected"),
    monument: MonumentSchema,
  }),
  z.object({
    type: z.literal("memory_added"),
    memory: MemoryLandmarkSchema,
  }),
  z.object({
    type: z.literal("creature_unlocked"),
    collectibleId: z.string(),
    foundDate: z.string(),
  }),
  z.object({
    type: z.literal("weather_changed"),
    islandId: KingdomIdSchema.optional(), // absent = global
    weather: WeatherKindSchema,
    intensity: z.number().min(0).max(1).optional(),
  }),
  z.object({
    type: z.literal("island_unlocked"),
    islandId: KingdomIdSchema,
  }),
  z.object({
    type: z.literal("season_changed"),
    season: SeasonSchema,
  }),
  z.object({
    type: z.literal("quest_added"),
    quest: QuestSchema,
  }),
  z.object({
    type: z.literal("quest_updated"),
    questId: z.string(),
    stepIndex: z.number().int().min(0).optional(),
    done: z.boolean().optional(),
    status: z.enum(["available", "active", "complete"]).optional(),
  }),
  z.object({
    type: z.literal("ecosystem_changed"),
    islandId: KingdomIdSchema,
    ecosystem: EcosystemSchema.partial(),
  }),
]);
export type WorldDelta = z.infer<typeof WorldDeltaSchema>;

/** Parse unknown JSON into WorldState (throws ZodError on bad shape). */
export function parseWorldState(raw: unknown): WorldState {
  return WorldStateSchema.parse(raw);
}

/** Safe variant for boot paths — returns null instead of throwing. */
export function tryParseWorldState(raw: unknown): WorldState | null {
  const result = WorldStateSchema.safeParse(raw);
  return result.success ? result.data : null;
}
