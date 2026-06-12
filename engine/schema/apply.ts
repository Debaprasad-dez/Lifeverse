/**
 * Pure WorldDelta reducer. Every world mutation flows through here —
 * AI output, check-ins, quests — so behavior is identical from any source.
 * Returns a new WorldState (never mutates); timestamp bumps on change.
 */

import { clamp } from "@/lib/noise";
import type { Island, WorldDelta, WorldState } from "./world";

function mapIsland(
  state: WorldState,
  islandId: string,
  fn: (island: Island) => Island
): WorldState {
  return {
    ...state,
    islands: state.islands.map((i) => (i.id === islandId ? fn(i) : i)),
  };
}

export function applyWorldDelta(state: WorldState, delta: WorldDelta): WorldState {
  let next: WorldState;

  switch (delta.type) {
    case "structure_added":
      next = mapIsland(state, delta.islandId, (i) => ({
        ...i,
        structures: [...i.structures, delta.structure],
      }));
      break;

    case "structure_grown":
      next = mapIsland(state, delta.islandId, (i) => ({
        ...i,
        structures: i.structures.map((st) =>
          st.id === delta.structureId
            ? { ...st, growth: clamp(delta.growth, 0, 1), state: delta.state ?? st.state }
            : st
        ),
      }));
      break;

    case "vitality_changed":
      next = mapIsland(state, delta.islandId, (i) => ({
        ...i,
        vitality: clamp(delta.vitality, 0, 1),
      }));
      break;

    case "level_changed":
      next = mapIsland(state, delta.islandId, (i) => ({
        ...i,
        level: delta.level,
        evolutionStage: delta.evolutionStage ?? i.evolutionStage,
      }));
      break;

    case "bridge_strengthened": {
      const existing = state.bridges.find(
        (b) =>
          (b.from === delta.from && b.to === delta.to) ||
          (b.from === delta.to && b.to === delta.from)
      );
      next = existing
        ? {
            ...state,
            bridges: state.bridges.map((b) =>
              b.id === existing.id ? { ...b, strength: clamp(delta.strength, 0, 1) } : b
            ),
          }
        : {
            ...state,
            bridges: [
              ...state.bridges,
              {
                id: `b-${delta.from}-${delta.to}`,
                from: delta.from,
                to: delta.to,
                strength: clamp(delta.strength, 0, 1),
              },
            ],
          };
      break;
    }

    case "monument_erected":
      next = { ...state, monuments: [...state.monuments, delta.monument] };
      break;

    case "memory_added":
      next = { ...state, memories: [...state.memories, delta.memory] };
      break;

    case "creature_unlocked":
      next = {
        ...state,
        collectibles: state.collectibles.map((c) =>
          c.id === delta.collectibleId
            ? { ...c, found: true, foundDate: delta.foundDate }
            : c
        ),
      };
      break;

    case "weather_changed":
      next = delta.islandId
        ? mapIsland(state, delta.islandId, (i) => ({
            ...i,
            ecosystem: { ...i.ecosystem, weather: delta.weather },
          }))
        : {
            ...state,
            weather: {
              kind: delta.weather,
              intensity: delta.intensity ?? state.weather.intensity,
            },
          };
      break;

    case "island_unlocked":
      next = mapIsland(state, delta.islandId, (i) => ({ ...i, locked: false }));
      break;

    case "season_changed":
      next = { ...state, season: delta.season };
      break;

    case "quest_added":
      next = { ...state, quests: [...state.quests, delta.quest] };
      break;

    case "quest_updated":
      next = {
        ...state,
        quests: state.quests.map((q) => {
          if (q.id !== delta.questId) return q;
          const steps =
            delta.stepIndex !== undefined && delta.done !== undefined
              ? q.steps.map((step, idx) =>
                  idx === delta.stepIndex ? { ...step, done: delta.done! } : step
                )
              : q.steps;
          return { ...q, steps, status: delta.status ?? q.status };
        }),
      };
      break;

    case "ecosystem_changed":
      next = mapIsland(state, delta.islandId, (i) => ({
        ...i,
        ecosystem: { ...i.ecosystem, ...delta.ecosystem },
      }));
      break;
  }

  return { ...next, timestamp: new Date().toISOString() };
}
