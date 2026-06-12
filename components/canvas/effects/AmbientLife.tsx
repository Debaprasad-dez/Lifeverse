"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import {
  BoxGeometry,
  CapsuleGeometry,
  Color,
  ConeGeometry,
  InstancedMesh,
  Matrix4,
  MeshBasicMaterial,
  Quaternion,
  SphereGeometry,
  Vector3,
} from "three";
import type { WorldState } from "@/engine/schema/world";
import type { CoreKingdomId } from "@/engine/schema/world";
import { islandAnalytics, trafficRoutes } from "@/engine/resolver/analytics";
import { KINGDOM_LAYOUTS } from "@/engine/resolver/layout";
import { SLOT_MAPS } from "@/engine/resolver/slots";
import { slotLocalXZ } from "@/engine/resolver/resolve";
import { scatterOnCap } from "@/engine/generation/scatter";
import { getToonMaterial } from "@/engine/materials/toon";
import { mulberry32, seedFrom } from "@/lib/noise";
import type { BuiltIsland } from "@/components/canvas/WorldGraph";

const tmpM = new Matrix4();
const tmpQ = new Quaternion();
const tmpV = new Vector3();
const tmpS = new Vector3();
const tmpDir = new Vector3();
const UP = new Vector3(0, 1, 0);

// geometries pre-oriented so +X (ships) / +Z (birds) is "forward"
const GEO = {
  hull: new CapsuleGeometry(0.45, 1.2, 4, 8).rotateZ(Math.PI / 2),
  balloon: new SphereGeometry(0.85, 10, 8),
  bird: new ConeGeometry(0.16, 0.55, 4).rotateX(Math.PI / 2),
  firefly: new SphereGeometry(0.06, 5, 4),
  villager: new CapsuleGeometry(0.1, 0.17, 3, 6),
  book: new BoxGeometry(0.34, 0.06, 0.26),
  lantern: new BoxGeometry(0.16, 0.22, 0.16),
};

const fireflyMat = new MeshBasicMaterial({ color: new Color(1.6, 1.3, 0.5), toneMapped: false });
const lanternMat = new MeshBasicMaterial({ color: new Color(1.7, 1.1, 0.55), toneMapped: false });
const bookGlowMat = new MeshBasicMaterial({ toneMapped: false });

interface ShipSpec {
  from: Vector3;
  to: Vector3;
  mid: Vector3;
  phase: number;
  speed: number;
  color: string;
}

interface AmbientLifeProps {
  state: WorldState;
  built: BuiltIsland[];
}

/**
 * The world breathes: airships run trade routes (frequency = trafficFlow),
 * birds circle lively islands, villagers walk the caps (population),
 * fireflies spark at dusk, books orbit the Knowledge Library, lanterns
 * rise over Relationships. All instanced; per-frame work is matrix math.
 */
