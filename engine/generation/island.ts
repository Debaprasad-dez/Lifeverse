/**
 * Procedural floating-island geometry. Deterministic from a seed:
 * superellipse footprint + radial simplex noise, grass cap with rolling
 * hills, a cliff ring, and a sculpted inverted underside cone — the island
 * must read beautifully from EVERY angle, including directly below
 * (Laputa-style reference: `image copy.png`).
 */

import { BufferAttribute, BufferGeometry, Color, Vector3 } from "three";
import { clamp, fbm2, lerp, makeNoise2D, mulberry32, smoothstep } from "@/lib/noise";
import { PALETTE } from "@/lib/constants";

export interface IslandParams {
  seed: number;
  radius: number; // mean cap radius
  capHeight: number; // hill amplitude reference
  depth: number; // distance from rim to underside tip
  angularSegments?: number;
  /** LOD multiplier (1 full, 0.5 mid, 0.25 silhouette) applied to all rows. */
  detail?: number;
  /** Structure slot anchors (azimuth deg, radial fraction) — worn dirt
   *  paths run from the island center out to each. Resolved against this
   *  island's own footprint so they land exactly at structure bases. */
  paths?: { t: number; r: number }[];
}

export interface IslandGeometry {
  geometry: BufferGeometry;
  /** Grass-cap surface height at world (x, z) — for placing flora. */
  capHeightAt: (x: number, z: number) => number;
  /** Footprint radius at azimuth θ. */
  footprintAt: (theta: number) => number;
  /** Point on the cap rim at azimuth θ. */
  edgePointAt: (theta: number) => Vector3;
  /** Point on the underside surface (u: 0 rim → 1 tip). */
  undersideAt: (theta: number, u: number) => Vector3;
  /** Seeded waterfall anchor: lip position on the rim + outward direction. */
  waterfall: { lip: Vector3; dir: Vector3; theta: number };
}

const BASE_CAP_ROWS = 12;
const BASE_CLIFF_ROWS = 8;
const BASE_UNDER_ROWS = 14;

/** Distance from point to the segment (0,0)→(px,pz). */
function distToSpoke(x: number, z: number, px: number, pz: number): number {
  const lenSq = px * px + pz * pz;
  if (lenSq < 1e-6) return Math.hypot(x, z);
  const t = clamp((x * px + z * pz) / lenSq, 0, 1);
  return Math.hypot(x - px * t, z - pz * t);
}

