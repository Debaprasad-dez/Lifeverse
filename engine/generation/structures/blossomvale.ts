/**
 * Blossom Vale — pure placement/geometry for the Relationship Kingdom re-skin
 * (visual only, island-scoped). Produces island-LOCAL anchors the renderer
 * (RelationshipLayer) turns into meshes: a bespoke intertwined root cradle on
 * the underside, a winding memory stream + waterfall lip, sakura archway spots,
 * paper-lantern string endpoints, cottage chimneys, and firefly anchors.
 */

import { Vector3 } from "three";
import type { IslandGeometry } from "@/engine/generation/island";
import { type CoreKingdomId, type Island } from "@/engine/schema/world";
import { SLOT_MAPS } from "@/engine/resolver/slots";
import { slotLocalXZ } from "@/engine/resolver/resolve";
import { mulberry32 } from "@/lib/noise";

export interface ArchSpot {
  x: number;
  z: number;
  y: number;
  rot: number;
  s: number;
}
export interface LanternString {
  a: Vector3;
  b: Vector3;
}
export interface BlossomVale {
  /** Root spines (local) for TubeGeometry — the "giant hand" cradle. */
  roots: Vector3[][];
  /** Moss patch anchors on the roots (local). */
  moss: { p: Vector3; s: number }[];
  /** Memory stream centre-line (local, flat channel) + rim spill. */
  stream: { pts: Vector3[]; lip: Vector3; dir: Vector3; width: number };
  /** Sakura archway clusters over the path/stream. */
  arches: ArchSpot[];
  /** Paper-lantern string endpoints (local). */
  strings: LanternString[];
  /** Cottage chimney tops (local) — smoke origins. */
  chimneys: Vector3[];
  /** Firefly drift anchors (local). */
  fireflies: Vector3[];
}

export function buildBlossomVale(island: Island, geom: IslandGeometry, radius: number): BlossomVale {
  const rng = mulberry32(0xb105 ^ Math.round(radius * 100));

  // ---- root cradle: intertwined spines hugging the underside ---------------
  const roots: Vector3[][] = [];
  const moss: { p: Vector3; s: number }[] = [];
  const N = 9;
  for (let i = 0; i < N; i++) {
    const theta = (i / N) * Math.PI * 2 + rng() * 0.25;
    const tw = (rng() - 0.5) * 0.8; // intertwine twist down the spine
    const pts: Vector3[] = [];
    for (let k = 0; k <= 4; k++) {
      const u = (k / 4) * 0.9 + 0.04;
      const p = geom.undersideAt(theta + tw * u, u);
      pts.push(new Vector3(p.x * 0.99, p.y + (rng() - 0.5) * 0.2, p.z * 0.99));
    }
    roots.push(pts);
    // moss on the upper (near-rim) reaches of each root
    moss.push({ p: pts[0].clone(), s: radius * (0.05 + rng() * 0.04) });
    if (rng() < 0.6) moss.push({ p: pts[1].clone(), s: radius * (0.04 + rng() * 0.03) });
  }

  // ---- memory stream: winding flat channel to a rim spill -------------------
  const channelY = island.position[1] * 0 + geom.capHeightAt(0, 0) - 0.35; // flat (local), carved
  const thetaLip = 1.15; // a calm rim quadrant (keeps centre/sides clear for UI)
  const M = 14;
  const pts: Vector3[] = [];
  for (let k = 0; k <= M; k++) {
    const u = k / M;
    const theta = (1 - u) * 2.5 + u * thetaLip + Math.sin(u * Math.PI * 1.5) * 0.25;
    const rFrac = 0.08 + 0.92 * u;
    const f = geom.footprintAt(theta);
    pts.push(new Vector3(Math.cos(theta) * f * rFrac, channelY, Math.sin(theta) * f * rFrac));
  }
  const lip = pts[M].clone();
  const prev = pts[M - 1];
  const stream = {
    pts,
    lip,
    dir: new Vector3(lip.x - prev.x, 0, lip.z - prev.z).normalize(),
    width: radius * 0.13,
  };

  // ---- sakura archways over the stream --------------------------------------
  const arches: ArchSpot[] = [];
  for (const u of [0.3, 0.55, 0.78]) {
    const idx = Math.round(u * M);
    const c = pts[idx];
    const t = pts[Math.min(M, idx + 1)].clone().sub(pts[Math.max(0, idx - 1)]);
    arches.push({
      x: c.x,
      z: c.z,
      y: geom.capHeightAt(c.x, c.z),
      rot: Math.atan2(t.z, t.x),
      s: radius * (0.16 + rng() * 0.04),
    });
  }

  // ---- paper-lantern strings: between arches + a meadow ring ----------------
  const strings: LanternString[] = [];
  for (let i = 0; i < arches.length - 1; i++) {
    const a = arches[i];
    const b = arches[i + 1];
    strings.push({
      a: new Vector3(a.x, a.y + a.s * 1.4, a.z),
      b: new Vector3(b.x, b.y + b.s * 1.4, b.z),
    });
  }
  const ringN = 5;
  for (let i = 0; i < ringN; i++) {
    const t0 = (i / ringN) * Math.PI * 2;
    const t1 = ((i + 1) / ringN) * Math.PI * 2;
    const rr = 0.5;
    const f0 = geom.footprintAt(t0);
    const f1 = geom.footprintAt(t1);
    const a = new Vector3(Math.cos(t0) * f0 * rr, 0, Math.sin(t0) * f0 * rr);
    const b = new Vector3(Math.cos(t1) * f1 * rr, 0, Math.sin(t1) * f1 * rr);
    a.y = geom.capHeightAt(a.x, a.z) + radius * 0.16;
    b.y = geom.capHeightAt(b.x, b.z) + radius * 0.16;
    strings.push({ a, b });
  }

  // ---- chimneys above the cottage/village structures -----------------------
  const slots = SLOT_MAPS[island.id as CoreKingdomId] ?? [];
  const villageTypes = new Set(["family_village", "friendship_district", "community_square", "celebration_plaza"]);
  const chimneys: Vector3[] = [];
  for (const st of island.structures) {
    if (!villageTypes.has(st.type)) continue;
    const sl = slots[st.slot % slots.length];
    const { x, z } = slotLocalXZ(geom, sl);
    chimneys.push(new Vector3(x, geom.capHeightAt(x, z) + 1.8, z));
  }

  // ---- firefly drift anchors over the meadow -------------------------------
  const fireflies: Vector3[] = [];
  for (let i = 0; i < 7; i++) {
    const a = rng() * Math.PI * 2;
    const r = Math.sqrt(rng()) * radius * 0.7;
    const x = Math.cos(a) * r;
    const z = Math.sin(a) * r;
    fireflies.push(new Vector3(x, geom.capHeightAt(x, z) + 1.2, z));
  }

  return { roots, moss, stream, arches, strings, chimneys, fireflies };
}
