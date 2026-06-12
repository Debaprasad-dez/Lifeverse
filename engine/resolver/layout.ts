/**
 * Kingdom visual identity — geometry parameters, label, palette accent.
 * Positions live in WorldState (schema drives the world); this is the
 * art direction the resolver applies on top.
 */

import type { CoreKingdomId, Island } from "@/engine/schema/world";
import type { KingdomPalette } from "@/engine/generation/structures/kit";

export interface KingdomLayout {
  label: string;
  /** Base cap radius (final = base × level scale). */
  radius: number;
  capHeight: number;
  depth: number;
  /** Label plate face / extrusion colors (reference: screen.png plates). */
  accent: string;
  accentDark: string;
  hasWaterfall: boolean;
  /** Waterfall ribbon character (finance = golden river, creativity = paint). */
  waterfallStyle?: "water" | "gold" | "paint";
  /** Multiplies ecosystem.flora when scattering trees. */
  treeFactor: number;
  /** Structure material palette. */
  palette: KingdomPalette;
}

export const KINGDOM_LAYOUTS: Record<CoreKingdomId, KingdomLayout> = {
  career: {
    label: "CAREER",
    radius: 10,
    capHeight: 1.6,
    depth: 13,
    accent: "#2f9fd8",
    accentDark: "#0c5a7a",
    hasWaterfall: false,
    treeFactor: 0.5,
    palette: {
      bodyA: "#5e7082",
      bodyB: "#465563",
      roof: "#2f9fd8",
      trim: "#222f3a",
      glow: "#6fd8ff",
    },
  },
  health: {
    label: "HEALTH",
    radius: 11,
    capHeight: 2.3,
    depth: 14.5,
    accent: "#3faf6e",
    accentDark: "#1d6b40",
    hasWaterfall: true,
    waterfallStyle: "water",
    treeFactor: 1.1,
    palette: {
      bodyA: "#ece4d2",
      bodyB: "#d2c4a6",
      roof: "#6fb45f",
      trim: "#8a6f4d",
      glow: "#ffe9a8",
    },
  },
  learning: {
    label: "LEARNING",
    radius: 9.5,
    capHeight: 1.9,
    depth: 13,
    accent: "#d9a13c",
    accentDark: "#8a6420",
    hasWaterfall: false,
    treeFactor: 0.7,
    palette: {
      bodyA: "#dccaa8",
      bodyB: "#c2aa80",
      roof: "#c9962f",
      trim: "#6f5840",
      glow: "#ffd98c",
    },
  },
  finance: {
    label: "FINANCE",
    radius: 8.5,
    capHeight: 1.7,
    depth: 12,
    accent: "#e3b54a",
    accentDark: "#9c7c1e",
    hasWaterfall: true,
    waterfallStyle: "gold",
    treeFactor: 0.45,
    palette: {
      bodyA: "#f0e4c2",
      bodyB: "#d6c290",
      roof: "#2e8c7e",
      trim: "#8c6f3f",
      glow: "#ffd166",
    },
  },
  relationships: {
    label: "RELATIONSHIPS",
    radius: 9,
    capHeight: 1.8,
    depth: 12.5,
    accent: "#e87f9b",
    accentDark: "#9c3550",
    hasWaterfall: false,
    treeFactor: 0.85,
    palette: {
      bodyA: "#f2e4d2",
      bodyB: "#dcbcaa",
      roof: "#cc6e82",
      trim: "#8a5a48",
      glow: "#ffc2d0",
    },
  },
  creativity: {
    label: "CREATIVITY",
    radius: 8,
    capHeight: 2.0,
    depth: 11.5,
    accent: "#a98fe3",
    accentDark: "#6f4fa8",
    hasWaterfall: true,
    waterfallStyle: "paint",
    treeFactor: 0.6,
    palette: {
      bodyA: "#dcd2ec",
      bodyB: "#bcaadc",
      roof: "#8a6fc8",
      trim: "#54467c",
      glow: "#d8b8ff",
    },
  },
  adventure: {
    label: "ADVENTURE",
    radius: 9,
    capHeight: 4.2,
    depth: 13.5,
    accent: "#e8854e",
    accentDark: "#a85a22",
    hasWaterfall: false,
    treeFactor: 0.65,
    palette: {
      bodyA: "#cdbc9e",
      bodyB: "#ac9270",
      roof: "#d87f4a",
      trim: "#6f5436",
      glow: "#ffc89a",
    },
  },
};

/** Keyboard 1–7 flight order. */
export const KINGDOM_ORDER: CoreKingdomId[] = [
  "career",
  "health",
  "learning",
  "finance",
  "relationships",
  "creativity",
  "adventure",
];

/** Island radius grows with level — size IS the analytics (diegetic). */
export function islandRadius(island: Island): number {
  const base = KINGDOM_LAYOUTS[island.id as CoreKingdomId]?.radius ?? 8;
  return base * (0.78 + island.level * 0.045);
}

/** Camera focus point for an island. */
export function islandCenter(island: Island): [number, number, number] {
  return [island.position[0], island.position[1] + 1.5, island.position[2]];
}