export function buildIsland(params: IslandParams): IslandGeometry {
  const { seed, radius, capHeight, depth, detail = 1, paths = [] } = params;
  const A = Math.max(16, Math.round((params.angularSegments ?? 96) * detail));
  const CAP_ROWS = Math.max(4, Math.round(BASE_CAP_ROWS * detail));
  const CLIFF_ROWS = Math.max(3, Math.round(BASE_CLIFF_ROWS * detail));
  const UNDER_ROWS = Math.max(4, Math.round(BASE_UNDER_ROWS * detail));
  const rng = mulberry32(seed);
  const noise = makeNoise2D(seed ^ 0x9e3779b9);
  const offX = rng() * 100;
  const offZ = rng() * 100;
  const superN = 2.4 + rng() * 0.5; // superellipse exponent (squircle-ish)

  const footprintAt = (theta: number): number => {
    const c = Math.abs(Math.cos(theta));
    const s = Math.abs(Math.sin(theta));
    const superR = Math.pow(Math.pow(c, superN) + Math.pow(s, superN), -1 / superN);
    // Periodic radial noise: sampled on the unit circle, so θ=0 and θ=2π meet.
    const wobble =
      1 + 0.15 * fbm2(noise, Math.cos(theta) * 1.6 + 4.2, Math.sin(theta) * 1.6 - 2.7, 3);
    return radius * superR * wobble;
  };

  const capHeightAt = (x: number, z: number): number => {
    const theta = Math.atan2(z, x);
    const f = footprintAt(theta);
    const s = clamp(Math.hypot(x, z) / f, 0, 1);
    const dome = capHeight * 0.45 * (1 - s * s);
    const hills =
      fbm2(noise, x * 0.085 + offX, z * 0.085 + offZ, 4) *
      capHeight *
      0.85 *
      (1 - smoothstep(0.72, 0.98, s));
    const micro = fbm2(noise, x * 0.5 - offX, z * 0.5 + offZ, 2) * 0.16;
    const lip = 0.32 * smoothstep(0.78, 0.96, s);
    return dome + hills + micro + lip;
  };

  // resolve path endpoints against this footprint (slot.t deg → local XZ)
  const pathPts = paths.map((p) => {
    const th = (p.t * Math.PI) / 180;
    const f = footprintAt(th) * p.r;
    return { x: Math.cos(th) * f, z: Math.sin(th) * f };
  });

  const cliffEndY = -depth * 0.4;
  const tipY = -depth * (1 + 0.1 * (rng() - 0.5));

  // domain warp gives the cliff noise that eroded, non-procedural look
  const cliffWarp = (theta: number, t: number): number =>
    fbm2(noise, Math.cos(theta) * 1.4 + 9.1, Math.sin(theta) * 1.4 - t * 1.1, 2);

  /** Sedimentary strata: quantized ledges, offset by the warp field. */
  const strataAt = (theta: number, t: number): number =>
    Math.sin(t * 17 + cliffWarp(theta, t) * 4.5 + Math.cos(theta) * 1.3);

  const cliffRadiusAt = (theta: number, t: number): number => {
    const w = cliffWarp(theta, t);
    const striate =
      0.09 *
      fbm2(noise, Math.cos(theta) * 3.1 + t * 1.7 + w * 1.6, Math.sin(theta) * 3.1 - t * 2.3 + w * 1.6, 3);
    const ledge = smoothstep(0.45, 0.95, strataAt(theta, t)) * 0.04;
    return footprintAt(theta) * (1 + 0.05 * Math.sin(t * Math.PI) - 0.08 * t + striate + ledge);
  };

  const undersideAt = (theta: number, u: number): Vector3 => {
    const chunk = fbm2(
      noise,
      Math.cos(theta) * 2.2 + u * 2.8 + 7.7,
      Math.sin(theta) * 2.2 - u * 1.9,
      3
    );
    const r =
      footprintAt(theta) * 0.9 * Math.pow(1 - u, 1.5) * (1 + 0.26 * chunk * (1 - u * 0.75));
    const y = lerp(cliffEndY, tipY, Math.pow(u, 1.15)) + 0.5 * chunk * (1 - u);
    return new Vector3(Math.cos(theta) * r, y, Math.sin(theta) * r);
  };

  const rows = CAP_ROWS + CLIFF_ROWS + UNDER_ROWS;
  const vertexCount = rows * A;
  const positions = new Float32Array(vertexCount * 3);
  const colors = new Float32Array(vertexCount * 3);

  const grassLight = new Color(PALETTE.grassLight);
  const grassDeep = new Color(PALETTE.grassDeep);
  const cliffWarm = new Color(PALETTE.cliffWarm);
  const cliffDeep = new Color(PALETTE.cliffDeep);
  const rockUnder = new Color(PALETTE.rockUnder);
  const rockTip = new Color(PALETTE.rockTip);
  const mystic = new Color(PALETTE.mystic);
  const dirt = new Color("#b0916a");
  const dirtDeep = new Color("#9a7c58");
  const tmp = new Color();
  const tmp2 = new Color();

  let vi = 0;
  const writeVertex = (x: number, y: number, z: number, color: Color): void => {
    positions[vi * 3] = x;
    positions[vi * 3 + 1] = y;
    positions[vi * 3 + 2] = z;
    colors[vi * 3] = color.r;
    colors[vi * 3 + 1] = color.g;
    colors[vi * 3 + 2] = color.b;
    vi++;
  };

  for (let row = 0; row < rows; row++) {
    for (let a = 0; a < A; a++) {
      const theta = (a / A) * Math.PI * 2;

      if (row < CAP_ROWS) {
        // ---- grass cap (center → rim) ----
        const s = row === 0 ? 0.001 : row / (CAP_ROWS - 1);
        const r = footprintAt(theta) * Math.pow(s, 0.92);
        const x = Math.cos(theta) * r;
        const z = Math.sin(theta) * r;
        const y = capHeightAt(x, z);

        const patch = fbm2(noise, x * 0.16 + 31, z * 0.16 - 17, 3) * 0.5 + 0.5;
        tmp.copy(grassDeep).lerp(grassLight, patch);

        // worn dirt paths: center → structure anchors, noise-frayed edges
        if (pathPts.length > 0 && s < 0.97) {
          let dMin = Infinity;
          for (const p of pathPts) {
            const d = distToSpoke(x, z, p.x, p.z);
            if (d < dMin) dMin = d;
          }
          const fray = fbm2(noise, x * 0.55 + 13, z * 0.55 - 8, 2);
          const width = 0.8 + fray * 0.35;
          const k = 1 - smoothstep(width * 0.45, width, dMin);
          if (k > 0) {
            tmp.lerp(tmp2.copy(dirt).lerp(dirtDeep, patch * 0.6), k * 0.8);
          }
        }

        // dirt ring where grass folds over the rim
        tmp.lerp(tmp2.copy(cliffWarm), smoothstep(0.93, 1, s) * 0.55);
        // valley AO
        const hillN = fbm2(noise, x * 0.085 + offX, z * 0.085 + offZ, 4);
        tmp.multiplyScalar(1 - Math.max(0, -hillN) * 0.22);
        // cavity AO bake: pits darken, knolls catch light (film grounding)
        const dd = 1.15;
        const avgH =
          (capHeightAt(x + dd, z) +
            capHeightAt(x - dd, z) +
            capHeightAt(x, z + dd) +
            capHeightAt(x, z - dd)) /
          4;
        tmp.multiplyScalar(clamp(1 + (y - avgH) * 0.5, 0.76, 1.07));
        writeVertex(x, y, z, tmp);
      } else if (row < CAP_ROWS + CLIFF_ROWS) {
        // ---- cliff ring ----
        const t = (row - CAP_ROWS + 1) / CLIFF_ROWS;
        const r = cliffRadiusAt(theta, t);
        const x = Math.cos(theta) * r;
        const z = Math.sin(theta) * r;
        const edgeY = capHeightAt(Math.cos(theta) * footprintAt(theta) * 0.999, Math.sin(theta) * footprintAt(theta) * 0.999);
        const y = lerp(edgeY - 0.12, cliffEndY, Math.pow(t, 1.25));

        const w = cliffWarp(theta, t);
        const band =
          fbm2(
            noise,
            Math.cos(theta) * 3.1 + t * 1.7 + w * 1.6,
            Math.sin(theta) * 3.1 - t * 2.3 + w * 1.6,
            3
          ) *
            0.5 +
          0.5;
        tmp.copy(cliffDeep).lerp(cliffWarm, band);
        // sedimentary strata: alternate bands shade darker, ledges lighter
        const strata = strataAt(theta, t);
        tmp.multiplyScalar(0.96 + strata * 0.055);
        // contact occlusion under the grass overhang (deeper = filmic seam)
        tmp.multiplyScalar(1 - (1 - smoothstep(0, 0.38, t)) * 0.34);
        writeVertex(x, y, z, tmp);
      } else {
        // ---- sculpted underside cone ----
        const u = (row - CAP_ROWS - CLIFF_ROWS + 1) / UNDER_ROWS;
        const p = undersideAt(theta, u);
        if (u >= 1) p.set(0, tipY, 0); // collapse final ring to a clean tip

        tmp.copy(rockUnder).lerp(rockTip, Math.pow(u, 1.3));
        // faint crystal-mystic glint toward the tip (reference: hanging crystals)
        tmp.lerp(tmp2.copy(mystic), 0.1 * smoothstep(0.7, 1, u));
        const crevice = fbm2(noise, Math.cos(theta) * 2.2 + u * 2.8 + 7.7, Math.sin(theta) * 2.2 - u * 1.9, 3);
        tmp.multiplyScalar(1 - Math.max(0, -crevice) * 0.3);
        writeVertex(p.x, p.y, p.z, tmp);
      }
    }
  }

  // Grid triangulation with azimuthal wrap.
  const indices: number[] = [];
  for (let row = 0; row < rows - 1; row++) {
    for (let a = 0; a < A; a++) {
      const a1 = (a + 1) % A;
      const i0 = row * A + a;
      const i1 = row * A + a1;
      const i2 = (row + 1) * A + a;
      const i3 = (row + 1) * A + a1;
      indices.push(i0, i2, i1, i1, i2, i3);
    }
  }

  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new BufferAttribute(positions, 3));
  geometry.setAttribute("color", new BufferAttribute(colors, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();

  // Guarantee outward-facing winding: the cap-center normal must point up.
  const ny = geometry.attributes.normal.getY(0);
  if (ny < 0) {
    const idx = geometry.index!;
    for (let i = 0; i < idx.count; i += 3) {
      const b = idx.getX(i + 1);
      idx.setX(i + 1, idx.getX(i + 2));
      idx.setX(i + 2, b);
    }
    geometry.computeVertexNormals();
  }

  const edgePointAt = (theta: number): Vector3 => {
    const f = footprintAt(theta);
    const x = Math.cos(theta) * f;
    const z = Math.sin(theta) * f;
    return new Vector3(x, capHeightAt(x * 0.999, z * 0.999), z);
  };

  // Waterfall pours from a seeded rim notch on the camera-facing quadrant
  // (initial camera azimuth 110° looks at the θ≈-0.35 rad side).
  const wTheta = -0.75 + rng() * 0.8;
  const lip = edgePointAt(wTheta);
  const dir = new Vector3(Math.cos(wTheta), 0, Math.sin(wTheta));

  return {
    geometry,
    capHeightAt,
    footprintAt,
    edgePointAt,
    undersideAt,
    waterfall: { lip, dir, theta: wTheta },
  };
}

export interface StalactiteInstance {
  position: Vector3;
  scale: Vector3;
  tiltX: number;
  tiltZ: number;
}

/** Hanging rock spikes under the island (instanced cones, apex down). */
export function buildStalactites(
  seed: number,
  island: IslandGeometry,
  count = 26
): StalactiteInstance[] {
  const rng = mulberry32(seed ^ 0x51ab3e);
  const out: StalactiteInstance[] = [];
  for (let i = 0; i < count; i++) {
    const theta = rng() * Math.PI * 2;
    const u = 0.08 + rng() * 0.6;
    const anchor = island.undersideAt(theta, u);
    // bigger spikes cluster toward the center column
    const central = 1 - u * 0.6;
    const len = (1.3 + rng() * 2.3) * central;
    const rad = (0.28 + rng() * 0.45) * central;
    out.push({
      position: new Vector3(anchor.x, anchor.y + 0.25, anchor.z),
      scale: new Vector3(rad, len, rad),
      tiltX: (rng() - 0.5) * 0.24,
      tiltZ: (rng() - 0.5) * 0.24,
    });
  }
  return out;
}
