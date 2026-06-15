/**
 * Zen Forest — pure placement for the Health Kingdom re-skin (visual only,
 * island-scoped). Island-LOCAL anchors the renderer (HealthLayer) turns into
 * meshes: the Wellness Lake basin, hero weeping willows ringing it, giant
 * lotus (also the butterfly hatch sites), glowing mushrooms, ferns, and
 * moss-draped boulders. Avoids the placed structures so picking/entry survive.
 */

import { Vector3 } from "three";
import type { IslandGeometry } from "@/engine/generation/island";
import { type CoreKingdomId, type Island } from "@/engine/schema/world";
import { SIZE_SCALE, SLOT_MAPS } from "@/engine/resolver/slots";
import { slotLocalXZ } from "@/engine/resolver/resolve";
import { mulberry32 } from "@/lib/noise";

export interface Spot { x: number; z: number; y: number }
export interface ZenForest {
  lake: { x: number; z: number; y: number; r: number };
  willows: { x: number; z: number; y: number; h: number; s: number }[];
  lotus: { x: number; z: number; y: number; s: number; onLake: boolean }[];
  mushrooms: { x: number; z: number; y: number; s: number; tint: number }[];
  ferns: { x: number; z: number; y: number; s: number; rot: number }[];
  boulders: { x: number; z: number; y: number; s: number; rot: number }[];
  fireflies: Vector3[];
}

export function buildZenForest(island: Island, geom: IslandGeometry, radius: number): ZenForest {
  const rng = mulberry32(0x2e4 ^ Math.round(radius * 100));
  const slots = SLOT_MAPS[island.id as CoreKingdomId] ?? [];
  const avoid = island.structures.map((s) => {
    const sl = slots[s.slot % slots.length];
    const { x, z } = slotLocalXZ(geom, sl);
    return { x, z, r: 2.0 * SIZE_SCALE[sl.size] };
  });
  const cap = (lx: number, lz: number): number => geom.capHeightAt(lx, lz);
  const clear = (lx: number, lz: number, r: number, placed: { x: number; z: number; r: number }[]): boolean =>
    !avoid.some((a) => Math.hypot(lx - a.x, lz - a.z) < a.r + r) &&
    !placed.some((p) => Math.hypot(lx - p.x, lz - p.z) < p.r + r);

  // Wellness Lake basin — a clear spot, slightly sunk
  let lx = 0;
  let lz = 0;
  for (let i = 0; i < 16; i++) {
    const theta = (i / 16) * Math.PI * 2 + 0.4;
    const f = geom.footprintAt(theta);
    const cx = Math.cos(theta) * f * 0.26;
    const cz = Math.sin(theta) * f * 0.26;
    if (!avoid.some((a) => Math.hypot(cx - a.x, cz - a.z) < a.r + radius * 0.24)) { lx = cx; lz = cz; break; }
  }
  const lakeR = radius * 0.22;
  const lake = { x: lx, z: lz, y: cap(lx, lz) - 0.35, r: lakeR };
  const placed: { x: number; z: number; r: number }[] = [{ x: lx, z: lz, r: lakeR }];

  // hero willows ringing the lake
  const willows: ZenForest["willows"] = [];
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2 + 0.7;
    const r = lakeR * 1.7;
    const wx = lx + Math.cos(a) * r;
    const wz = lz + Math.sin(a) * r;
    willows.push({ x: wx, z: wz, y: cap(wx, wz), h: radius * (0.5 + rng() * 0.15), s: radius * 0.12 });
    placed.push({ x: wx, z: wz, r: radius * 0.14 });
  }

  // giant lotus — on the lake + a couple in wet meadow
  const lotus: ZenForest["lotus"] = [];
  for (let i = 0; i < 5; i++) {
    const a = rng() * Math.PI * 2;
    const r = Math.sqrt(rng()) * lakeR * 0.7;
    lotus.push({ x: lx + Math.cos(a) * r, z: lz + Math.sin(a) * r, y: lake.y + 0.06, s: radius * (0.05 + rng() * 0.03), onLake: true });
  }
  for (let i = 0; i < 2; i++) {
    const a = rng() * Math.PI * 2;
    const r = lakeR * (1.3 + rng() * 0.5);
    const mx = lx + Math.cos(a) * r;
    const mz = lz + Math.sin(a) * r;
    lotus.push({ x: mx, z: mz, y: cap(mx, mz) + 0.05, s: radius * 0.05, onLake: false });
  }

  // glowing mushrooms, ferns, moss boulders scattered (clustered)
  const mushrooms: ZenForest["mushrooms"] = [];
  for (let i = 0; i < 30; i++) {
    const theta = rng() * Math.PI * 2;
    const rFrac = 0.12 + rng() * 0.74;
    const f = geom.footprintAt(theta);
    const mx = Math.cos(theta) * f * rFrac;
    const mz = Math.sin(theta) * f * rFrac;
    if (Math.hypot(mx - lx, mz - lz) < lakeR) continue;
    mushrooms.push({ x: mx, z: mz, y: cap(mx, mz), s: radius * (0.02 + rng() * 0.025), tint: Math.floor(rng() * 3) });
  }
  const ferns: ZenForest["ferns"] = [];
  for (let i = 0; i < 36; i++) {
    const theta = rng() * Math.PI * 2;
    const rFrac = 0.12 + rng() * 0.78;
    const f = geom.footprintAt(theta);
    const fx = Math.cos(theta) * f * rFrac;
    const fz = Math.sin(theta) * f * rFrac;
    if (Math.hypot(fx - lx, fz - lz) < lakeR * 0.9) continue;
    ferns.push({ x: fx, z: fz, y: cap(fx, fz), s: radius * (0.04 + rng() * 0.03), rot: rng() * Math.PI * 2 });
  }
  const boulders: ZenForest["boulders"] = [];
  for (let i = 0; i < 7; i++) {
    const theta = rng() * Math.PI * 2;
    const rFrac = 0.2 + rng() * 0.6;
    const f = geom.footprintAt(theta);
    const bx = Math.cos(theta) * f * rFrac;
    const bz = Math.sin(theta) * f * rFrac;
    if (!clear(bx, bz, radius * 0.06, placed)) continue;
    placed.push({ x: bx, z: bz, r: radius * 0.06 });
    boulders.push({ x: bx, z: bz, y: cap(bx, bz), s: radius * (0.05 + rng() * 0.05), rot: rng() * Math.PI * 2 });
  }

  const fireflies: Vector3[] = [];
  for (let i = 0; i < 10; i++) {
    const a = rng() * Math.PI * 2;
    const r = Math.sqrt(rng()) * radius * 0.7;
    const fx = Math.cos(a) * r;
    const fz = Math.sin(a) * r;
    fireflies.push(new Vector3(fx, cap(fx, fz) + 1.0, fz));
  }

  return { lake, willows, lotus, mushrooms, ferns, boulders, fireflies };
}
