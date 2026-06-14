/**
 * Career metropolis skyline generator. Builds a dense field of varied
 * procedural skyscrapers across the island's three tiers — silhouettes drawn
 * from real skylines (tapering supertalls + spire à la Burj/One WTC, twisted
 * à la Shanghai Tower, art-deco setbacks à la Empire/Chrysler, glass slabs à
 * la Hong Kong, triangular à la Bank of China, spheres-on-legs à la the
 * Oriental Pearl, and a Marina-Bay-Sands triple-tower + sky deck) — each with
 * a podium, lit window grids, rooftop mechanicals and an antenna beacon. Also
 * lays an asphalt road network between the towers within each tier.
 *
 * Output: instance pools by primitive (body = toon glass/steel, glow = unlit
 * HDR window grids → Bloom) + road/roadGlow pools. Instanced two-pool render.
 */

import { Color } from "three";
import type { IslandGeometry } from "@/engine/generation/island";
import { type CoreKingdomId, type Island } from "@/engine/schema/world";
import { SIZE_SCALE, SLOT_MAPS } from "@/engine/resolver/slots";
import { slotLocalXZ } from "@/engine/resolver/resolve";
import { mulberry32 } from "@/lib/noise";

export type BKind = "box" | "cyl" | "cone" | "octa" | "sphere";
export interface BInst {
  position: [number, number, number];
  rotation: [number, number, number];
  scale: [number, number, number];
  color: string | Color;
}
export type BPools = Record<BKind, BInst[]>;
export interface Skyline {
  body: BPools;
  glow: BPools;
  roads: BInst[];
  roadGlow: BInst[];
}

const emptyPools = (): BPools => ({ box: [], cyl: [], cone: [], octa: [], sphere: [] });

