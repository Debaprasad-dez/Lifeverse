/**
 * Per-kingdom ecosystem themes (Phase 11 environment pass). Each core island
 * gets its own biome identity — ground tint, foliage palette, flowers,
 * boulders, density, and ambient motes — mapped from redesign.md and the
 * reference world overview (volcano-orange, forest-green, crystal-cyan,
 * metropolis-slate, sakura-pink, autumn, dreamscape).
 *
 * This stays inside the locked art direction: ONE golden-hour sky + the toon /
 * instanced two-pool renderer. We retint and re-vegetate per island; we do NOT
 * give each island its own sky / PBR / post-FX stack (that conflicts with the
 * "engine owns all aesthetics" + ~10-draw-call rules — see redesign.md §2-8
 * "Ultra-Realistic" layers, deferred).
 */

import type { CoreKingdomId } from "@/engine/schema/world";

export interface MoteTheme {
  colors: string[];
  /** Per-island base count (scaled by quality tier at render). */
  count: number;
  /** rise = embers/spores, fall = leaves/petals/snow, drift = mist/dust. */
  behavior: "rise" | "fall" | "drift";
  size: number;
  /** Additive HDR (spores, sparkle, embers) vs soft normal-blend (mist, snow). */
  glow: boolean;
}

export interface EcosystemTheme {
  /** Cap grass colors baked into island geometry (vertex colors). */
  grassLight: string;
  grassDeep: string;
  /** Optional cliff-ring tint overrides. */
  cliffWarm?: string;
  cliffDeep?: string;
  /** Scattered foliage [light, deep]. */
  canopy: [string, string];
  /** Tree silhouette hint (color is the dominant identity; shape is secondary). */
  foliage: "topiary" | "broadleaf" | "redwood" | "autumn" | "sakura" | "spiral" | "crystal" | "pine";
  /** Meadow flower colors ([] = none, e.g. glacier). */
  flowers: string[];
  /** Boulder color range [a, b]. */
  boulder: [string, string];
  /** Density multipliers — keep focus balanced per biome. */
  treeMul: number;
  grassMul: number;
  /** Ambient drifting motes above the cap. */
  motes: MoteTheme;
  /**
   * Optional second biome occupying the island-local +X half (blended across a
   * seam). Adventure uses it for the volcanic range opposite the glacier.
   */
  split?: SplitBiome;
  /** Concentric stepped terraces (Career metropolis plateaus). */
  tiers?: number;
}

export interface SplitBiome {
  grassLight: string;
  grassDeep: string;
  cliffWarm: string;
  cliffDeep: string;
  /** Charred / dead foliage tint. */
  canopy: [string, string];
  /** Obsidian / basalt rock range. */
  boulder: [string, string];
  /** Lava-fissure glow colors (HDR → Bloom). */
  lava: string[];
  /** Ember motes rising off the fissures. */
  motes: MoteTheme;
}

