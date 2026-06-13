/**
 * Future projection — "glimpse the future". Extrapolates the world forward
 * by `months`, driven by recent check-in cadence: active kingdoms keep
 * climbing (vitality, flora, level, stage), neglected ones gently fade.
 * Deterministic, offline, read-only. Renders in the "simulated" era.
 */

import { clamp } from "@/lib/noise";
import type { LifeEvent } from "@/engine/evolution/rules";
import { LIFE_EVENTS, type LifeEventKind } from "@/engine/evolution/rules";
import {
  CORE_KINGDOM_IDS,
  WORLD_SCHEMA_VERSION,
  type CoreKingdomId,
  type Island,
  type Monument,
  type WorldState,
} from "@/engine/schema/world";

/** Check-ins per week per kingdom over the recent window. */
function weeklyCadence(events: LifeEvent[]): Record<CoreKingdomId, number> {
  const out = {} as Record<CoreKingdomId, number>;
  for (const id of CORE_KINGDOM_IDS) out[id] = 0;

  const now = Date.now();
  const windowMs = 28 * 24 * 3600 * 1000; // last 4 weeks
  let counted = 0;
  for (const e of events) {
    if (now - Date.parse(e.at) > windowMs) continue;
    const island = LIFE_EVENTS[e.kind as LifeEventKind]?.islandId;
    if (island) {
      out[island] += 1;
      counted++;
    }
  }
  // if there's no history at all, assume a mild steady habit everywhere
  if (counted === 0) for (const id of CORE_KINGDOM_IDS) out[id] = 1.5;
  else for (const id of CORE_KINGDOM_IDS) out[id] = out[id] / 4; // per week
  return out;
}

export function projectFuture(
  state: WorldState,
  events: LifeEvent[],
  months = 6
): WorldState {
  const cadence = weeklyCadence(events);

  const islands = state.islands.map((island): Island => {
    if (island.locked || !CORE_KINGDOM_IDS.includes(island.id as CoreKingdomId)) {
      return island;
    }
    const perWeek = cadence[island.id as CoreKingdomId] ?? 0;
    // net momentum: ≥3/wk strong growth, ~1/wk steady, 0 slow fade
    const momentum = (perWeek - 1.2) * 0.08 * months;

    const vitality = clamp(island.vitality + momentum, 0.08, 1);
    const flora = clamp(island.ecosystem.flora + momentum * 0.9, 0.05, 1);
    const levelGain = Math.round(clamp(momentum, -1, 1) * months * 0.5);
    const level = clamp(island.level + levelGain, 1, 10) as Island["level"];
    const evolutionStage = clamp(
      Math.max(island.evolutionStage, Math.ceil(level / 2)),
      1,
      5
    ) as Island["evolutionStage"];

    return {
      ...island,
      vitality,
      level,
      evolutionStage,
      lightingIntensity: clamp(island.lightingIntensity + momentum, 0.1, 1),
      population: Math.max(1, Math.round(island.population * (1 + momentum * 0.4))),
      ecosystem: { ...island.ecosystem, flora },
      structures: island.structures.map((s) => ({
        ...s,
        growth: clamp(s.growth + momentum * 0.8, 0.1, 1),
        state: s.growth + momentum * 0.8 >= 1 ? "glowing" : s.state,
      })),
    };
  });

  // a monument to the future self on the strongest kingdom
  const best = [...islands]
    .filter((i) => !i.locked && CORE_KINGDOM_IDS.includes(i.id as CoreKingdomId))
    .sort((a, b) => b.vitality - a.vitality)[0];
  const futureDate = new Date(Date.now() + months * 30 * 24 * 3600 * 1000).toISOString();
  const monuments: Monument[] = best
    ? [
        ...state.monuments,
        {
          id: "future-self",
          islandId: best.id,
          kind: "crystal_spire",
          title: `${months} Months Ahead`,
          story: "What this world could become if you keep tending it.",
          date: futureDate,
        },
      ]
    : state.monuments;

  return {
    ...state,
    version: WORLD_SCHEMA_VERSION,
    timestamp: futureDate,
    era: "simulated",
    islands,
    monuments,
  };
}
