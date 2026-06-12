/**
 * Quest engine — fully local. Check-ins advance the active quest on that
 * kingdom one step; finishing the last step completes the quest, grants its
 * reward as WorldDeltas (monument, bridge, flora, structure growth), and
 * seeds the next quest from per-kingdom templates.
 */

import { clamp } from "@/lib/noise";
import type {
  CoreKingdomId,
  Monument,
  Quest,
  WorldDelta,
  WorldState,
} from "@/engine/schema/world";

interface QuestTemplate {
  title: string;
  narrative: string;
  steps: string[];
  reward: Quest["reward"];
  xp: number;
}

const TEMPLATES: Record<CoreKingdomId, QuestTemplate[]> = {
  career: [
    {
      title: "Ship It Week",
      narrative: "Three real deliveries. The tower remembers every one.",
      steps: ["Ship something", "Ship again", "Third time's momentum"],
      reward: { type: "monument", payload: "obelisk" },
      xp: 120,
    },
    {
      title: "The Craftsman's Path",
      narrative: "Practice the craft four times — mastery is a staircase.",
      steps: ["Practice", "Practice", "Practice", "Practice"],
      reward: { type: "flora", payload: "bloom" },
      xp: 100,
    },
  ],
  health: [
    {
      title: "The Week of Iron",
      narrative: "Move your body four times. The forest will answer.",
      steps: ["Workout one", "Workout two", "Workout three", "Workout four"],
      reward: { type: "monument", payload: "eternal_flame" },
      xp: 120,
    },
    {
      title: "Still Waters",
      narrative: "Three quiet sits. The lake clears when you do.",
      steps: ["Meditate", "Meditate", "Meditate"],
      reward: { type: "flora", payload: "bloom" },
      xp: 80,
    },
  ],
  learning: [
    {
      title: "The Reading Spire",
      narrative: "Five reading sessions — the library grows a wing.",
      steps: ["Read", "Read", "Read", "Read", "Read"],
      reward: { type: "monument", payload: "crystal_spire" },
      xp: 140,
    },
  ],
  finance: [
    {
      title: "The Vault Run",
      narrative: "Save three times. Walls rise on discipline.",
      steps: ["Save", "Save", "Save"],
      reward: { type: "monument", payload: "obelisk" },
      xp: 110,
    },
  ],
  relationships: [
    {
      title: "Keeper of Bonds",
      narrative: "Reach out three times. Bridges hold when tended.",
      steps: ["Reach out", "Reach out", "Reach out"],
      reward: { type: "bridge", payload: "relationships:career" },
      xp: 100,
    },
  ],
  creativity: [
    {
      title: "The Maker's Streak",
      narrative: "Make three things. Quantity births quality.",
      steps: ["Create", "Create", "Create"],
      reward: { type: "monument", payload: "statue" },
      xp: 120,
    },
  ],
  adventure: [
    {
      title: "Three Horizons",
      narrative: "Explore three times — anywhere new counts.",
      steps: ["Explore", "Explore", "Explore"],
      reward: { type: "monument", payload: "arch" },
      xp: 130,
    },
  ],
};

const MONUMENT_KINDS = new Set(["obelisk", "statue", "arch", "eternal_flame", "crystal_spire"]);

function rewardDeltas(quest: Quest, state: WorldState, now: string): WorldDelta[] {
  const deltas: WorldDelta[] = [];
  const island = state.islands.find((i) => i.id === quest.islandId);

  switch (quest.reward.type) {
    case "monument": {
      const kind = (
        MONUMENT_KINDS.has(quest.reward.payload) ? quest.reward.payload : "obelisk"
      ) as Monument["kind"];
      deltas.push({
        type: "monument_erected",
        monument: {
          id: `mon-${quest.id}`,
          islandId: quest.islandId,
          kind,
          title: quest.title,
          story: `Earned by completing "${quest.title}".`,
          date: now,
        },
      });
      break;
    }
    case "bridge": {
      const [from, to] = quest.reward.payload.split(":");
      if (from && to) {
        const existing = state.bridges.find(
          (b) => (b.from === from && b.to === to) || (b.from === to && b.to === from)
        );
        deltas.push({
          type: "bridge_strengthened",
          from: from as CoreKingdomId,
          to: to as CoreKingdomId,
          strength: clamp((existing?.strength ?? 0.25) + 0.18, 0, 1),
        });
      }
      break;
    }
    case "flora": {
      if (island) {
        deltas.push({
          type: "ecosystem_changed",
          islandId: quest.islandId,
          ecosystem: { flora: clamp(island.ecosystem.flora + 0.12, 0, 1) },
        });
      }
      break;
    }
    default: {
      // structure / creature / relic rewards arrive with later phases;
      // fall back to a vitality surge so completion is never silent
      if (island) {
        deltas.push({
          type: "vitality_changed",
          islandId: quest.islandId,
          vitality: clamp(island.vitality + 0.08, 0, 1),
        });
      }
    }
  }
  return deltas;
}

export interface QuestAdvance {
  deltas: WorldDelta[];
  completedQuest: Quest | null;
}

/**
 * A check-in landed on `islandId` — advance its first active quest one step.
 * Completing the last step grants the reward and seeds a follow-up quest.
 */
export function advanceQuests(state: WorldState, islandId: CoreKingdomId): QuestAdvance {
  const quest = state.quests.find((q) => q.islandId === islandId && q.status === "active");
  if (!quest) return { deltas: [], completedQuest: null };

  const stepIndex = quest.steps.findIndex((s) => !s.done);
  if (stepIndex < 0) return { deltas: [], completedQuest: null };

  const deltas: WorldDelta[] = [
    { type: "quest_updated", questId: quest.id, stepIndex, done: true },
  ];

  const isLast = stepIndex === quest.steps.length - 1;
  if (!isLast) return { deltas, completedQuest: null };

  const now = new Date().toISOString();
  deltas.push({ type: "quest_updated", questId: quest.id, status: "complete" });
  deltas.push(...rewardDeltas(quest, state, now));

  // seed the next template, cycling past ones already used
  const templates = TEMPLATES[islandId] ?? [];
  if (templates.length > 0) {
    const used = state.quests.filter((q) => q.islandId === islandId).length;
    const tpl = templates[used % templates.length];
    deltas.push({
      type: "quest_added",
      quest: {
        id: `q-${islandId}-${Date.now().toString(36)}`,
        islandId,
        title: tpl.title,
        narrative: tpl.narrative,
        steps: tpl.steps.map((label) => ({ label, done: false })),
        reward: tpl.reward,
        status: "active",
        xp: tpl.xp,
      },
    });
  }

  return { deltas, completedQuest: quest };
}