export const ECOSYSTEMS: Record<CoreKingdomId, EcosystemTheme> = {
  // CAREER — Metropolis Oasis: emerald courtyards, slate pavers, valley mist
  career: {
    grassLight: "#bcc4ca", // pale quartz paving (metropolis, ~80% less lawn)
    grassDeep: "#8b959c", // slate concrete
    cliffWarm: "#cfd6dd", // brushed titanium tier rims
    cliffDeep: "#6b7682",
    canopy: ["#2ECC71", "#1F7A4C"], // the few remaining topiary stay vivid
    foliage: "topiary",
    flowers: ["#EAF7EE", "#FFD9A0"],
    boulder: ["#3F4E5E", "#7c8794"],
    treeMul: 0.2, // sparse manicured greenery only
    grassMul: 0.18,
    motes: { colors: ["#FFFFFF", "#EAF2F8"], count: 40, behavior: "drift", size: 0.85, glow: false },
    tiers: 3, // Lower Harbor → Mid Plaza → High Citadel
  },

  // FINANCE — Crystal Oasis: gold/silver dust, gem foliage, sparkle
  finance: {
    grassLight: "#f0d76a", // gold dust
    grassDeep: "#cfd2d8", // silver dust
    cliffWarm: "#b8902e", // gold-veined
    cliffDeep: "#2a2620", // polished obsidian
    canopy: ["#B9F2FF", "#50C878"],
    foliage: "crystal",
    flowers: ["#FFD700", "#B9F2FF", "#50C878"],
    boulder: ["#9c7c1e", "#C0C0C8"],
    treeMul: 0.45, // scattered money-trees; hero gem clusters come from FinanceLayer
    grassMul: 0.4,
    motes: { colors: ["#FFE9A0", "#FFFFFF", "#FFF6C0"], count: 28, behavior: "drift", size: 0.4, glow: true },
    tiers: 3, // structured geometric plateaus
  },

  // HEALTH — Bioluminescent Forest: deep jade moss, redwoods, glowing spores
  health: {
    grassLight: "#4E8C4A",
    grassDeep: "#2F5233",
    cliffWarm: "#6b7a5e",
    cliffDeep: "#3A5F3A",
    canopy: ["#3A6E3E", "#2F5233"],
    foliage: "redwood",
    flowers: ["#FFB7C5", "#FFFFFF", "#9B7EDE", "#2EC4B6"],
    boulder: ["#6B7A5E", "#3A5F3A"],
    treeMul: 1.3,
    grassMul: 1.25,
    motes: { colors: ["#B8FFE0", "#9B7EDE", "#2EC4B6"], count: 70, behavior: "drift", size: 0.4, glow: true },
  },

  // LEARNING — Steampunk Autumn Highlands: flagstone, amber canopy, falling leaves
  learning: {
    grassLight: "#C49A5E",
    grassDeep: "#9A7B4E",
    cliffWarm: "#8B7355",
    cliffDeep: "#6f5840",
    canopy: ["#D2691E", "#B22222"],
    foliage: "autumn",
    flowers: ["#FFD700", "#E8B84B", "#D35400"],
    boulder: ["#8B7355", "#B8956A"],
    treeMul: 0.85,
    grassMul: 0.5,
    motes: { colors: ["#D2691E", "#FFD700", "#CD853F"], count: 54, behavior: "fall", size: 0.7, glow: false },
  },

  // RELATIONSHIP — Blossom Valley: warm meadow, sakura, falling petals
  relationships: {
    grassLight: "#86a85f", // soft sage → golden-green meadow
    grassDeep: "#5b7a4a",
    cliffWarm: "#b08a6a",
    cliffDeep: "#8a6a4a",
    canopy: ["#FFC9DE", "#FFB7C5"],
    foliage: "sakura",
    flowers: ["#ffb347", "#e2552b", "#ffd95a", "#fff0c4"], // marigold / poppy / primrose
    boulder: ["#a98f6f", "#cdb99c"],
    treeMul: 0.2, // ~80% fewer scattered pink trees — clusters come from RelationshipLayer
    grassMul: 0.95,
    motes: { colors: ["#FFB7C5", "#FFC9DE", "#FFE0EC"], count: 80, behavior: "fall", size: 0.42, glow: false },
  },

  // CREATIVITY — Surreal Dreamscape: watercolor ground, pastel spirals, paint motes
  creativity: {
    grassLight: "#C77BD8",
    grassDeep: "#7B2FF7",
    cliffWarm: "#8a5fb0",
    cliffDeep: "#54467c",
    canopy: ["#FFB3DE", "#B3E5FC"],
    foliage: "spiral",
    flowers: ["#FF6EC7", "#00FFFF", "#FFE5A8", "#B388EB"],
    boulder: ["#9a7fc0", "#d4b3ff"],
    treeMul: 0.8,
    grassMul: 0.85,
    motes: { colors: ["#FF6EC7", "#00FFFF", "#B388EB", "#FFE5A8"], count: 60, behavior: "drift", size: 0.7, glow: true },
  },

  // ADVENTURE — Craggy Frontier: snow/glacier cap, frost pines, snowfall
  adventure: {
    grassLight: "#DCE8F0",
    grassDeep: "#B8C8D6",
    cliffWarm: "#7d8a96",
    cliffDeep: "#4a5560",
    canopy: ["#3A5A5A", "#2F4F4F"],
    foliage: "pine",
    flowers: [],
    boulder: ["#2B2421", "#5a6b72"],
    treeMul: 0.55,
    grassMul: 0.32,
    motes: { colors: ["#FFFFFF", "#E8F4FF"], count: 52, behavior: "fall", size: 0.28, glow: false },
    // volcanic range on the +X half — basalt, obsidian, lava fissures, embers
    split: {
      grassLight: "#3a2e28",
      grassDeep: "#211a16",
      cliffWarm: "#5a3a2a",
      cliffDeep: "#2a1810",
      canopy: ["#241c16", "#160f0b"],
      boulder: ["#2B2421", "#1A1410"],
      lava: ["#FF4500", "#FFD700", "#FF6B35"],
      motes: { colors: ["#FF6B35", "#FF4500", "#FFD700"], count: 60, behavior: "rise", size: 0.4, glow: true },
    },
  },
};
