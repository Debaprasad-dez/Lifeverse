/**
 * Rich mock WorldState — what a few months of a real life might look like.
 * Boots the world when IndexedDB has no snapshot yet. Deliberately varied
 * (levels, stages, growth states) so every resolver path renders on day one.
 */

import { WORLD_SEED } from "@/lib/constants";
import {
  WORLD_SCHEMA_VERSION,
  type Structure,
  type StructureState,
  type StructureType,
  type WorldState,
} from "./world";

let slotCursor = 0;
function s(
  type: StructureType,
  label: string,
  description: string,
  growth: number,
  state: StructureState = "complete"
): Structure {
  return {
    id: `${type}-${slotCursor}`,
    type,
    meaning: { label, description },
    growth,
    state,
    slot: slotCursor++,
  };
}

function resetSlots(): void {
  slotCursor = 0;
}

export function buildFixture(now = new Date()): WorldState {
  const iso = now.toISOString();

  resetSlots();
  const career = [
    s("career_tower", "Frontend Career", "Five years building for the web.", 0.85),
    s("promotion_hall", "Senior Promotion", "Promoted to senior engineer.", 1, "glowing"),
    s("skill_academy", "TypeScript Mastery", "Deep in the type system.", 0.7),
    s("project_museum", "Shipped Projects", "Every launch remembered.", 0.6),
    s("opportunity_harbor", "Open Doors", "Offers and side quests arrive here.", 0.5),
    s("mentor_observatory", "Mentorship", "Guiding two juniors.", 0.35, "rising"),
  ];

  resetSlots();
  const health = [
    s("fitness_forest", "Morning Runs", "Three runs a week keep the forest tall.", 0.75),
    s("habit_garden", "Daily Habits", "Water, sleep, stretching — one bed each.", 0.65),
    s("wellness_lake", "Rest & Recovery", "Still water, clear mind.", 0.8),
    s("meditation_sanctuary", "Ten Quiet Minutes", "A small practice, growing.", 0.3, "rising"),
    s("nutrition_village", "Home Cooking", "More greens than takeout, most weeks.", 0.55),
  ];

  resetSlots();
  const learning = [
    s("knowledge_library", "Reading List", "Twenty-three books and counting.", 0.7),
    s("skill_tower", "Three.js", "Shaders no longer scary.", 0.6),
    s("research_observatory", "Paper Club", "One whitepaper a month.", 0.4, "rising"),
    s("wisdom_temple", "Notes Garden", "Where ideas connect.", 0.5),
  ];

  resetSlots();
  const finance = [
    s("savings_fortress", "Emergency Fund", "Six months of walls.", 0.8),
    s("investment_tower", "Index Funds", "Slow and steady compounding.", 0.45, "rising"),
    s("merchant_harbor", "Salary + Side Work", "Two boats on the golden river.", 0.6),
  ];

  resetSlots();
  const relationships = [
    s("family_village", "Family", "Sunday calls keep the hearths warm.", 0.85),
    s("friendship_district", "Close Friends", "The group chat that never sleeps.", 0.7),
    s("community_square", "Climbing Crew", "New faces every Thursday.", 0.4, "rising"),
    s("memory_garden", "Shared Memories", "Picnics, trips, inside jokes.", 0.65),
    s("celebration_plaza", "Celebrations", "Birthdays never forgotten.", 0.5),
  ];

  resetSlots();
  const creativity = [
    s("art_studio", "Sketchbook", "Sunday morning drawings.", 0.35, "rising"),
    s("idea_factory", "Project Ideas", "More ideas than weekends.", 0.5),
    s("dream_workshop", "The Game Project", "One day. Soon.", 0.15, "seed"),
  ];

  resetSlots();
  const adventure = [
    s("quest_port", "Active Expeditions", "Where journeys begin.", 0.7),
    s("dream_mountain", "See Japan", "The biggest peak on the horizon.", 0.25, "rising"),
    s("expedition_camp", "Weekend Hikes", "Boots always by the door.", 0.6),
    s("future_observatory", "The Long View", "Where futures are simulated.", 0.4),
  ];

  return {
    version: WORLD_SCHEMA_VERSION,
    timestamp: iso,
    worldSeed: WORLD_SEED,
    era: "present",
    weather: { kind: "clear", intensity: 0.2 },
    season: "summer",
    islands: [
      {
        id: "career",
        locked: false,
        position: [-34, -2, 14],
        level: 6,
        vitality: 0.78,
        evolutionStage: 3,
        structures: career,
        ecosystem: { flora: 0.45, fauna: 0.3, waterFlow: 0.2, fogDensity: 0.05, weather: "clear" },
        population: 14,
        trafficFlow: 0.7,
        lightingIntensity: 0.85,
        localEvents: [],
      },
      {
        id: "health",
        locked: false,
        position: [0, 4, 0],
        level: 5,
        vitality: 0.85,
        evolutionStage: 3,
        structures: health,
        ecosystem: { flora: 0.9, fauna: 0.6, waterFlow: 0.8, fogDensity: 0, weather: "clear" },
        population: 6,
        trafficFlow: 0.4,
        lightingIntensity: 0.5,
        localEvents: [],
      },
      {
        id: "learning",
        locked: false,
        position: [33, 0, 18],
        level: 4,
        vitality: 0.7,
        evolutionStage: 2,
        structures: learning,
        ecosystem: { flora: 0.5, fauna: 0.35, waterFlow: 0.3, fogDensity: 0.05, weather: "clear" },
        population: 8,
        trafficFlow: 0.5,
        lightingIntensity: 0.75,
        localEvents: [],
      },
      {
        id: "finance",
        locked: false,
        position: [25, 6, -26],
        level: 3,
        vitality: 0.6,
        evolutionStage: 2,
        structures: finance,
        ecosystem: { flora: 0.3, fauna: 0.2, waterFlow: 0.6, fogDensity: 0.1, weather: "clear" },
        population: 7,
        trafficFlow: 0.55,
        lightingIntensity: 0.7,
        localEvents: [],
      },
      {
        id: "relationships",
        locked: false,
        position: [-21, 8, -27],
        level: 5,
        vitality: 0.8,
        evolutionStage: 3,
        structures: relationships,
        ecosystem: { flora: 0.7, fauna: 0.55, waterFlow: 0.35, fogDensity: 0, weather: "clear" },
        population: 18,
        trafficFlow: 0.6,
        lightingIntensity: 0.8,
        localEvents: [],
      },
      {
        id: "creativity",
        locked: false,
        position: [-40, 13, -6],
        level: 2,
        vitality: 0.45,
        evolutionStage: 1,
        structures: creativity,
        ecosystem: { flora: 0.4, fauna: 0.25, waterFlow: 0.45, fogDensity: 0.25, weather: "mist" },
        population: 3,
        trafficFlow: 0.2,
        lightingIntensity: 0.45,
        localEvents: [],
      },
      {
        id: "adventure",
        locked: false,
        position: [9, 15, -42],
        level: 4,
        vitality: 0.72,
        evolutionStage: 2,
        structures: adventure,
        ecosystem: { flora: 0.55, fauna: 0.45, waterFlow: 0.4, fogDensity: 0.1, weather: "clear" },
        population: 5,
        trafficFlow: 0.45,
        lightingIntensity: 0.55,
        localEvents: [],
      },
      // ---- locked kingdoms: distant fog-shrouded silhouettes ----
      ...(
        [
          ["business", [72, -7, 42]],
          ["family", [-78, -3, 38]],
          ["mindfulness", [-64, 9, -62]],
          ["community", [84, 3, -48]],
          ["travel", [4, -11, 92]],
          ["legacy", [-12, 17, -88]],
        ] as const
      ).map(([id, position]) => ({
        id,
        locked: true,
        position: [...position] as [number, number, number],
        level: 1,
        vitality: 0.2,
        evolutionStage: 1,
        structures: [],
        ecosystem: {
          flora: 0.1,
          fauna: 0,
          waterFlow: 0,
          fogDensity: 0.9,
          weather: "mist" as const,
        },
        population: 0,
        trafficFlow: 0,
        lightingIntensity: 0.1,
        localEvents: [],
      })),
    ],
    bridges: [
      { id: "b-career-learning", from: "career", to: "learning", strength: 0.8 },
      { id: "b-health-relationships", from: "health", to: "relationships", strength: 0.6 },
      { id: "b-career-finance", from: "career", to: "finance", strength: 0.5 },
      { id: "b-creativity-career", from: "creativity", to: "career", strength: 0.3 },
    ],
    quests: [
      {
        id: "q-react-mastery",
        islandId: "learning",
        title: "The Tower of Components",
        narrative: "Raise your React skill tower three more floors by shipping the portfolio rebuild.",
        steps: [
          { label: "Finish the design draft", done: true },
          { label: "Build the world canvas", done: false },
          { label: "Deploy and share", done: false },
        ],
        reward: { type: "structure", payload: "skill_tower" },
        status: "active",
        xp: 120,
      },
      {
        id: "q-japan-fund",
        islandId: "adventure",
        title: "Expedition: Land of the Rising Sun",
        narrative: "Save the travel fund and plant a flag on Dream Mountain.",
        steps: [
          { label: "Save the first half", done: true },
          { label: "Save the second half", done: false },
          { label: "Book the flights", done: false },
        ],
        reward: { type: "monument", payload: "arch" },
        status: "active",
        xp: 200,
      },
      {
        id: "q-morning-routine",
        islandId: "health",
        title: "The Dawn Garden",
        narrative: "Tend the habit garden every morning for two weeks straight.",
        steps: [
          { label: "Week one complete", done: true },
          { label: "Week two complete", done: false },
        ],
        reward: { type: "flora", payload: "golden_leaves" },
        status: "active",
        xp: 80,
      },
    ],
    memories: [
      {
        id: "m-graduation",
        islandId: "learning",
        date: "2023-06-15T00:00:00.000Z",
        kind: "statue",
        title: "Graduation Day",
        story: "Four years, one scroll of parchment, endless instant noodles.",
        photoIds: [],
      },
      {
        id: "m-first-summit",
        islandId: "adventure",
        date: "2025-10-02T00:00:00.000Z",
        kind: "crystal",
        title: "First 3000m Summit",
        story: "Legs gone, grin permanent.",
        photoIds: [],
      },
    ],
    monuments: [
      {
        id: "mon-promotion",
        islandId: "career",
        kind: "obelisk",
        title: "Senior Engineer",
        story: "Earned, not given.",
        date: "2026-01-20T00:00:00.000Z",
      },
    ],
    collectibles: [
      { id: "c-glow-fox", kind: "creature", name: "Glow Fox", islandId: "health", found: false },
      { id: "c-book-owl", kind: "creature", name: "Book Owl", islandId: "learning", found: false },
      { id: "c-cloud-whale", kind: "creature", name: "Cloud Whale", found: false },
    ],
    worldEvents: [],
    companion: { mood: "neutral" },
  };
}
