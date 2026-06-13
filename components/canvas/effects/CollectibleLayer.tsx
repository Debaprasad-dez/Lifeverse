"use client";

import { useMemo, useRef, useState } from "react";
import { useFrame, type ThreeEvent } from "@react-three/fiber";
import {
  Color,
  ConeGeometry,
  Group,
  IcosahedronGeometry,
  MeshBasicMaterial,
  OctahedronGeometry,
  TorusGeometry,
} from "three";
import type { WorldState } from "@/engine/schema/world";
import { resolveCollectibleSpawns, type CollectibleSpawn } from "@/engine/collectibles";
import type { BuiltIsland } from "@/components/canvas/WorldGraph";
import { CORE_KINGDOM_IDS, type CoreKingdomId } from "@/engine/schema/world";
import { useWorldStore } from "@/stores/worldStore";
import { useCompanionStore } from "@/stores/companionStore";
import { playChime } from "@/lib/sound";

const GEO = {
  creature: new IcosahedronGeometry(0.6, 0),
  artifact: new OctahedronGeometry(0.6, 0),
  relic: new TorusGeometry(0.5, 0.18, 8, 18),
  isle: new ConeGeometry(0.7, 0.9, 6),
};

interface CollectibleLayerProps {
  state: WorldState;
  built: BuiltIsland[];
}

/**
 * Findable collectibles drifting in the world — glowing, bobbing, orbiting.
 * Click to collect: fires creature_unlocked, a chime, and a quick pop. Found
 * ones vanish (they live on in the Collection journal). Few in number, so a
 * small mesh each (not instanced) keeps the picking simple.
 */
export default function CollectibleLayer({ state, built }: CollectibleLayerProps) {
  const [hovered, setHovered] = useState<string | null>(null);
  const [collecting, setCollecting] = useState<Record<string, number>>({});
  const groupRefs = useRef<Record<string, Group | null>>({});

  const spawns = useMemo(() => {
    const refs = built
      .filter((b) => !b.island.locked && CORE_KINGDOM_IDS.includes(b.island.id as CoreKingdomId))
      .map((b) => ({
        id: b.island.id,
        position: b.island.position,
        capTop: b.island.position[1] + b.geom.capHeightAt(0, 0),
      }));
    return resolveCollectibleSpawns(state.worldSeed, state.collectibles, refs);
  }, [state.worldSeed, state.collectibles, built]);

  const mats = useMemo(() => {
    const m: Record<string, { body: MeshBasicMaterial; glow: MeshBasicMaterial }> = {};
    for (const s of spawns) {
      m[s.id] = {
        body: new MeshBasicMaterial({ color: new Color(s.visual.body), toneMapped: false }),
        glow: new MeshBasicMaterial({
          color: new Color(s.visual.glow).multiplyScalar(1.6),
          toneMapped: false,
          transparent: true,
          opacity: 0.4,
        }),
      };
    }
    return m;
  }, [spawns]);

  useFrame((st) => {
    const t = st.clock.elapsedTime;
    for (const s of spawns) {
      const g = groupRefs.current[s.id];
      if (!g) continue;
      const a = s.phase + t * s.orbitSpeed;
      const pop = collecting[s.id];
      const grow = pop ? 1 + (t - pop) * 6 : 1;
      const fade = pop ? Math.max(0, 1 - (t - pop) * 2.2) : 1;
      g.position.set(
        s.anchor[0] + Math.cos(a) * s.orbitR,
        s.anchor[1] + s.height + Math.sin(t * 0.9 + s.phase) * s.bobAmp,
        s.anchor[2] + Math.sin(a) * s.orbitR
      );
      g.rotation.y = t * 0.6 + s.phase;
      g.rotation.x = s.visual.shape === "relic" ? Math.PI / 2.4 : Math.sin(t + s.phase) * 0.2;
      const base = s.visual.scale * (hovered === s.id ? 1.35 : 1) * grow;
      g.scale.setScalar(base * fade);
      g.visible = fade > 0.01;
    }
  });

  const collect = (s: CollectibleSpawn) => (e: ThreeEvent<MouseEvent>): void => {
    e.stopPropagation();
    if (collecting[s.id]) return;
    playChime();
    setCollecting((c) => ({ ...c, [s.id]: performance.now() / 1000 }));
    setHovered(null);
    document.body.style.cursor = "";
    // let the pop play, then commit the state change
    setTimeout(() => {
      useWorldStore.getState().applyDeltas([
        {
          type: "creature_unlocked",
          collectibleId: s.id,
          foundDate: new Date().toISOString(),
        },
      ]);
      const nm = s.collectible.name;
      useCompanionStore.getState().pushAria(`You found the ${nm}! It joins your collection. ✦`);
    }, 650);
  };

  return (
    <group>
      {spawns.map((s) => (
        <group
          key={s.id}
          ref={(g) => {
            groupRefs.current[s.id] = g;
          }}
          onPointerOver={(e) => {
            e.stopPropagation();
            setHovered(s.id);
            document.body.style.cursor = "pointer";
          }}
          onPointerOut={() => {
            setHovered((h) => (h === s.id ? null : h));
            document.body.style.cursor = "";
          }}
          onClick={collect(s)}
        >
          <mesh geometry={GEO[s.visual.shape]} material={mats[s.id].body} />
          <mesh geometry={GEO[s.visual.shape]} material={mats[s.id].glow} scale={1.6} />
        </group>
      ))}
    </group>
  );
}
