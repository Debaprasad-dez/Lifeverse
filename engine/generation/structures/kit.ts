/**
 * Parametric structure kit — composable colored primitives. Two render
 * pools: `glow: false` parts go to the toon pool, `glow: true` to an unlit
 * bright pool that Bloom turns into light (windows, lanterns, crystals,
 * holograms). Everything stays instanced; a part is data, never a mesh.
 */

export type PrimKind = "box" | "cylinder" | "cone" | "dome" | "sphere";

export interface Part {
  kind: PrimKind;
  offset: [number, number, number];
  scale: [number, number, number];
  rotY?: number;
  color: string;
  glow?: boolean;
}

/** Per-kingdom material palette (chunky stylized, saturated accents). */
export interface KingdomPalette {
  bodyA: string;
  bodyB: string;
  roof: string;
  trim: string;
  glow: string;
}

// -- low-level builders ------------------------------------------------------

export function towerKit(
  pal: KingdomPalette,
  floors: number,
  w = 1,
  opts: { litBands?: boolean; capSpire?: boolean } = {}
): Part[] {
  const { litBands = true, capSpire = true } = opts;
  const parts: Part[] = [];
  let y = 0;
  for (let i = 0; i < floors; i++) {
    const fw = w * (1 - i * 0.13);
    const fh = 1.0 - i * 0.07;
    parts.push({
      kind: "box",
      offset: [0, y + fh / 2, 0],
      scale: [fw, fh, fw],
      rotY: i * 9,
      color: i % 2 === 0 ? pal.bodyA : pal.bodyB,
    });
    if (litBands && i < floors - 1) {
      parts.push({
        kind: "box",
        offset: [0, y + fh + 0.05, 0],
        scale: [fw * 0.88, 0.14, fw * 0.88],
        rotY: i * 9,
        color: pal.glow,
        glow: true,
      });
      y += 0.14;
    }
    y += fh;
  }
  if (capSpire) {
    parts.push({
      kind: "cone",
      offset: [0, y + 0.34, 0],
      scale: [w * 0.55, 0.7, w * 0.55],
      color: pal.roof,
    });
    parts.push({
      kind: "sphere",
      offset: [0, y + 0.78, 0],
      scale: [0.16, 0.16, 0.16],
      color: pal.glow,
      glow: true,
    });
  }
  return parts;
}

export function gableKit(
  pal: KingdomPalette,
  w = 2,
  d = 1.2,
  opts: { door?: boolean; windows?: number; chimney?: boolean } = {}
): Part[] {
  const { door = true, windows = 2, chimney = false } = opts;
  const parts: Part[] = [
    { kind: "box", offset: [0, 0.45, 0], scale: [w, 0.9, d], color: pal.bodyA },
    {
      kind: "cone",
      offset: [0, 1.17, 0],
      scale: [Math.hypot(w, d) * 0.62, 0.6, Math.hypot(w, d) * 0.62],
      rotY: 45,
      color: pal.roof,
    },
  ];
  if (door) {
    parts.push({
      kind: "box",
      offset: [0, 0.3, d / 2 + 0.01],
      scale: [0.26, 0.6, 0.06],
      color: pal.trim,
    });
  }
  for (let i = 0; i < windows; i++) {
    const x = (i - (windows - 1) / 2) * (w / windows) * 0.8;
    if (door && Math.abs(x) < 0.25) continue;
    parts.push({
      kind: "box",
      offset: [x, 0.55, d / 2 + 0.01],
      scale: [0.2, 0.22, 0.05],
      color: pal.glow,
      glow: true,
    });
  }
  if (chimney) {
    parts.push({
      kind: "box",
      offset: [w * 0.28, 1.35, 0],
      scale: [0.18, 0.5, 0.18],
      color: pal.bodyB,
    });
  }
  return parts;
}

export function domeKit(pal: KingdomPalette, r = 0.9, opts: { lit?: boolean } = {}): Part[] {
  const parts: Part[] = [
    { kind: "cylinder", offset: [0, 0.36, 0], scale: [r, 0.72, r], color: pal.bodyA },
    { kind: "dome", offset: [0, 0.72, 0], scale: [r * 0.94, r * 0.8, r * 0.94], color: pal.roof },
  ];
  if (opts.lit !== false) {
    parts.push({
      kind: "cylinder",
      offset: [0, 0.62, 0],
      scale: [r * 1.01, 0.1, r * 1.01],
      color: pal.glow,
      glow: true,
    });
  }
  return parts;
}