export function buildSkyline(island: Island, geom: IslandGeometry, radius: number): Skyline {
  const body = emptyPools();
  const glow = emptyPools();
  const roads: BInst[] = [];
  const roadGlow: BInst[] = [];
  const rng = mulberry32(0xc17ee5 ^ Math.round(radius * 100));

  const glassCols = ["#26313b", "#2f3d49", "#33424f", "#3a4b59", "#222c34"];
  const steel = "#9aa7b3";
  const dark = "#39444f";
  const winCols = ["#ffd9a0", "#bfe3ff", "#fff0cd", "#9fd6ff"];
  const glass = (): string => glassCols[Math.floor(rng() * glassCols.length)];
  const win = (): string => winCols[Math.floor(rng() * winCols.length)];

  const addB = (
    k: BKind, x: number, y: number, z: number, rotY: number,
    sx: number, sy: number, sz: number, color: string
  ): void => {
    body[k].push({ position: [x, y, z], rotation: [0, rotY, 0], scale: [sx, sy, sz], color });
  };
  const addG = (
    k: BKind, x: number, y: number, z: number, rotY: number,
    sx: number, sy: number, sz: number, hex: string, mul = 1.4
  ): void => {
    glow[k].push({ position: [x, y, z], rotation: [0, rotY, 0], scale: [sx, sy, sz], color: new Color(hex).multiplyScalar(mul) });
  };

  // window grid up a face: stacked thin glowing bands
  const winGrid = (cx: number, by: number, cz: number, rotY: number, fw: number, h: number, fd: number): void => {
    const bands = Math.max(3, Math.min(10, Math.round(h / (fw * 0.55))));
    for (let b = 0; b < bands; b++) {
      addG("box", cx, by + ((b + 0.5) / bands) * h, cz, rotY, fw, (h / bands) * 0.46, fd, win());
    }
  };
  // wide short podium + lit ground-floor lobby
  const podium = (cx: number, by: number, cz: number, w: number): void => {
    addB("box", cx, by + w * 0.28, cz, 0, w * 1.3, w * 0.56, w * 1.3, dark);
    addG("box", cx, by + w * 0.2, cz, 0, w * 1.34, w * 0.18, w * 1.34, "#ffe6b0", 1.2);
  };
  // steel antenna mast + red aviation beacon
  const antenna = (cx: number, topY: number, cz: number, w: number): void => {
    addB("cyl", cx, topY + w * 0.7, cz, 0, w * 0.05, w * 1.4, w * 0.05, steel);
    addG("sphere", cx, topY + w * 1.4, cz, 0, w * 0.12, w * 0.12, w * 0.12, "#ff5a5a", 1.6);
  };
  // rooftop mechanical block
  const rooftop = (cx: number, topY: number, cz: number, w: number): void => {
    addB("box", cx, topY + w * 0.18, cz, rng() * 0.5, w * 0.5, w * 0.36, w * 0.5, dark);
  };

  // ---- archetypes (cx,by,cz = footing; h = height; w = footprint) ----------
  const taper = (cx: number, by: number, cz: number, h: number, w: number): void => {
    podium(cx, by, cz, w);
    const floors = 6;
    const fh = h / floors;
    let cy = by + w * 0.4;
    let cw = w;
    const tw = rng() * 0.1;
    for (let i = 0; i < floors; i++) {
      addB("box", cx, cy + fh * 0.5, cz, tw * i, cw, fh, cw, glass());
      winGrid(cx, cy, cz, tw * i, cw * 0.97, fh, cw * 0.97);
      cw *= 0.84;
      cy += fh;
    }
    addB("cone", cx, cy + w * 0.8, cz, 0, cw * 0.5, w * 1.8, cw * 0.5, steel);
    antenna(cx, cy + w * 1.6, cz, w);
  };

  const twist = (cx: number, by: number, cz: number, h: number, w: number): void => {
    podium(cx, by, cz, w);
    const floors = 9;
    const fh = h / floors;
    let cy = by + w * 0.4;
    for (let i = 0; i < floors; i++) {
      const fw = w * (1 - i * 0.04);
      addB("box", cx, cy + fh * 0.5, cz, i * 0.15, fw, fh, fw, glass());
      addG("box", cx, cy + fh * 0.5, cz, i * 0.15, fw * 0.92, fh * 0.46, fw * 0.92, win());
      cy += fh;
    }
    rooftop(cx, cy, cz, w);
    antenna(cx, cy, cz, w);
  };

  const setback = (cx: number, by: number, cz: number, h: number, w: number): void => {
    podium(cx, by, cz, w);
    const steps = 5;
    let cy = by + w * 0.4;
    let cw = w * 1.1;
    const sh = h / (steps + 1);
    for (let i = 0; i < steps; i++) {
      const bh = sh * (1.2 - i * 0.07);
      addB("box", cx, cy + bh * 0.5, cz, 0, cw, bh, cw, glass());
      winGrid(cx, cy, cz, 0, cw * 0.94, bh, cw * 0.94);
      cw *= 0.8;
      cy += bh;
    }
    addB("cone", cx, cy + w * 1.0, cz, 0, cw * 0.7, w * 2.1, cw * 0.7, steel);
    antenna(cx, cy + w * 1.9, cz, w);
  };

  const slab = (cx: number, by: number, cz: number, h: number, w: number): void => {
    podium(cx, by, cz, w * 1.1);
    const ww = w * 0.7;
    const dd = w * 1.35;
    const rotY = rng() * 0.5;
    const cy = by + w * 0.4;
    addB("box", cx, cy + h * 0.5, cz, rotY, ww, h, dd, glass());
    winGrid(cx, cy, cz, rotY, ww * 0.97, h, dd * 0.97);
    rooftop(cx, cy + h, cz, w);
    antenna(cx, cy + h, cz, w);
  };

  const tri = (cx: number, by: number, cz: number, h: number, w: number): void => {
    podium(cx, by, cz, w);
    const floors = 5;
    const fh = h / floors;
    let cy = by + w * 0.4;
    let cw = w * 1.1;
    for (let i = 0; i < floors; i++) {
      addB("box", cx, cy + fh * 0.5, cz, Math.PI / 4, cw, fh, cw, glass());
      addG("box", cx, cy + fh * 0.5, cz, Math.PI / 4, cw * 0.72, fh * 0.42, cw * 0.72, win());
      cw *= 0.72;
      cy += fh;
    }
    addB("cone", cx, cy + w * 0.6, cz, Math.PI / 4, cw * 0.6, w * 1.3, cw * 0.6, steel);
    antenna(cx, cy + w * 0.6, cz, w);
  };

  const pearl = (cx: number, by: number, cz: number, h: number, w: number): void => {
    addB("cyl", cx, by + h * 0.5, cz, 0, w * 0.32, h, w * 0.32, steel);
    addG("sphere", cx, by + h * 0.42, cz, 0, w * 0.9, w * 0.9, w * 0.9, "#ff8aa0", 1.3);
    addG("sphere", cx, by + h * 0.78, cz, 0, w * 0.58, w * 0.58, w * 0.58, "#bfe3ff", 1.3);
    addB("cone", cx, by + h + w * 0.7, cz, 0, w * 0.16, w * 1.5, w * 0.16, steel);
    for (const sx of [-1, 1] as const) {
      addB("cyl", cx + sx * w * 0.42, by + h * 0.25, cz, 0, w * 0.08, h * 0.5, w * 0.08, steel);
    }
  };

  const sands = (cx: number, by: number, cz: number, h: number, w: number): void => {
    const span = w * 1.25;
    for (const k of [-1, 0, 1] as const) {
      addB("box", cx + k * span, by + h * 0.5, cz, k * 0.05, w * 0.5, h, w * 0.95, glass());
      winGrid(cx + k * span, by, cz, k * 0.05, w * 0.47, h, w * 0.9);
    }
    addB("box", cx, by + h + w * 0.2, cz, 0, span * 2.6, w * 0.32, w * 1.15, steel);
    addG("box", cx, by + h + w * 0.36, cz, 0, span * 2.4, w * 0.08, w * 0.95, "#bfe3ff", 1.3);
  };

  // ---- NY / London inspired archetypes -------------------------------------
  const shard = (cx: number, by: number, cz: number, h: number, w: number): void => {
    // The Shard — glass pyramid tapering to a point
    podium(cx, by, cz, w);
    const floors = 7;
    const fh = h / floors;
    let cy = by + w * 0.4;
    let cw = w;
    for (let i = 0; i < floors; i++) {
      addB("box", cx, cy + fh * 0.5, cz, 0.04, cw, fh, cw, glass());
      winGrid(cx, cy, cz, 0.04, cw * 0.97, fh, cw * 0.97);
      cw *= 0.74;
      cy += fh;
    }
    addB("cone", cx, cy + w * 0.5, cz, 0, cw * 0.95, w * 1.3, cw * 0.95, glass());
  };

  const gherkin = (cx: number, by: number, cz: number, h: number, w: number): void => {
    // 30 St Mary Axe — bulging ovoid
    podium(cx, by, cz, w * 0.9);
    const segs = 8;
    const fh = h / segs;
    let cy = by + w * 0.4;
    for (let i = 0; i < segs; i++) {
      const t = (i + 0.5) / segs;
      const rr = w * (0.55 + 0.55 * Math.sin(t * Math.PI));
      addB("cyl", cx, cy + fh * 0.5, cz, 0, rr, fh, rr, glass());
      addG("cyl", cx, cy + fh * 0.5, cz, i * 0.3, rr * 0.96, fh * 0.4, rr * 0.96, win());
      cy += fh;
    }
    addB("sphere", cx, cy, cz, 0, w * 0.45, w * 0.55, w * 0.45, glass());
    antenna(cx, cy, cz, w * 0.6);
  };

  const walkie = (cx: number, by: number, cz: number, h: number, w: number): void => {
    // 20 Fenchurch — top-heavy curve
    podium(cx, by, cz, w);
    const floors = 5;
    const fh = h / floors;
    let cy = by + w * 0.4;
    let cw = w * 0.7;
    for (let i = 0; i < floors; i++) {
      addB("box", cx, cy + fh * 0.5, cz, 0, cw, fh, cw * 1.25, glass());
      winGrid(cx, cy, cz, 0, cw * 0.96, fh, cw * 1.2);
      cw *= 1.12;
      cy += fh;
    }
    addB("box", cx, cy + w * 0.2, cz, 0, cw * 1.05, w * 0.4, cw * 1.25, dark);
    rooftop(cx, cy, cz, w);
  };

  const wedge = (cx: number, by: number, cz: number, h: number, w: number): void => {
    // Flatiron / Leadenhall sliver — thin prism with a rounded prow
    podium(cx, by, cz, w);
    const ww = w * 0.42;
    const dd = w * 1.7;
    const cy = by + w * 0.4;
    addB("box", cx, cy + h * 0.5, cz, 0, ww, h, dd, glass());
    winGrid(cx, cy, cz, 0, ww * 0.96, h, dd * 0.96);
    addB("cyl", cx, cy + h * 0.5, cz + dd * 0.5, 0, ww * 0.5, h, ww * 0.5, glass());
    rooftop(cx, cy + h, cz, w);
    antenna(cx, cy + h, cz, w);
  };

  const slim = (cx: number, by: number, cz: number, h: number, w: number): void => {
    // 432 Park — ultra-slim square lattice supertall
    podium(cx, by, cz, w * 0.8);
    const ww = w * 0.55;
    const cy = by + w * 0.4;
    addB("box", cx, cy + h * 0.5, cz, rng() * 0.2, ww, h, ww, glass());
    winGrid(cx, cy, cz, 0, ww * 0.98, h, ww * 0.98);
    addB("box", cx, cy + h + w * 0.1, cz, 0, ww * 1.05, w * 0.2, ww * 1.05, dark);
    antenna(cx, cy + h, cz, w);
  };

  const pyramidTop = (cx: number, by: number, cz: number, h: number, w: number): void => {
    // One Canada Square — square tower + pyramid roof
    podium(cx, by, cz, w);
    const cy = by + w * 0.4;
    addB("box", cx, cy + h * 0.5, cz, 0, w, h, w, glass());
    winGrid(cx, cy, cz, 0, w * 0.97, h, w * 0.97);
    addB("cone", cx, cy + h + w * 0.5, cz, 0, w * 0.78, w * 1.1, w * 0.78, steel);
    antenna(cx, cy + h + w * 1.0, cz, w);
  };

  // ---- scatter across tiers, avoiding placed structures --------------------
  const slots = SLOT_MAPS[island.id as CoreKingdomId] ?? [];
  const avoid = island.structures.map((s) => {
    const sl = slots[s.slot % slots.length];
    const { x, z } = slotLocalXZ(geom, sl);
    return { x, z, r: 2.0 * SIZE_SCALE[sl.size] };
  });

  interface Plot { x: number; z: number; by: number; h: number; w: number; pick: number; bi: number }
  const plots: Plot[] = [];

  const bands = [
    { rMin: 0.05, rMax: 0.27, n: 12, hMul: 1.0, w: 0.1 }, // High Citadel — supertalls
    { rMin: 0.3, rMax: 0.56, n: 30, hMul: 0.55, w: 0.092 }, // Mid Plaza — mid-rise
    { rMin: 0.59, rMax: 0.87, n: 38, hMul: 0.32, w: 0.078 }, // Lower Harbor — low-rise
  ];

  for (let bi = 0; bi < bands.length; bi++) {
    const band = bands[bi];
    // organize into 2 concentric rows per tier with small jitter (city blocks)
    for (let i = 0; i < band.n; i++) {
      const theta = (i / band.n) * Math.PI * 2 + rng() * 0.16;
      const row = i % 2;
      const rFrac = band.rMin + (band.rMax - band.rMin) * (row * 0.55 + 0.18 + rng() * 0.2);
      const f = geom.footprintAt(theta);
      const lx = Math.cos(theta) * f * rFrac;
      const lz = Math.sin(theta) * f * rFrac;
      const footR = radius * band.w * 1.25; // tighter packing → denser city
      if (avoid.some((a) => Math.hypot(lx - a.x, lz - a.z) < a.r + footR)) continue;
      if (plots.some((p) => Math.hypot(lx - p.x, lz - p.z) < footR + radius * p.w * 1.25)) continue;
      plots.push({
        x: lx,
        z: lz,
        by: island.position[1] + geom.capHeightAt(lx, lz),
        h: radius * band.hMul * (0.75 + rng() * 0.6),
        w: radius * band.w * (0.8 + rng() * 0.4),
        pick: rng(),
        bi,
      });
    }
  }

  for (const p of plots) {
    const cx = island.position[0] + p.x;
    const cz = island.position[2] + p.z;
    if (p.bi === 0) {
      // citadel supertalls (NY/London icons)
      if (p.pick < 0.18) taper(cx, p.by, cz, p.h * 1.4, p.w);
      else if (p.pick < 0.36) slim(cx, p.by, cz, p.h * 1.5, p.w);
      else if (p.pick < 0.5) shard(cx, p.by, cz, p.h * 1.35, p.w);
      else if (p.pick < 0.64) twist(cx, p.by, cz, p.h * 1.2, p.w);
      else if (p.pick < 0.78) setback(cx, p.by, cz, p.h * 1.1, p.w);
      else if (p.pick < 0.9) sands(cx, p.by, cz, p.h * 0.7, p.w);
      else pearl(cx, p.by, cz, p.h, p.w * 0.9);
    } else if (p.bi === 1) {
      // plaza mid-rise
      if (p.pick < 0.16) gherkin(cx, p.by, cz, p.h, p.w);
      else if (p.pick < 0.32) walkie(cx, p.by, cz, p.h, p.w);
      else if (p.pick < 0.46) pyramidTop(cx, p.by, cz, p.h, p.w);
      else if (p.pick < 0.6) wedge(cx, p.by, cz, p.h, p.w);
      else if (p.pick < 0.72) setback(cx, p.by, cz, p.h, p.w);
      else if (p.pick < 0.86) slab(cx, p.by, cz, p.h, p.w);
      else tri(cx, p.by, cz, p.h, p.w);
    } else {
      // harbor low-rise
      if (p.pick < 0.3) slab(cx, p.by, cz, p.h, p.w);
      else if (p.pick < 0.5) wedge(cx, p.by, cz, p.h, p.w);
      else if (p.pick < 0.7) tri(cx, p.by, cz, p.h, p.w * 0.9);
      else if (p.pick < 0.88) pyramidTop(cx, p.by, cz, p.h, p.w);
      else gherkin(cx, p.by, cz, p.h, p.w);
    }
  }

  // ---- roads: connect each tower to its nearest in-tier neighbours ---------
  const seen = new Set<string>();
  const roadW = radius * 0.05;
  for (let i = 0; i < plots.length; i++) {
    const a = plots[i];
    const near = plots
      .map((b, j) => ({ j, d: Math.hypot(a.x - b.x, a.z - b.z) }))
      .filter((o) => o.j !== i && plots[o.j].bi === a.bi && o.d < radius * 0.42 && Math.abs(plots[o.j].by - a.by) < radius * 0.2)
      .sort((p, q) => p.d - q.d)
      .slice(0, 2);
    for (const o of near) {
      const key = i < o.j ? `${i}-${o.j}` : `${o.j}-${i}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const b = plots[o.j];
      const mx = (a.x + b.x) / 2;
      const mz = (a.z + b.z) / 2;
      const len = o.d;
      const yaw = -Math.atan2(b.z - a.z, b.x - a.x);
      const by = (a.by + b.by) / 2;
      roads.push({
        position: [island.position[0] + mx, by + 0.04, island.position[2] + mz],
        rotation: [0, yaw, 0],
        scale: [len, radius * 0.012, roadW],
        color: "#23272c",
      });
      roadGlow.push({
        position: [island.position[0] + mx, by + 0.07, island.position[2] + mz],
        rotation: [0, yaw, 0],
        scale: [len * 0.82, radius * 0.016, roadW * 0.1],
        color: new Color("#ffd27a").multiplyScalar(1.2),
      });
    }
  }

  return { body, glow, roads, roadGlow };
}
