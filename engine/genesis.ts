/**
 * World Genesis — deterministic mapper from the companion's questions to an
 * initial WorldState. Fully offline; AI may later enrich labels, never the
 * structure. Same answers + seed → same world, always.
 */

import { WORLD_SEED } from "@/lib/constants";
import { clamp } from "@/lib/noise";
import {
  WORLD_SCHEMA_VERSION,
  type Island,
  type Quest,
  type Structure,
  type StructureType,
  type WorldState,
} from "@/engine/schema/world";
import { buildFixture } from "@/engine/schema/fixture";

export interface GenesisAnswers {
  name: string;
  careerStage: "student" | "early" | "mid" | "senior" | "founder" | "break";
  careerJoy: 1 | 2 | 3 | 4 | 5;
  exercisePerWeek: 0 | 1 | 3 | 5;
  skills: string[]; // up to 3
  circle: "small" | "close" | "family" | "wide";
  finance: "tight" | "stable" | "growing" | "comfortable";
  creative: "none" | "dabble" | "regular" | "shipping";
  dream: string;
}

let idCounter = 0;
function st(
  type: StructureType,
  label: string,
  description: string,
  growth: number,
  slot: number,
  state: Structure["state"] = "complete"
): Structure {
  return {
    id: `g-${type}-${idCounter++}`,
    type,
    meaning: { label, description },
    growth: clamp(growth, 0.1, 1),
    state,
    slot,
  };
}

const CAREER_LEVEL: Record<GenesisAnswers["careerStage"], number> = {
  student: 2,
  early: 3,
  mid: 5,
  senior: 7,
  founder: 6,
  break: 2,
};

const FINANCE_LEVEL: Record<GenesisAnswers["finance"], number> = {
  tight: 2,
  stable: 4,
  growing: 5,
  comfortable: 7,
};

const CREATIVE_LEVEL: Record<GenesisAnswers["creative"], number> = {
  none: 1,
  dabble: 2,
  regular: 4,
  shipping: 6,
};

const CIRCLE_POP: Record<GenesisAnswers["circle"], number> = {
  small: 4,
  close: 8,
  family: 14,
  wide: 20,
};

