/**
 * Erupting-volcano placement for the Adventure island's volcanic half. Pure:
 * returns the island-local anchor + dimensions so the renderer (VolcanoLayer)
 * and the flora keep-out (WorldGraph) agree on one spot. The volcano sits on
 * the local +X half — opposite the glacier — mid-radius so it reads as the
 * hero peak of the frontier.
 */

import { BufferAttribute, BufferGeometry, Color, Vector3 } from "three";
import { clamp, fbm2, lerp, makeNoise2D, mulberry32, smoothstep } from "@/lib/noise";
import type { IslandGeometry } from "@/engine/generation/island";
import type { Island } from "@/engine/schema/world";

export interface VolcanoPlacement {
  /** Island-local anchor (add island.position) + cap height at the base. */
  x: number;
  z: number;
  y: number;
  /** Base radius, total cone height, crater-mouth radius. */
  base: number;
  height: number;
  craterR: number;
  /** Expedition-camp spots (island-local XZ) ringing the volcano foot. */
  camps: { x: number; z: number }[];
  /** Flora/rock keep-out disc (island-local). */
  keepOut: { x: number; z: number; r: number };
}

export function volcanoPlacement(
  island: Island,
  geom: IslandGeometry,
  radius: number
): VolcanoPlacement {
  const theta = 0; // local +X = volcano half
  const f = geom.footprintAt(theta);
  const rFrac = 0.27; // inboard so the wide base still clears the rim quest_port
  const x = Math.cos(theta) * f * rFrac;
  const z = Math.sin(theta) * f * rFrac;
  const y = geom.capHeightAt(x, z);
  const base = Math.max(3.2, radius * 0.38); // wide, prominent footprint
  const camps: { x: number; z: number }[] = [];
  for (let i = 0; i < 3; i++) {
    const a = Math.PI + (i - 1) * 0.55; // foot of the cone, toward the center
    const cr = base * 1.4;
    camps.push({ x: x + Math.cos(a) * cr, z: z + Math.sin(a) * cr });
  }
  return {
    x,
    z,
    y,
    base,
    height: base * 1.25, // gentle realistic slope on the wide base
    craterR: base * 0.2, // small summit crater
    camps,
    keepOut: { x, z, r: base * 1.3 },
  };
}

/** Crater depth as a fraction of total height (renderer + builder share it). */
export const CRATER_DEPTH_FRAC = 0.18;

/**
 * A rugged volcanic cone — surface of revolution displaced by noise so it reads
 * as a real mountain (ridges, gullies, strata) rather than a smooth frustum.
 * The top dips into a concave crater bowl. Vertex-colored basalt → ash → ember
 * rock; meant for a flat-shaded toon material so facets catch the light.
 * Built at the origin: base ring at y=0, crater rim at y=height.
 */
