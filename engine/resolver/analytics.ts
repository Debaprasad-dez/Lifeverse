/**
 * Diegetic analytics — the ONLY place numbers become world. Never charts:
 * level → island size, vitality → saturation & flora, population →
 * villagers, trafficFlow → airships/boats, lightingIntensity → window glow,
 * ecosystem → local weather. Pure functions of WorldState.
 */

import { clamp, lerp } from "@/lib/noise";
import type { Island, WorldState } from "@/engine/schema/world";

export interface IslandAnalytics {
  /** Flora multipliers (counts already scale with ecosystem.flora). */
  treeCountMul: number;
  /** 0–1 saturation factor — low vitality drains color toward hay. */
  floraSaturation: number;
  /** Multiplies glow-part brightness (window emissives at golden hour). */
  glowMul: number;
  /** Villagers walking the cap. */
  villagerCount: number;
  /** Fireflies at dusk for lively islands. */
  fireflyCount: number;
  /** Local weather sprite block. */
  weather: {
    kind: Island["ecosystem"]["weather"];
    /** 0 = none; drives sprite count + opacity. */
    amount: number;
    /** Storm clouds darken. */
    darkness: number;
  };
}

export function islandAnalytics(island: Island): IslandAnalytics {
  const { vitality, ecosystem, population, lightingIntensity } = island;

  const stormy = ecosystem.weather === "storm" || ecosystem.weather === "rain";
  const weatherAmount = island.locked
    ? 0.85
    : Math.max(ecosystem.fogDensity, stormy ? 0.55 + 0.35 * (1 - vitality) : 0);

  return {
    treeCountMul: lerp(0.55, 1.15, vitality),
    floraSaturation: clamp(0.35 + vitality * 0.65, 0, 1),
    glowMul: 0.35 + lightingIntensity * 0.85,
    villagerCount: island.locked ? 0 : Math.min(10, Math.round(population * 0.45)),
    fireflyCount: island.locked || vitality < 0.55 ? 0 : Math.round(4 + vitality * 8),
    weather: {
      kind: ecosystem.weather,
      amount: clamp(weatherAmount, 0, 1),
      darkness: stormy ? 0.55 : 0.18,
    },
  };
}

export interface TrafficRoute {
  fromIslandId: string;
  toIslandId: string;
  /** Ships per route (0–2). */
  ships: number;
  speed: number;
}

/** Airship routes — frequency IS the traffic analytics. */
export function trafficRoutes(state: WorldState): TrafficRoute[] {
  const routes: TrafficRoute[] = [];
  const unlocked = state.islands.filter((i) => !i.locked);
  for (const island of unlocked) {
    if (island.trafficFlow < 0.25) continue;
    // each busy kingdom runs ships to its strongest bridge partner, else hub
    const partner =
      state.bridges
        .filter((b) => (b.from === island.id || b.to === island.id) && b.strength > 0.3)
        .sort((a, b) => b.strength - a.strength)
        .map((b) => (b.from === island.id ? b.to : b.from))[0] ?? "health";
    if (partner === island.id) continue;
    routes.push({
      fromIslandId: island.id,
      toIslandId: partner,
      ships: island.trafficFlow > 0.6 ? 2 : 1,
      speed: 0.5 + island.trafficFlow * 0.8,
    });
  }
  return routes.slice(0, 5);
}
