"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import {
  AdditiveBlending,
  Color,
  InstancedMesh,
  Matrix4,
  MeshBasicMaterial,
  Quaternion,
  RingGeometry,
  SphereGeometry,
  Vector3,
} from "three";
import { on } from "@/lib/events";
import type { StructureAnchor } from "@/engine/resolver/resolve";
import type { BuiltIsland } from "@/components/canvas/WorldGraph";
import { playChime } from "@/lib/sound";
import { PALETTE } from "@/lib/constants";

const MAX_BURSTS = 5;
const SPARKS_PER_BURST = 16;
const BURST_SECONDS = 1.5;

const sparkGeo = new SphereGeometry(0.09, 5, 4);
const ringGeo = new RingGeometry(0.9, 1.08, 36);
const sparkMat = new MeshBasicMaterial({
  color: new Color(1.8, 1.4, 0.6),
  toneMapped: false,
  transparent: true,
  depthWrite: false,
});

interface Burst {
  pos: Vector3;
  t0: number;
  radius: number;
  active: boolean;
}

const tmpM = new Matrix4();
const tmpQ = new Quaternion();
const tmpV = new Vector3();
const tmpS = new Vector3();

interface GrowthFXProps {
  anchors: StructureAnchor[];
  built: BuiltIsland[];
}

/**
 * Growth Director's visible hand: every applied delta fires a sparkle
 * fountain + expanding gold ring at its world location. Geometry itself
 * updates through the resolver — this layer only celebrates it.
 */
export default function GrowthFX({ anchors, built }: GrowthFXProps) {
  const sparkRef = useRef<InstancedMesh>(null);
  const ringRefs = useRef<(InstancedMesh | null)[]>([]);
  const bursts = useRef<Burst[]>(
    Array.from({ length: MAX_BURSTS }, () => ({
      pos: new Vector3(),
      t0: 0,
      radius: 1.5,
      active: false,
    }))
  );

  const ringMats = useMemo(
    () =>
      Array.from({ length: MAX_BURSTS }, () => {
        const m = new MeshBasicMaterial({
          color: new Color(PALETTE.gold).multiplyScalar(1.6),
          toneMapped: false,
          transparent: true,
          opacity: 0,
          blending: AdditiveBlending,
          depthWrite: false,
          side: 2,
        });
        return m;
      }),
    []
  );

  useEffect(() => {
    // burst spawn — at the structure anchor, else at the island center
    const recent = new Map<string, number>(); // dedupe key → time
    return on("delta:applied", ({ delta }) => {
      let pos: Vector3 | null = null;
      let radius = 1.6;
      let key = "";

      if ("structureId" in delta && delta.type === "structure_grown") {
        const a = anchors.find((x) => x.structureId === delta.structureId);
        if (a) {
          pos = new Vector3(...a.position);
          radius = a.radius;
          key = delta.structureId;
        }
      }
      // landmarks carry their island nested — celebrate at the island center
      // (the landmark mesh itself only exists after the resolver re-runs)
      if (!pos && (delta.type === "monument_erected" || delta.type === "memory_added")) {
        const islandId =
          delta.type === "monument_erected" ? delta.monument.islandId : delta.memory.islandId;
        const b = built.find((x) => x.island.id === islandId);
        if (b) {
          pos = new Vector3(...b.island.position).add(new Vector3(0, 2.5, 0));
          radius = 5;
          key = delta.type === "monument_erected" ? delta.monument.id : delta.memory.id;
        }
      }
      if (!pos && "islandId" in delta && delta.islandId) {
        const b = built.find((x) => x.island.id === delta.islandId);
        if (b) {
          pos = new Vector3(...b.island.position).add(new Vector3(0, 2, 0));
          radius = 4;
          key = delta.islandId;
        }
      }
      if (!pos) return;

      // batch: identical target within 300ms → one celebration
      const now = performance.now();
      const last = recent.get(key);
      if (last && now - last < 300) return;
      recent.set(key, now);

      const slot = bursts.current.find((b) => !b.active) ?? bursts.current[0];
      slot.pos.copy(pos);
      slot.t0 = now / 1000;
      slot.radius = radius;
      slot.active = true;
      playChime();
    });
  }, [anchors, built]);

  useFrame(() => {
    const spark = sparkRef.current;
    if (!spark) return;
    const now = performance.now() / 1000;

    bursts.current.forEach((burst, b) => {
      const k = burst.active ? (now - burst.t0) / BURST_SECONDS : 1;
      if (k >= 1) burst.active = false;

      for (let i = 0; i < SPARKS_PER_BURST; i++) {
        const idx = b * SPARKS_PER_BURST + i;
        if (!burst.active) {
          tmpM.compose(tmpV.set(0, -9999, 0), tmpQ.identity(), tmpS.setScalar(0.0001));
          spark.setMatrixAt(idx, tmpM);
          continue;
        }
        const a = (i / SPARKS_PER_BURST) * Math.PI * 2 + b * 1.7;
        const out = burst.radius * (0.3 + 0.9 * k) * (0.7 + (i % 3) * 0.2);
        const up = 2.6 * k - 2.2 * k * k + (i % 4) * 0.18;
        tmpV.set(
          burst.pos.x + Math.cos(a) * out,
          burst.pos.y + up * 2.2,
          burst.pos.z + Math.sin(a) * out
        );
        tmpM.compose(tmpV, tmpQ.identity(), tmpS.setScalar((1 - k) * 1.1));
        spark.setMatrixAt(idx, tmpM);
      }

      const ring = ringRefs.current[b];
      if (ring) {
        if (!burst.active) {
          ring.visible = false;
        } else {
          ring.visible = true;
          ring.position.set(burst.pos.x, burst.pos.y + 0.15, burst.pos.z);
          ring.scale.setScalar(burst.radius * (0.4 + k * 2.4));
          ringMats[b].opacity = (1 - k) * 0.75;
        }
      }
    });
    spark.instanceMatrix.needsUpdate = true;
  });

  return (
    <group>
      <instancedMesh
        ref={sparkRef}
        args={[sparkGeo, sparkMat, MAX_BURSTS * SPARKS_PER_BURST]}
        frustumCulled={false}
      />
      {ringMats.map((mat, i) => (
        <mesh
          key={i}
          ref={(m) => {
            ringRefs.current[i] = m as InstancedMesh | null;
          }}
          geometry={ringGeo}
          material={mat}
          rotation={[-Math.PI / 2, 0, 0]}
          visible={false}
        />
      ))}
    </group>
  );
}
