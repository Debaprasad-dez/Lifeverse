import { Vector3 } from "three";

/** Color tokens (design language — see LIFEVERSE_PLAN.md / globals.css). */
export const PALETTE = {
  aura: "#4fc3f7",
  auraDeep: "#006688",
  gold: "#fdd34d",
  mystic: "#c8a8ff",
  skyZenith: "#9ed4ff", // UI token (DESIGN.md)
  skyHorizon: "#f4faff",
  // 3D sky runs deeper than the UI tokens to match the reference renders
  // (screen.png: saturated azure overhead, creamy glow at the horizon).
  sky3DZenith: "#3f9be4",
  sky3DMid: "#7fc0ef",
  sky3DHorizon: "#f2f8fc",
  sunWarm: "#ffd9a0",
  haze: "#e8f4fd",

  grassLight: "#8edb63",
  grassDeep: "#56a84b",
  cliffWarm: "#c79e6b",
  cliffDeep: "#8d6f4e",
  rockUnder: "#7d6a60",
  rockTip: "#564a50",
  canopyLight: "#6fcf65",
  canopyDeep: "#3f9a4e",
  trunk: "#8a5f3e",
  waterfall: "#bfe9ff",
  healthAccent: "#3faf6e",
} as const;

/** Deterministic world seed (user-configurable in later phases). */
export const WORLD_SEED = 20260612;

export const WORLD = {
  islandRadius: 11,
  islandCapY: 0, // cap rim sits around y=0
  cloudSeaY: -26,
  skyRadius: 950,
} as const;

/**
 * Golden-hour sun. The plan quotes ~35° elevation, but the reference render
 * (image.png) has the sun nearly on the horizon — 22° lands the long warm
 * light + visible glow that defines the mood.
 */
export const SUN_DIRECTION = new Vector3(
  Math.cos((22 * Math.PI) / 180) * Math.sin((-52 * Math.PI) / 180),
  Math.sin((22 * Math.PI) / 180),
  Math.cos((22 * Math.PI) / 180) * Math.cos((-52 * Math.PI) / 180)
).normalize();

export const CAMERA = {
  fov: 50,
  fovBreathe: 56,
  near: 0.5,
  far: 2400,
  world: {
    radius: [60, 220] as const,
    polar: [(10 * Math.PI) / 180, (85 * Math.PI) / 180] as const,
    target: new Vector3(0, 2, 0),
  },
  island: {
    radius: [8, 40] as const,
    // Past 90° so the camera can dip below and orbit the sculpted underside.
    polar: [(5 * Math.PI) / 180, (120 * Math.PI) / 180] as const,
  },
  // Opening shot looks toward the sun side — golden-hour backlight like
  // image.png, island silhouetted against the glow.
  initial: {
    radius: 48,
    azimuth: (110 * Math.PI) / 180,
    polar: (80 * Math.PI) / 180,
  },
} as const;

export const DEG = Math.PI / 180;
