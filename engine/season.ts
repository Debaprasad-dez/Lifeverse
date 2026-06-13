/**
 * Seasons — diegetic, driven by the world's `season` field (genesis sets it
 * from the real date; time-travel shows the snapshot's season). Each season
 * gets falling particles and a faint color grade. No charts, no labels in
 * the world — you just feel the time of year.
 */

import type { Season } from "@/engine/schema/world";

export type ParticleKind = "petal" | "pollen" | "leaf" | "snow";

export interface SeasonParams {
  kind: ParticleKind;
  /** Particle tint colors (picked per-instance). */
  colors: string[];
  count: number;
  fallSpeed: number;
  drift: number;
  size: number;
  /** Faint full-screen grade (rgb 0-255) + strength 0-1. */
  grade: [number, number, number];
  gradeAmount: number;
  label: string;
}

const SEASONS: Record<Season, SeasonParams> = {
  spring: {
    kind: "petal",
    colors: ["#ffd0e4", "#ffb7d9", "#fff0f6", "#ffc8de"],
    count: 220,
    fallSpeed: 1.6,
    drift: 1.4,
    size: 0.5,
    grade: [255, 224, 238],
    gradeAmount: 0.06,
    label: "Spring",
  },
  summer: {
    kind: "pollen",
    colors: ["#fff4c2", "#ffe9a8", "#fffbe6"],
    count: 140,
    fallSpeed: 0.5,
    drift: 1.0,
    size: 0.22,
    grade: [255, 240, 200],
    gradeAmount: 0.05,
    label: "Summer",
  },
  autumn: {
    kind: "leaf",
    colors: ["#e8923a", "#d4632a", "#f0b04a", "#c24a2a", "#e7c46b"],
    count: 200,
    fallSpeed: 2.0,
    drift: 2.2,
    size: 0.6,
    grade: [255, 196, 130],
    gradeAmount: 0.09,
    label: "Autumn",
  },
  winter: {
    kind: "snow",
    colors: ["#ffffff", "#eaf4ff", "#dcecff"],
    count: 320,
    fallSpeed: 1.1,
    drift: 1.0,
    size: 0.34,
    grade: [206, 226, 255],
    gradeAmount: 0.1,
    label: "Winter",
  },
};

export function seasonParams(season: Season): SeasonParams {
  return SEASONS[season];
}

/** Real-world season (northern hemisphere) from a date. */
export function seasonFromDate(d = new Date()): Season {
  const m = d.getMonth();
  if (m <= 1 || m === 11) return "winter";
  if (m <= 4) return "spring";
  if (m <= 7) return "summer";
  return "autumn";
}

export const SEASON_ORDER: Season[] = ["spring", "summer", "autumn", "winter"];