export function buildGenesisWorld(answers: GenesisAnswers): WorldState {
  idCounter = 0;
  // start from the fixture skeleton (positions, locked ring, season…)
  // then overwrite every island with the user's life
  const base = buildFixture();
  const exercise01 = answers.exercisePerWeek / 5;
  const joy01 = (answers.careerJoy - 1) / 4;

  const islands = base.islands.map((island): Island => {
    switch (island.id) {
      case "career": {
        const level = CAREER_LEVEL[answers.careerStage];
        const structures = [
          st("career_tower", `${answers.name}'s Career`, "The path so far — and upward.", 0.3 + joy01 * 0.5, 0),
          st("opportunity_harbor", "Open Doors", "Where opportunities dock.", 0.45, 4),
          ...(answers.careerStage === "founder"
            ? [st("leadership_castle", "The Venture", "Built from scratch.", 0.5, 3)]
            : []),
          ...answers.skills
            .slice(0, 2)
            .map((s, i) => st("skill_academy", s, `Sharpening ${s}.`, 0.35, 1 + i, "rising")),
        ];
        return {
          ...island,
          level,
          vitality: 0.35 + joy01 * 0.5,
          evolutionStage: (Math.min(3, Math.ceil(level / 3)) || 1) as 1 | 2 | 3,
          structures,
          lightingIntensity: 0.4 + joy01 * 0.5,
          trafficFlow: 0.3 + joy01 * 0.4,
          population: 6 + level,
        };
      }
      case "health": {
        const structures = [
          st("fitness_forest", "Movement", "Every workout grows a tree.", 0.2 + exercise01 * 0.7, 0),
          st("habit_garden", "Daily Habits", "Small beds, watered daily.", 0.3 + exercise01 * 0.4, 1, exercise01 > 0.3 ? "complete" : "rising"),
          st("wellness_lake", "Rest", "Still water, clear mind.", 0.5, 2),
        ];
        return {
          ...island,
          level: 2 + Math.round(exercise01 * 4),
          vitality: 0.35 + exercise01 * 0.55,
          evolutionStage: (1 + Math.round(exercise01 * 2)) as 1 | 2 | 3,
          structures,
          ecosystem: { ...island.ecosystem, flora: 0.35 + exercise01 * 0.55 },
        };
      }
      case "learning": {
        const structures = [
          st("knowledge_library", "The Library", "Every book a brick.", 0.4, 0),
          ...answers.skills.map((s, i) =>
            st("skill_tower", s, `Mastery of ${s}, floor by floor.`, 0.3 + i * 0.05, 1 + i, "rising")
          ),
        ];
        return {
          ...island,
          level: 2 + Math.min(3, answers.skills.length),
          vitality: 0.5 + Math.min(0.3, answers.skills.length * 0.1),
          evolutionStage: 2,
          structures,
        };
      }
      case "finance": {
        const level = FINANCE_LEVEL[answers.finance];
        const f01 = (level - 2) / 5;
        return {
          ...island,
          level,
          vitality: 0.3 + f01 * 0.5,
          evolutionStage: (1 + Math.round(f01 * 2)) as 1 | 2 | 3,
          structures: [
            st("savings_fortress", "The Reserve", "Walls against rainy days.", 0.25 + f01 * 0.6, 0),
            st("merchant_harbor", "Income", "Boats on the golden river.", 0.4 + f01 * 0.3, 1),
          ],
          ecosystem: { ...island.ecosystem, waterFlow: 0.3 + f01 * 0.5 },
        };
      }
      case "relationships": {
        const pop = CIRCLE_POP[answers.circle];
        return {
          ...island,
          level: 3 + Math.round(pop / 7),
          vitality: 0.5 + pop / 60,
          evolutionStage: 2,
          population: pop,
          structures: [
            st("family_village", "The Hearth", "Where your people live.", 0.6, 0),
            st("friendship_district", "Close Ones", "Doors always open.", 0.5, 1),
            st("memory_garden", "Shared Days", "Memories take root here.", 0.4, 4),
          ],
        };
      }
      case "creativity": {
        const level = CREATIVE_LEVEL[answers.creative];
        const c01 = (level - 1) / 5;
        return {
          ...island,
          level,
          vitality: 0.3 + c01 * 0.5,
          evolutionStage: (1 + Math.round(c01 * 2)) as 1 | 2 | 3,
          structures:
            answers.creative === "none"
              ? [st("dream_workshop", "Someday Studio", "Waiting for its first spark.", 0.15, 0, "seed")]
              : [
                  st("art_studio", "The Studio", "Where the making happens.", 0.3 + c01 * 0.5, 0),
                  st("idea_factory", "Idea Factory", "More ideas than weekends.", 0.4, 1),
                ],
        };
      }
      case "adventure": {
        return {
          ...island,
          level: 3,
          vitality: 0.6,
          evolutionStage: 2,
          structures: [
            st("quest_port", "Expedition Port", "Journeys begin here.", 0.5, 8),
            st("dream_mountain", answers.dream || "The Great Dream", "The summit that matters.", 0.18, 0, "rising"),
            st("future_observatory", "The Long View", "Where futures are simulated.", 0.4, 4),
          ],
        };
      }
      default:
        return island; // locked ring unchanged
    }
  });

  const quests: Quest[] = [
    {
      id: "g-q-dream",
      islandId: "adventure",
      title: `Expedition: ${answers.dream || "The Great Dream"}`,
      narrative: "Every summit starts with a base camp. Plant the first flag.",
      steps: [
        { label: "Name the first step", done: false },
        { label: "Take it", done: false },
      ],
      reward: { type: "monument", payload: "arch" },
      status: "active",
      xp: 150,
    },
    ...(answers.skills[0]
      ? [
          {
            id: "g-q-skill",
            islandId: "learning" as const,
            title: `The Tower of ${answers.skills[0]}`,
            narrative: `Practice ${answers.skills[0]} three times this week — the tower grows a floor.`,
            steps: [
              { label: "Practice once", done: false },
              { label: "Practice twice", done: false },
              { label: "Practice thrice", done: false },
            ],
            reward: { type: "structure" as const, payload: "skill_tower" },
            status: "active" as const,
            xp: 90,
          },
        ]
      : []),
  ];

  return {
    ...base,
    version: WORLD_SCHEMA_VERSION,
    timestamp: new Date().toISOString(),
    worldSeed: WORLD_SEED,
    islands,
    quests,
    memories: [],
    monuments: [],
    worldEvents: [],
  };
}
