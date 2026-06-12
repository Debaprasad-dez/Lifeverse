/**
 * Landmark recipes — achievement monuments and memory landmarks. Same Part
 * primitives as structures (instanced, two pools); gold is the achievement
 * voice, soft pastels are memory's.
 */

import type { KingdomPalette, Part } from "@/engine/generation/structures/kit";
import type { MemoryLandmark, Monument } from "@/engine/schema/world";

const GOLD = "#f7b733";
const GOLD_GLOW = "#ffd97a";
const MARBLE = "#f2ecdf";
const MARBLE_DARK = "#d9d0bc";

export function monumentParts(kind: Monument["kind"], pal: KingdomPalette): Part[] {
  switch (kind) {
    case "obelisk":
      return [
        { kind: "box", offset: [0, 0.18, 0], scale: [1.5, 0.36, 1.5], color: MARBLE_DARK },
        { kind: "box", offset: [0, 1.5, 0], scale: [0.62, 2.4, 0.62], color: MARBLE },
        { kind: "cone", offset: [0, 2.95, 0], scale: [0.62, 0.55, 0.62], color: GOLD },
        { kind: "sphere", offset: [0, 3.35, 0], scale: [0.26, 0.26, 0.26], color: GOLD_GLOW, glow: true },
      ];
    case "statue":
      return [
        { kind: "cylinder", offset: [0, 0.35, 0], scale: [1.5, 0.7, 1.5], color: MARBLE_DARK },
        { kind: "cylinder", offset: [0, 0.95, 0], scale: [0.95, 0.5, 0.95], color: MARBLE },
        { kind: "box", offset: [0, 1.85, 0], scale: [0.55, 1.3, 0.45], color: GOLD },
        { kind: "sphere", offset: [0, 2.75, 0], scale: [0.4, 0.4, 0.4], color: GOLD },
        { kind: "box", offset: [0.42, 2.2, 0], scale: [0.5, 0.16, 0.16], rotY: 0, color: GOLD },
      ];
    case "arch":
      return [
        { kind: "box", offset: [-0.95, 1.1, 0], scale: [0.5, 2.2, 0.6], color: MARBLE },
        { kind: "box", offset: [0.95, 1.1, 0], scale: [0.5, 2.2, 0.6], color: MARBLE },
        { kind: "box", offset: [0, 2.45, 0], scale: [2.6, 0.5, 0.66], color: MARBLE_DARK },
        { kind: "box", offset: [0, 2.78, 0], scale: [2.0, 0.18, 0.5], color: GOLD },
        { kind: "sphere", offset: [0, 2.45, 0], scale: [0.3, 0.3, 0.3], color: GOLD_GLOW, glow: true },
      ];
    case "eternal_flame":
      return [
        { kind: "cylinder", offset: [0, 0.3, 0], scale: [1.4, 0.6, 1.4], color: MARBLE_DARK },
        { kind: "cylinder", offset: [0, 0.85, 0], scale: [0.7, 0.5, 0.7], color: MARBLE },
        { kind: "dome", offset: [0, 1.1, 0], scale: [0.9, 0.4, 0.9], color: GOLD },
        { kind: "sphere", offset: [0, 1.55, 0], scale: [0.45, 0.65, 0.45], color: "#ffb347", glow: true },
        { kind: "sphere", offset: [0, 1.95, 0], scale: [0.22, 0.4, 0.22], color: GOLD_GLOW, glow: true },
      ];
    case "crystal_spire":
      return [
        { kind: "cylinder", offset: [0, 0.25, 0], scale: [1.3, 0.5, 1.3], color: MARBLE_DARK },
        { kind: "cone", offset: [0, 1.8, 0], scale: [0.85, 2.6, 0.85], color: pal.glow, glow: true },
        { kind: "cone", offset: [0.5, 0.95, 0.2], scale: [0.4, 1.0, 0.4], rotY: 20, color: pal.glow, glow: true },
        { kind: "cone", offset: [-0.45, 0.8, -0.25], scale: [0.34, 0.8, 0.34], rotY: -15, color: pal.glow, glow: true },
      ];
  }
}

export function memoryParts(kind: MemoryLandmark["kind"], pal: KingdomPalette): Part[] {
  switch (kind) {
    case "statue":
      return [
        { kind: "cylinder", offset: [0, 0.22, 0], scale: [0.9, 0.44, 0.9], color: MARBLE_DARK },
        { kind: "box", offset: [0, 0.85, 0], scale: [0.36, 0.9, 0.3], color: MARBLE },
        { kind: "sphere", offset: [0, 1.5, 0], scale: [0.28, 0.28, 0.28], color: MARBLE },
      ];
    case "tree":
      return [
        { kind: "cylinder", offset: [0, 0.5, 0], scale: [0.22, 1.0, 0.22], color: "#7c5b42" },
        { kind: "sphere", offset: [0, 1.35, 0], scale: [0.95, 0.85, 0.95], color: "#ffb7d9" },
        { kind: "sphere", offset: [0.45, 1.1, 0.2], scale: [0.55, 0.5, 0.55], color: "#ffcfe6" },
        { kind: "sphere", offset: [-0.4, 1.2, -0.2], scale: [0.5, 0.45, 0.5], color: "#ff9ecf" },
      ];
    case "mural":
      return [
        { kind: "box", offset: [0, 0.75, 0], scale: [1.7, 1.5, 0.18], color: MARBLE },
        { kind: "box", offset: [0, 0.75, 0.06], scale: [1.45, 1.25, 0.1], color: pal.trim },
        { kind: "box", offset: [0, 1.58, 0], scale: [1.85, 0.16, 0.26], color: pal.roof },
      ];
    case "crystal":
      return [
        { kind: "cylinder", offset: [0, 0.14, 0], scale: [0.7, 0.28, 0.7], color: MARBLE_DARK },
        { kind: "cone", offset: [0, 0.95, 0], scale: [0.45, 1.4, 0.45], color: pal.glow, glow: true },
      ];
    case "fountain":
      return [
        { kind: "cylinder", offset: [0, 0.25, 0], scale: [1.5, 0.5, 1.5], color: MARBLE_DARK },
        { kind: "cylinder", offset: [0, 0.5, 0], scale: [1.1, 0.2, 1.1], color: "#9fd9f0", glow: true },
        { kind: "cylinder", offset: [0, 0.7, 0], scale: [0.3, 0.7, 0.3], color: MARBLE },
        { kind: "sphere", offset: [0, 1.15, 0], scale: [0.3, 0.3, 0.3], color: "#bfe9ff", glow: true },
      ];
  }
}
