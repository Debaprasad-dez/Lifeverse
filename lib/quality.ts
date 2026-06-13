/**
 * Quality tiers. The Settings "quality" value is "auto" by default; auto
 * resolves to a tier from the device (cores, mobile, pixel ratio). Tier
 * drives dpr cap, SSAO, soft shadows and particle density — the drop order
 * from LIFEVERSE_PLAN.md §10. All reads are cheap and synchronous.
 */

import { DEFAULT_SETTINGS, getLocal, type Settings } from "@/lib/storage";

export type Tier = "high" | "medium" | "low";

function detectTier(): Tier {
  if (typeof navigator === "undefined") return "high";
  const cores = navigator.hardwareConcurrency ?? 4;
  const mobile = /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  const mem = (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 4;

  if (mobile) return cores <= 4 || mem <= 3 ? "low" : "medium";
  if (cores >= 8 && mem >= 8) return "high";
  if (cores >= 4) return "medium";
  return "low";
}

let cached: Tier | null = null;

/** Resolved tier: explicit Settings choice wins; "auto" detects once. */
export function effectiveTier(): Tier {
  const q: Settings["quality"] = getLocal("settings", DEFAULT_SETTINGS).quality;
  if (q !== "auto") return q;
  if (!cached) cached = detectTier();
  return cached;
}

/** R3F dpr range per tier — caps render resolution on weaker GPUs. */
export function tierDpr(): [number, number] {
  switch (effectiveTier()) {
    case "high":
      return [1, 2];
    case "medium":
      return [1, 1.5];
    case "low":
      return [1, 1];
  }
}

/** Screen-space AO is the first thing to drop. */
export function aoEnabled(): boolean {
  return effectiveTier() !== "low";
}

/** Soft (PCSS-ish) shadow maps off on low. */
export function softShadowsEnabled(): boolean {
  return effectiveTier() !== "low";
}

/** Particle-density multiplier (clouds, season flakes, fireflies). */
export function particleScale(): number {
  switch (effectiveTier()) {
    case "high":
      return 1;
    case "medium":
      return 0.65;
    case "low":
      return 0.35;
  }
}