export function buildVolcanoGeometry(
  seed: number,
  base: number,
  height: number,
  craterR: number
): BufferGeometry {
  const A = 56;
  const SLOPE = 13;
  const CRATER = 4;
  const noise = makeNoise2D(seed ^ 0x5ca1e);
  const rng = mulberry32(seed);
  const offA = rng() * 10;
  const offB = rng() * 10;
  const craterDepth = height * CRATER_DEPTH_FRAC;
  const floorR = craterR * 0.4;

  const basalt = new Color("#241c17");
  const ash = new Color("#4a3d33");
  const warm = new Color("#5a2a18");
  const ember = new Color("#8a2e12");
  const tmp = new Color();
  const tmp2 = new Color();

  // big lobes/gullies (low freq) + rocky micro detail (high freq)
  const ridge = (ang: number): number =>
    fbm2(noise, Math.cos(ang) * 1.6 + offA, Math.sin(ang) * 1.6 - offB, 3);
  const micro = (ang: number, u: number): number =>
    fbm2(noise, Math.cos(ang) * 5 + u * 3, Math.sin(ang) * 5 - u * 2, 3);

  interface V {
    x: number;
    y: number;
    z: number;
    r: number;
    g: number;
    b: number;
  }
  const rings: V[][] = [];

  for (let i = 0; i <= SLOPE; i++) {
    const u = i / SLOPE;
    const ring: V[] = [];
    for (let a = 0; a < A; a++) {
      const ang = (a / A) * Math.PI * 2;
      // exponent < 1: radius drops fastest near the base then eases toward the
      // summit → flared foot, concave slopes (a real mountain, not a vase)
      const rprof = lerp(base, craterR, Math.pow(u, 0.82));
      const rg = ridge(ang) * (1 - u * 0.35);
      const mc = micro(ang, u);
      const r = rprof * (1 + 0.15 * rg) + base * 0.045 * mc * (1 - u * 0.5);
      const y = height * Math.pow(u, 1.05) + base * 0.035 * mc;
      const bandN = fbm2(noise, ang * 2 + 11, u * 6 - 4, 2) * 0.5 + 0.5;
      tmp.copy(basalt).lerp(ash, bandN * 0.7);
      tmp.multiplyScalar(0.9 + Math.sin(y * 1.6 + rg * 3) * 0.07); // strata
      // only a faint scorch right at the summit rim, not the whole upper cone
      if (u > 0.85) tmp.lerp(tmp2.copy(warm), smoothstep(0.85, 1, u) * 0.35);
      tmp.multiplyScalar(clamp(1 + rg * 0.18, 0.7, 1.15)); // gully AO
      ring.push({ x: Math.cos(ang) * r, y, z: Math.sin(ang) * r, r: tmp.r, g: tmp.g, b: tmp.b });
    }
    rings.push(ring);
  }

  for (let i = 1; i <= CRATER; i++) {
    const v = i / CRATER;
    const ring: V[] = [];
    for (let a = 0; a < A; a++) {
      const ang = (a / A) * Math.PI * 2;
      const r = lerp(craterR, floorR, smoothstep(0, 1, v)) * (1 + 0.06 * ridge(ang) * (1 - v));
      const y = height - craterDepth * Math.pow(v, 0.8);
      // dark rock walls; only the deepest floor catches the molten glow
      tmp.copy(basalt).lerp(ember, v * v * 0.85);
      tmp.multiplyScalar(0.8 + micro(ang, v) * 0.1);
      ring.push({ x: Math.cos(ang) * r, y, z: Math.sin(ang) * r, r: tmp.r, g: tmp.g, b: tmp.b });
    }
    rings.push(ring);
  }

  const flat: V[] = rings.flat();
  flat.push({ x: 0, y: height - craterDepth, z: 0, r: ember.r, g: ember.g, b: ember.b });
  const centerIdx = flat.length - 1;

  const positions = new Float32Array(flat.length * 3);
  const colors = new Float32Array(flat.length * 3);
  flat.forEach((vx, i) => {
    positions[i * 3] = vx.x;
    positions[i * 3 + 1] = vx.y;
    positions[i * 3 + 2] = vx.z;
    colors[i * 3] = vx.r;
    colors[i * 3 + 1] = vx.g;
    colors[i * 3 + 2] = vx.b;
  });

  const idx: number[] = [];
  const ringCount = rings.length;
  for (let row = 0; row < ringCount - 1; row++) {
    for (let a = 0; a < A; a++) {
      const a1 = (a + 1) % A;
      const i0 = row * A + a;
      const i1 = row * A + a1;
      const i2 = (row + 1) * A + a;
      const i3 = (row + 1) * A + a1;
      idx.push(i0, i2, i1, i1, i2, i3);
    }
  }
  const last = (ringCount - 1) * A;
  for (let a = 0; a < A; a++) {
    const a1 = (a + 1) % A;
    idx.push(last + a, centerIdx, last + a1);
  }

  const g = new BufferGeometry();
  g.setAttribute("position", new BufferAttribute(positions, 3));
  g.setAttribute("color", new BufferAttribute(colors, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/**
 * Glacier river — a winding ice-blue ribbon laid on the cap (local −X glacier
 * half) that runs out to the rim, where a waterfall takes over. Returns the
 * ribbon geometry plus the rim lip + outward direction for the Waterfall.
 */
/** Azimuth of the glacier river at path fraction u (0 inner → 1 rim). */
export function glacierRiverTheta(u: number): number {
  return Math.PI - 0.5 + 0.5 * u + Math.sin(u * Math.PI * 1.6) * 0.14;
}
/** Radial fraction of the glacier river at path fraction u. */
export function glacierRiverRFrac(u: number): number {
  return 0.1 + 0.9 * u;
}
/** Path fraction where the arc gate straddles the river, near the rim. */
export const GATE_RIVER_U = 0.84;

export function buildGlacierRiver(
  geom: IslandGeometry,
  radius: number
): { geometry: BufferGeometry; lip: Vector3; dir: Vector3 } {
  const M = 18;
  const ice = new Color("#7fc6e8");
  const deep = new Color("#3f8fc4");
  const foam = new Color("#eaf7ff");
  const tmp = new Color();

  const pts: Vector3[] = [];
  for (let i = 0; i <= M; i++) {
    const u = i / M;
    const theta = glacierRiverTheta(u);
    const rFrac = glacierRiverRFrac(u);
    const f = geom.footprintAt(theta);
    const cx = Math.cos(theta) * f * rFrac;
    const cz = Math.sin(theta) * f * rFrac;
    pts.push(new Vector3(cx, geom.capHeightAt(cx, cz) + 0.06, cz));
  }

  const positions: number[] = [];
  const colors: number[] = [];
  const uvs: number[] = [];
  const idx: number[] = [];
  for (let i = 0; i <= M; i++) {
    const u = i / M;
    const c = pts[i];
    const prev = pts[Math.max(0, i - 1)];
    const next = pts[Math.min(M, i + 1)];
    const tx = next.x - prev.x;
    const tz = next.z - prev.z;
    const tl = Math.hypot(tx, tz) || 1;
    const px = -tz / tl;
    const pz = tx / tl;
    const w = radius * 0.05 * (0.7 + 0.7 * u); // widen toward the falls
    tmp.copy(deep).lerp(ice, 0.55 + 0.25 * u);
    tmp.lerp(foam, smoothstep(0.7, 1, u) * 0.5);
    for (let s = 0; s < 2; s++) {
      const sign = s === 0 ? -1 : 1;
      positions.push(c.x + px * w * sign, c.y, c.z + pz * w * sign);
      colors.push(tmp.r, tmp.g, tmp.b);
      uvs.push(s, u);
    }
    if (i < M) {
      const a = i * 2;
      idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
    }
  }

  const g = new BufferGeometry();
  g.setAttribute("position", new BufferAttribute(new Float32Array(positions), 3));
  g.setAttribute("color", new BufferAttribute(new Float32Array(colors), 3));
  g.setAttribute("uv", new BufferAttribute(new Float32Array(uvs), 2));
  g.setIndex(idx);
  g.computeVertexNormals();

  const finalTheta = glacierRiverTheta(1);
  return {
    geometry: g,
    lip: pts[M].clone(),
    dir: new Vector3(Math.cos(finalTheta), 0, Math.sin(finalTheta)),
  };
}

/**
 * A small A-frame ridge tent (triangular prism). Vertex-colored canvas: lit
 * roof, shaded gable ends, darker groundsheet — flat-shaded for a crisp,
 * realistic camp silhouette. Unit-ish; the renderer scales/places it.
 */
export function buildTentGeometry(): BufferGeometry {
  const W = 0.5;
  const H = 0.85;
  const L = 0.7;
  const roof = new Color("#d8c4a2");
  const gable = new Color("#b39a78");
  const ground = new Color("#8f7757");

  const aF = [0, H, L];
  const blF = [-W, 0, L];
  const brF = [W, 0, L];
  const aB = [0, H, -L];
  const blB = [-W, 0, -L];
  const brB = [W, 0, -L];

  const pos: number[] = [];
  const col: number[] = [];
  const push = (p: number[], c: Color): void => {
    pos.push(p[0], p[1], p[2]);
    col.push(c.r, c.g, c.b);
  };
  const tri = (p0: number[], p1: number[], p2: number[], c: Color): void => {
    push(p0, c);
    push(p1, c);
    push(p2, c);
  };
  const quad = (p0: number[], p1: number[], p2: number[], p3: number[], c: Color): void => {
    tri(p0, p1, p2, c);
    tri(p0, p2, p3, c);
  };

  quad(blF, aF, aB, blB, roof); // left roof
  quad(aF, brF, brB, aB, roof); // right roof
  tri(blF, brF, aF, gable); // front gable (door side)
  tri(blB, aB, brB, gable); // back gable
  quad(blF, blB, brB, brF, ground); // groundsheet

  const g = new BufferGeometry();
  g.setAttribute("position", new BufferAttribute(new Float32Array(pos), 3));
  g.setAttribute("color", new BufferAttribute(new Float32Array(col), 3));
  g.computeVertexNormals();
  return g;
}