export default function AmbientLife({ state, built }: AmbientLifeProps) {
  const shipHullRef = useRef<InstancedMesh>(null);
  const shipBalloonRef = useRef<InstancedMesh>(null);
  const birdRef = useRef<InstancedMesh>(null);
  const fireflyRef = useRef<InstancedMesh>(null);
  const villagerRef = useRef<InstancedMesh>(null);
  const bookRef = useRef<InstancedMesh>(null);
  const lanternRef = useRef<InstancedMesh>(null);

  const specs = useMemo(() => {
    const byId = new Map(built.map((b) => [b.island.id, b]));
    const rng = mulberry32(seedFrom(state.worldSeed, "ambient"));

    // ---- airships ----
    const ships: ShipSpec[] = [];
    for (const route of trafficRoutes(state)) {
      const a = byId.get(route.fromIslandId as CoreKingdomId);
      const b = byId.get(route.toIslandId as CoreKingdomId);
      if (!a || !b) continue;
      const from = new Vector3(...a.island.position).add(new Vector3(0, 7, 0));
      const to = new Vector3(...b.island.position).add(new Vector3(0, 7, 0));
      const mid = from
        .clone()
        .add(to)
        .multiplyScalar(0.5)
        .add(new Vector3(0, 6 + from.distanceTo(to) * 0.08, 0));
      const accent =
        KINGDOM_LAYOUTS[route.fromIslandId as CoreKingdomId]?.accent ?? "#d8d2c4";
      for (let i = 0; i < route.ships; i++) {
        ships.push({ from, to, mid, phase: rng(), speed: route.speed * 0.035, color: accent });
      }
    }

    // ---- birds: circle the three liveliest islands ----
    const lively = built
      .filter((b) => !b.island.locked)
      .sort((x, y) => y.island.vitality - x.island.vitality)
      .slice(0, 3);
    const birds = lively.flatMap((b) =>
      Array.from({ length: 6 }, () => ({
        center: new Vector3(...b.island.position),
        radius: 13 + rng() * 7,
        speed: (0.12 + rng() * 0.14) * (rng() < 0.5 ? 1 : -1),
        phase: rng() * Math.PI * 2,
        y: 6 + rng() * 5,
        bob: rng() * Math.PI * 2,
      }))
    );

    // ---- fireflies ----
    const fireflies: { base: Vector3; phase: number }[] = [];
    for (const b of built) {
      if (b.island.locked) continue;
      const count = islandAnalytics(b.island).fireflyCount;
      if (count === 0) continue;
      const pts = scatterOnCap(seedFrom(state.worldSeed, b.island.id) ^ 0xff7, b.geom, {
        count,
        minDistance: 1.5,
        radialMax: 0.8,
        maxSlope: 1.4,
      });
      for (const p of pts) {
        fireflies.push({
          base: new Vector3(...b.island.position).add(new Vector3(p.x, p.y + 0.9, p.z)),
          phase: rng() * Math.PI * 2,
        });
      }
    }

    // ---- villagers walking circular cap paths ----
    const villagers: { path: Vector3[]; phase: number; speed: number; color: string }[] = [];
    for (const b of built) {
      if (b.island.locked || !b.layout) continue;
      const count = islandAnalytics(b.island).villagerCount;
      const pal = b.layout.palette;
      const palette = [pal.roof, pal.bodyB, pal.trim, b.layout.accent];
      for (let i = 0; i < count; i++) {
        const rFrac = 0.3 + rng() * 0.35;
        const points: Vector3[] = [];
        for (let k = 0; k < 24; k++) {
          const th = (k / 24) * Math.PI * 2;
          const f = b.geom.footprintAt(th) * rFrac;
          const x = Math.cos(th) * f;
          const z = Math.sin(th) * f;
          points.push(
            new Vector3(...b.island.position).add(
              new Vector3(x, b.geom.capHeightAt(x, z) + 0.18, z)
            )
          );
        }
        villagers.push({
          path: points,
          phase: rng(),
          speed: (0.008 + rng() * 0.01) * (rng() < 0.5 ? 1 : -1),
          color: palette[Math.floor(rng() * palette.length)],
        });
      }
    }

    // ---- flying books over the Knowledge Library ----
    const books: { center: Vector3; r: number; speed: number; phase: number; color: string }[] = [];
    const learning = byId.get("learning");
    if (learning && !learning.island.locked) {
      const lib = learning.island.structures.find((s) => s.type === "knowledge_library");
      if (lib) {
        const slots = SLOT_MAPS.learning;
        const slot = slots[lib.slot % slots.length];
        const { x, z } = slotLocalXZ(learning.geom, slot);
        const center = new Vector3(...learning.island.position).add(
          new Vector3(x, learning.geom.capHeightAt(x, z) + 2.6, z)
        );
        const pal = KINGDOM_LAYOUTS.learning.palette;
        const colors = [pal.roof, pal.trim, "#a83a3a", "#3a6ea8"];
        for (let i = 0; i < 9; i++) {
          books.push({
            center,
            r: 1.3 + rng() * 1.5,
            speed: 0.35 + rng() * 0.4,
            phase: rng() * Math.PI * 2,
            color: colors[i % colors.length],
          });
        }
      }
    }

    // ---- floating lanterns over Relationships ----
    const lanterns: { x: number; z: number; baseY: number; phase: number }[] = [];
    const rel = byId.get("relationships");
    if (rel && !rel.island.locked) {
      for (let i = 0; i < 7; i++) {
        const th = rng() * Math.PI * 2;
        const f = rel.geom.footprintAt(th) * (0.2 + rng() * 0.5);
        lanterns.push({
          x: rel.island.position[0] + Math.cos(th) * f,
          z: rel.island.position[2] + Math.sin(th) * f,
          baseY: rel.island.position[1] + 2.5,
          phase: rng() * 9,
        });
      }
    }

    return { ships, birds, fireflies, villagers, books, lanterns };
  }, [state, built]);

  useFrame((s) => {
    const t = s.clock.elapsedTime;

    const hull = shipHullRef.current;
    const balloon = shipBalloonRef.current;
    if (hull && balloon) {
      specs.ships.forEach((ship, i) => {
        const k = (ship.phase + t * ship.speed) % 1;
        // quadratic bezier + facing derivative
        const a = tmpV.copy(ship.from).lerp(ship.mid, k);
        const b = new Vector3().copy(ship.mid).lerp(ship.to, k);
        const pos = a.clone().lerp(b, k);
        tmpDir.copy(b).sub(a).setY(tmpDir.y * 0.4).normalize();
        tmpQ.setFromUnitVectors(new Vector3(1, 0, 0), tmpDir);
        tmpM.compose(pos, tmpQ, tmpS.set(1, 1, 1));
        hull.setMatrixAt(i, tmpM);
        tmpM.compose(pos.add(tmpV.set(0, 1.5, 0)), tmpQ, tmpS.set(1.4, 1.05, 1));
        balloon.setMatrixAt(i, tmpM);
      });
      hull.instanceMatrix.needsUpdate = true;
      balloon.instanceMatrix.needsUpdate = true;
    }

    const bird = birdRef.current;
    if (bird) {
      specs.birds.forEach((bd, i) => {
        const a = bd.phase + t * bd.speed;
        const x = bd.center.x + Math.cos(a) * bd.radius;
        const z = bd.center.z + Math.sin(a) * bd.radius;
        const y = bd.center.y + bd.y + Math.sin(t * 2 + bd.bob) * 0.6;
        // tangent direction
        const sgn = Math.sign(bd.speed);
        tmpDir.set(-Math.sin(a) * sgn, 0, Math.cos(a) * sgn).normalize();
        tmpQ.setFromUnitVectors(new Vector3(0, 0, 1), tmpDir);
        const flap = 1 + Math.sin(t * 9 + bd.bob) * 0.25;
        tmpM.compose(tmpV.set(x, y, z), tmpQ, tmpS.set(flap, 0.7, 1));
        bird.setMatrixAt(i, tmpM);
      });
      bird.instanceMatrix.needsUpdate = true;
    }

    const fly = fireflyRef.current;
    if (fly) {
      specs.fireflies.forEach((f, i) => {
        const pulse = 0.55 + 0.45 * Math.sin(t * 2.6 + f.phase * 3.1);
        tmpV.copy(f.base);
        tmpV.y += Math.sin(t * 0.9 + f.phase) * 0.35;
        tmpV.x += Math.sin(t * 0.6 + f.phase * 2) * 0.3;
        tmpM.compose(tmpV, tmpQ.identity(), tmpS.setScalar(0.6 + pulse));
        fly.setMatrixAt(i, tmpM);
      });
      fly.instanceMatrix.needsUpdate = true;
    }

    const vil = villagerRef.current;
    if (vil) {
      specs.villagers.forEach((v, i) => {
        const k = ((v.phase + t * v.speed) % 1 + 1) % 1;
        const seg = k * v.path.length;
        const i0 = Math.floor(seg) % v.path.length;
        const i1 = (i0 + 1) % v.path.length;
        const f = seg - Math.floor(seg);
        tmpV.copy(v.path[i0]).lerp(v.path[i1], f);
        tmpDir.copy(v.path[i1]).sub(v.path[i0]).setY(0).normalize();
        tmpQ.setFromUnitVectors(new Vector3(0, 0, 1), tmpDir);
        const hop = 1 + Math.abs(Math.sin(t * 7 + i)) * 0.08;
        tmpM.compose(tmpV, tmpQ, tmpS.set(1, hop, 1));
        vil.setMatrixAt(i, tmpM);
      });
      vil.instanceMatrix.needsUpdate = true;
    }

    const book = bookRef.current;
    if (book) {
      specs.books.forEach((bk, i) => {
        const a = bk.phase + t * bk.speed;
        tmpV.set(
          bk.center.x + Math.cos(a) * bk.r,
          bk.center.y + Math.sin(t * 1.4 + bk.phase * 2) * 0.5 + (i % 3) * 0.4,
          bk.center.z + Math.sin(a) * bk.r
        );
        tmpQ.setFromAxisAngle(UP, -a);
        const flap = 1 + Math.sin(t * 6 + bk.phase) * 0.35;
        tmpM.compose(tmpV, tmpQ, tmpS.set(1, 1, flap));
        book.setMatrixAt(i, tmpM);
      });
      book.instanceMatrix.needsUpdate = true;
    }

    const lan = lanternRef.current;
    if (lan) {
      specs.lanterns.forEach((l, i) => {
        const cycle = (t * 0.35 + l.phase) % 9;
        const fade = Math.min(1, Math.min(cycle, 9 - cycle) * 0.8);
        tmpV.set(
          l.x + Math.sin(t * 0.4 + l.phase) * 0.6,
          l.baseY + cycle * 1.1,
          l.z + Math.cos(t * 0.33 + l.phase) * 0.5
        );
        tmpM.compose(tmpV, tmpQ.identity(), tmpS.setScalar(Math.max(0.001, fade)));
        lan.setMatrixAt(i, tmpM);
      });
      lan.instanceMatrix.needsUpdate = true;
    }
  });

  // color setup once via InstancedPool-style layout effect is overkill here;
  // ships/villagers/books set colors below through attach callbacks
  const setColors = (
    mesh: InstancedMesh | null,
    colors: string[] | undefined
  ): void => {
    if (!mesh || !colors) return;
    const c = new Color();
    colors.forEach((col, i) => mesh.setColorAt(i, c.set(col)));
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  };

  return (
    <group>
      {specs.ships.length > 0 && (
        <>
          <instancedMesh
            ref={shipHullRef}
            args={[GEO.hull, getToonMaterial("ship-hull", { color: "#e2dccb" }), specs.ships.length]}
            frustumCulled={false}
          />
          <instancedMesh
            ref={(m) => {
              shipBalloonRef.current = m;
              setColors(m, specs.ships.map((s) => s.color));
            }}
            args={[GEO.balloon, getToonMaterial("ship-balloon", { rimStrength: 0.4 }), specs.ships.length]}
            frustumCulled={false}
          />
        </>
      )}
      {specs.birds.length > 0 && (
        <instancedMesh
          ref={birdRef}
          args={[GEO.bird, getToonMaterial("bird", { color: "#46566a" }), specs.birds.length]}
          frustumCulled={false}
        />
      )}
      {specs.fireflies.length > 0 && (
        <instancedMesh
          ref={fireflyRef}
          args={[GEO.firefly, fireflyMat, specs.fireflies.length]}
          frustumCulled={false}
        />
      )}
      {specs.villagers.length > 0 && (
        <instancedMesh
          ref={(m) => {
            villagerRef.current = m;
            setColors(m, specs.villagers.map((v) => v.color));
          }}
          args={[GEO.villager, getToonMaterial("villager", { rimStrength: 0.4 }), specs.villagers.length]}
          frustumCulled={false}
        />
      )}
      {specs.books.length > 0 && (
        <instancedMesh
          ref={(m) => {
            bookRef.current = m;
            setColors(m, specs.books.map((b) => b.color));
          }}
          args={[GEO.book, bookGlowMat, specs.books.length]}
          frustumCulled={false}
        />
      )}
      {specs.lanterns.length > 0 && (
        <instancedMesh
          ref={lanternRef}
          args={[GEO.lantern, lanternMat, specs.lanterns.length]}
          frustumCulled={false}
        />
      )}
    </group>
  );
}