export function crystalKit(color: string, n = 3, big = 0.55): Part[] {
  const parts: Part[] = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const r = i === 0 ? 0 : 0.3;
    const h = big * (i === 0 ? 1 : 0.55 + (i % 2) * 0.2);
    parts.push({
      kind: "cone",
      offset: [Math.cos(a) * r, h / 2, Math.sin(a) * r],
      scale: [h * 0.36, h, h * 0.36],
      rotY: i * 47,
      color,
      glow: true,
    });
  }
  return parts;
}

export function bannerKit(pal: KingdomPalette, h = 1.6): Part[] {
  return [
    { kind: "cylinder", offset: [0, h / 2, 0], scale: [0.06, h, 0.06], color: pal.trim },
    { kind: "box", offset: [0.26, h * 0.82, 0], scale: [0.46, 0.3, 0.04], color: pal.roof },
  ];
}

export function lanternKit(pal: KingdomPalette, h = 0.9): Part[] {
  return [
    { kind: "cylinder", offset: [0, h / 2, 0], scale: [0.05, h, 0.05], color: pal.trim },
    { kind: "sphere", offset: [0, h + 0.1, 0], scale: [0.16, 0.18, 0.16], color: pal.glow, glow: true },
  ];
}

export function bookstackKit(pal: KingdomPalette): Part[] {
  return [
    { kind: "box", offset: [0, 0.08, 0], scale: [0.5, 0.16, 0.36], rotY: 0, color: pal.roof },
    { kind: "box", offset: [0.04, 0.24, 0], scale: [0.44, 0.16, 0.32], rotY: 18, color: pal.bodyB },
    { kind: "box", offset: [-0.03, 0.4, 0], scale: [0.4, 0.16, 0.3], rotY: -12, color: pal.trim },
  ];
}

export function boatKit(pal: KingdomPalette): Part[] {
  return [
    // flipped dome = hull
    { kind: "dome", offset: [0, 0.16, 0], scale: [0.9, -0.3, 0.42], color: pal.trim },
    { kind: "cylinder", offset: [0, 0.62, 0], scale: [0.05, 0.9, 0.05], color: pal.bodyB },
    { kind: "box", offset: [0.16, 0.72, 0], scale: [0.34, 0.42, 0.03], color: pal.bodyA },
  ];
}

export function tentKit(pal: KingdomPalette, r = 0.65): Part[] {
  return [
    { kind: "cone", offset: [0, 0.4, 0], scale: [r * 2, 0.8, r * 2], rotY: 30, color: pal.roof },
    { kind: "box", offset: [0, 0.18, r * 0.92], scale: [0.2, 0.36, 0.06], color: pal.trim },
  ];
}

export function gearKit(pal: KingdomPalette, r = 0.5): Part[] {
  const parts: Part[] = [
    { kind: "cylinder", offset: [0, 0, 0], scale: [r * 2, 0.16, r * 2], color: pal.trim },
    { kind: "cylinder", offset: [0, 0, 0], scale: [r * 0.6, 0.2, r * 0.6], color: pal.glow, glow: true },
  ];
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    parts.push({
      kind: "box",
      offset: [Math.cos(a) * r, 0, Math.sin(a) * r],
      scale: [0.18, 0.14, 0.18],
      rotY: (a * 180) / Math.PI,
      color: pal.trim,
    });
  }
  return parts;
}

/** Reposition/rotate/scale a sub-kit into a parent recipe. */
export function place(
  parts: Part[],
  at: [number, number, number],
  opts: { rotY?: number; scale?: number } = {}
): Part[] {
  const { rotY = 0, scale = 1 } = opts;
  const rad = (rotY * Math.PI) / 180;
  const c = Math.cos(rad);
  const s = Math.sin(rad);
  return parts.map((p) => ({
    ...p,
    offset: [
      at[0] + (p.offset[0] * c - p.offset[2] * s) * scale,
      at[1] + p.offset[1] * scale,
      at[2] + (p.offset[0] * s + p.offset[2] * c) * scale,
    ],
    scale: [p.scale[0] * scale, p.scale[1] * scale, p.scale[2] * scale],
    rotY: (p.rotY ?? 0) + rotY,
  }));
}
