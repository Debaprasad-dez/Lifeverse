"use client";

import { useEffect, useMemo } from "react";
import {
  BoxGeometry,
  Color,
  ConeGeometry,
  CylinderGeometry,
  IcosahedronGeometry,
  SphereGeometry,
  Vector3,
} from "three";
import {
  buildIsland,
  buildStalactites,
  type IslandGeometry,
} from "@/engine/generation/island";
import { scatterOnCap } from "@/engine/generation/scatter";
import type { PrimKind } from "@/engine/generation/structures/kit";
import {
  islandRadius,
  KINGDOM_LAYOUTS,
  type KingdomLayout,
} from "@/engine/resolver/layout";
import { SLOT_MAPS, SIZE_SCALE } from "@/engine/resolver/slots";
import { resolveStructures, slotLocalXZ } from "@/engine/resolver/resolve";
import { gateFrame } from "@/engine/generation/structures/gate";
import { islandAnalytics } from "@/engine/resolver/analytics";
import {
  CORE_KINGDOM_IDS,
  type CoreKingdomId,
  type Island,
  type KingdomId,
  type WorldState,
} from "@/engine/schema/world";
import { getToonMaterial } from "@/engine/materials/toon";
import { PALETTE } from "@/lib/constants";
import { lerp, mulberry32, seedFrom } from "@/lib/noise";
import { useWorldStore } from "@/stores/worldStore";
import InstancedPool, { type PoolInstance } from "@/components/canvas/InstancedPool";
import KingdomIsland from "@/components/canvas/islands/KingdomIsland";
import BridgeLayer from "@/components/canvas/effects/BridgeLayer";
import Waterfall, { type WaterfallStyle } from "@/components/canvas/effects/Waterfall";
import AmbientLife from "@/components/canvas/effects/AmbientLife";
import WeatherLayer from "@/components/canvas/effects/WeatherLayer";
import HoverMarker from "@/components/canvas/HoverMarker";
import ContextualUI from "@/components/canvas/ContextualUI";
import GrowthFX from "@/components/canvas/effects/GrowthFX";
import BeaconLayer from "@/components/canvas/effects/BeaconLayer";
import GateLayer from "@/components/canvas/effects/GateLayer";
import SeasonLayer from "@/components/canvas/effects/SeasonLayer";
import CollectibleLayer from "@/components/canvas/effects/CollectibleLayer";
import GrassField, { type GrassInstance } from "@/components/canvas/effects/GrassField";
import ContactBlobs, { type BlobSpec } from "@/components/canvas/effects/ContactBlobs";
import { useUIStore } from "@/stores/uiStore";
import { useCameraStore } from "@/stores/cameraStore";
import { useGenesisStore } from "@/stores/genesisStore";
import { playChime } from "@/lib/sound";
import type { ThreeEvent } from "@react-three/fiber";
import { MeshBasicMaterial } from "three";

export interface BuiltIsland {
  island: Island;
  geom: IslandGeometry;
  geomMid?: IslandGeometry;
  geomLow?: IslandGeometry;
  layout?: KingdomLayout;
}

interface Archipelago {
  islands: BuiltIsland[];
  geometries: Map<KingdomId, IslandGeometry>;
  stalactites: PoolInstance[];
  trunks: PoolInstance[];
  canopies: PoolInstance[];
  grass: GrassInstance[];
  flowers: PoolInstance[];
  boulders: PoolInstance[];
  shrubs: PoolInstance[];
  blobs: BlobSpec[];
  waterfalls: { lip: Vector3; dir: Vector3; style: WaterfallStyle }[];
}

/** Meadow variety — gold, pink, lilac, white, peach. */
const FLOWER_COLORS = ["#ffd34d", "#ff9ecf", "#c5a3ff", "#fff3f3", "#ffa94d"];

const cA = new Color();
const cB = new Color();
/** Vitality drains color toward dry hay — saturation IS the analytics. */
function vitalityTint(full: string, saturation: number, rng: number): string {
  cA.set(full);
  cB.set("#c4b687");
  cB.lerp(cA, saturation);
  cB.multiplyScalar(0.92 + rng * 0.16);
  return `#${cB.getHexString()}`;
}

function buildArchipelago(state: WorldState): Archipelago {
  const out: Archipelago = {
    islands: [],
    geometries: new Map(),
    stalactites: [],
    trunks: [],
    canopies: [],
    grass: [],
    flowers: [],
    boulders: [],
    shrubs: [],
    blobs: [],
    waterfalls: [],
  };

  for (const island of state.islands) {
    const core = CORE_KINGDOM_IDS.includes(island.id as CoreKingdomId);
    const layout = core ? KINGDOM_LAYOUTS[island.id as CoreKingdomId] : undefined;
    const seed = seedFrom(state.worldSeed, island.id);
    const radius = island.locked ? 7.2 : islandRadius(island);
    const analytics = islandAnalytics(island);

    // dirt paths run to each occupied structure slot
    const islandSlots = core ? SLOT_MAPS[island.id as CoreKingdomId] : [];
    const pathAnchors = island.locked
      ? []
      : island.structures.map((s) => {
          const slot = islandSlots[s.slot % islandSlots.length];
          return { t: slot.t, r: slot.r };
        });

    const baseParams = {
      seed,
      radius,
      capHeight: layout?.capHeight ?? 1.5,
      depth: layout?.depth ?? 10,
      paths: pathAnchors,
    };
    const geom = buildIsland({ ...baseParams, detail: island.locked ? 0.4 : 1 });
    const built: BuiltIsland = { island, geom, layout };
    if (!island.locked) {
      built.geomMid = buildIsland({ ...baseParams, detail: 0.55 });
      built.geomLow = buildIsland({ ...baseParams, detail: 0.3 });
    }
    out.islands.push(built);
    out.geometries.set(island.id, geom);

    const [ix, iy, iz] = island.position;

    for (const st of buildStalactites(seed, geom, island.locked ? 8 : 18)) {
      out.stalactites.push({
        position: [
          ix + st.position.x,
          iy + st.position.y - st.scale.y * 0.5 + 0.3,
          iz + st.position.z,
        ],
        rotation: [Math.PI + st.tiltX, 0, st.tiltZ],
        scale: [st.scale.x, st.scale.y, st.scale.z],
      });
    }

    if (island.locked || !layout) continue;

    // keep flora away from structure slots and the waterfall lip
    const slots = SLOT_MAPS[island.id as CoreKingdomId];
    const avoid = island.structures.map((s) => {
      const slot = slots[s.slot % slots.length];
      const { x, z } = slotLocalXZ(geom, slot);
      return { x, z, r: 2.4 * SIZE_SCALE[slot.size] };
    });
    // keep the arc gate's threshold + approach clear of flora and rocks
    avoid.push(gateFrame(island, geom, radius).keepOut);
    if (layout.hasWaterfall) {
      avoid.push({ x: geom.waterfall.lip.x, z: geom.waterfall.lip.z, r: 3.2 });
      out.waterfalls.push({
        lip: geom.waterfall.lip.clone().add(new Vector3(ix, iy, iz)),
        dir: geom.waterfall.dir.clone(),
        style: layout.waterfallStyle ?? "water",
      });
    }

    const flora = island.ecosystem.flora;
    const sat = analytics.floraSaturation;
    const blobRng = mulberry32(seed ^ 0xb10b);

    const trees = scatterOnCap(seed ^ 0x71ee5, geom, {
      count: Math.round((7 + flora * 20) * layout.treeFactor * analytics.treeCountMul),
      minDistance: 3.0,
      radialMax: 0.85,
      maxSlope: 0.8,
      scaleRange: [1.0, 1.9],
      avoid,
    });
    for (const t of trees) {
      const s = t.scale;
      out.trunks.push({
        position: [ix + t.x, iy + t.y + 0.5 * s - 0.08, iz + t.z],
        rotation: [0, t.rotationY, 0],
        scale: s,
      });
      out.blobs.push({
        position: [ix + t.x, iy + t.y + 0.07, iz + t.z],
        radius: s * 1.7,
      });
      const baseY = iy + t.y + s * 1.5;
      for (let j = 0; j < 3; j++) {
        const a = t.rotationY + j * 2.4 + blobRng() * 0.8;
        const off = j === 0 ? 0 : s * (0.55 + blobRng() * 0.25);
        const bs = s * (j === 0 ? 1.3 : 0.78 + blobRng() * 0.22);
        out.canopies.push({
          position: [
            ix + t.x + Math.cos(a) * off,
            baseY + (j === 0 ? 0.25 * s : s * (0.1 + blobRng() * 0.45)),
            iz + t.z + Math.sin(a) * off,
          ],
          rotation: [0, a, 0],
          scale: [bs * 1.15, bs, bs * 1.15],
          color: vitalityTint(
            blobRng() < 0.5 ? PALETTE.canopyDeep : PALETTE.canopyLight,
            sat,
            blobRng()
          ),
        });
      }
    }

    const grassRng = mulberry32(seed ^ 0x6e55);
    for (const g of scatterOnCap(seed ^ 0x6e55, geom, {
      count: Math.round(110 * flora),
      minDistance: 0.7,
      radialMax: 0.92,
      maxSlope: 1.1,
      scaleRange: [0.8, 1.5],
      avoid,
    })) {
      out.grass.push({
        position: [ix + g.x, iy + g.y + 0.02, iz + g.z],
        rotY: g.rotationY,
        scale: g.scale,
        color: vitalityTint(
          grassRng() < 0.5 ? PALETTE.grassDeep : PALETTE.grassLight,
          sat,
          grassRng()
        ),
      });
    }

    const flowerRng = mulberry32(seed ^ 0xf10e);
    for (const f of scatterOnCap(seed ^ 0xf10e, geom, {
      count: Math.round((6 + flora * 16) * lerp(0.4, 1.2, island.vitality)),
      minDistance: 1.4,
      radialMax: 0.88,
      maxSlope: 0.9,
      scaleRange: [0.8, 1.4],
      avoid,
    })) {
      out.flowers.push({
        position: [ix + f.x, iy + f.y + 0.1, iz + f.z],
        scale: f.scale,
        color: FLOWER_COLORS[Math.floor(flowerRng() * FLOWER_COLORS.length)],
      });
    }

    // ---- weathered boulders: ground the rim, sparse so focus stays on
    // structures. A few wear moss where the meadow is healthy. ----------------
    const rockRng = mulberry32(seed ^ 0xb01de);
    const boulderLocals: { x: number; z: number; r: number }[] = [];
    for (const r of scatterOnCap(seed ^ 0xb01de, geom, {
      count: Math.round(5 + island.level * 0.35),
      minDistance: 3.2,
      radialMin: 0.45,
      radialMax: 0.9,
      maxSlope: 1.5,
      scaleRange: [0.7, 1.7],
      avoid,
    })) {
      const s = r.scale;
      cA.set(PALETTE.rockUnder).lerp(cB.set(PALETTE.cliffWarm), rockRng());
      if (rockRng() < 0.35) cA.lerp(cB.set(PALETTE.grassDeep), 0.4); // mossy
      out.boulders.push({
        position: [ix + r.x, iy + r.y + s * 0.18, iz + r.z],
        rotation: [rockRng() * 0.4 - 0.2, r.rotationY, rockRng() * 0.4 - 0.2],
        scale: [s * (0.9 + rockRng() * 0.4), s * (0.6 + rockRng() * 0.3), s * (0.9 + rockRng() * 0.4)],
        color: `#${cA.getHexString()}`,
      });
      out.blobs.push({ position: [ix + r.x, iy + r.y + 0.06, iz + r.z], radius: s * 1.1 });
      boulderLocals.push({ x: r.x, z: r.z, r: s * 1.2 });
    }

    // ---- shrubs: a mid-layer between grass and trees so the cap reads full
    // without crowding. Density tracks ecosystem flora. ----------------------
    const shrubRng = mulberry32(seed ^ 0x5417b);
    for (const sh of scatterOnCap(seed ^ 0x5417b, geom, {
      count: Math.round(3 + flora * 8),
      minDistance: 2.2,
      radialMax: 0.86,
      maxSlope: 0.85,
      scaleRange: [0.6, 1.15],
      avoid: [...avoid, ...boulderLocals],
    })) {
      const s = sh.scale;
      out.shrubs.push({
        position: [ix + sh.x, iy + sh.y + s * 0.28, iz + sh.z],
        rotation: [0, sh.rotationY, 0],
        scale: [s * 0.85, s * 0.62, s * 0.85],
        color: vitalityTint(
          shrubRng() < 0.5 ? PALETTE.canopyDeep : PALETTE.canopyLight,
          sat,
          shrubRng()
        ),
      });
    }
  }

  return out;
}

const GEOS = {
  stalactite: new ConeGeometry(1, 1, 5, 1),
  trunk: new CylinderGeometry(0.14, 0.24, 1, 6),
  canopy: new IcosahedronGeometry(1, 1),
  boulder: new IcosahedronGeometry(1, 0),
  grassTuft: new ConeGeometry(0.1, 0.5, 5, 1),
  flower: new SphereGeometry(0.075, 6, 5),
  box: new BoxGeometry(1, 1, 1),
  cylinder: new CylinderGeometry(0.5, 0.5, 1, 10),
  cone: new ConeGeometry(0.5, 1, 8, 1),
  dome: new SphereGeometry(0.5, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2),
  sphere: new SphereGeometry(0.5, 10, 8),
};

const PRIM_KINDS: PrimKind[] = ["box", "cylinder", "cone", "dome", "sphere"];

/** Unlit pool material — HDR instance colors read as light, Bloom does the rest. */
const glowMaterial = new MeshBasicMaterial({ toneMapped: false });

/** The whole data-driven world: islands, flora, structures, life, weather. */
export default function WorldGraph() {
  // render the temporal overlay (time-travel / future sim) if present, else
  // the live present — one extra key in geoKey keeps geometry in sync
  const state = useWorldStore((s) => s.preview ?? s.state);
  const era = useWorldStore((s) => s.era);
  const genesisPhase = useGenesisStore((s) => s.phase);
  const dressed = genesisPhase === "idle" || genesisPhase === "done";

  useEffect(() => {
    void useWorldStore.getState().boot();
  }, []);

  // Geometry rebuilds only when something structural changes — level
  // (radius), lock state, flora/vitality, or the seed itself.
  const geoKey = state
    ? era +
      state.worldSeed +
      state.islands
        .map(
          (i) =>
            `${i.id}:${i.level}:${i.locked ? 1 : 0}:${i.ecosystem.flora.toFixed(2)}:${i.vitality.toFixed(2)}:${i.structures.map((s) => s.slot).join(".")}`
        )
        .join("|")
    : "";

  // eslint-disable-next-line react-hooks/exhaustive-deps -- geoKey is the real dependency
  const data = useMemo(() => (state ? buildArchipelago(state) : null), [geoKey]);

  const pools = useMemo(
    () => (state && data ? resolveStructures(state, data.geometries) : null),
    [state, data]
  );

  // contact shadows: trees (from archipelago) + structures/landmarks (anchors)
  const allBlobs = useMemo((): BlobSpec[] => {
    if (!data || !pools) return [];
    return [
      ...data.blobs,
      ...pools.anchors.map((a) => ({
        position: [a.position[0], a.position[1] + 0.09, a.position[2]] as [
          number,
          number,
          number,
        ],
        radius: a.radius * 1.25,
      })),
    ];
  }, [data, pools]);

  const poolInstances = useMemo(() => {
    if (!pools) return null;
    const toPool = (src: typeof pools.body) => {
      const map = {} as Record<PrimKind, PoolInstance[]>;
      const anchorIdx = {} as Record<PrimKind, number[]>;
      for (const kind of PRIM_KINDS) {
        map[kind] = src[kind].map((p) => ({
          position: p.position,
          rotation: [0, p.rotY, 0] as [number, number, number],
          scale: p.scale,
          color: p.color,
        }));
        anchorIdx[kind] = src[kind].map((p) => p.anchorIdx);
      }
      return { map, anchorIdx };
    };
    const body = toPool(pools.body);
    const glow = toPool(pools.glow);
    return {
      body: body.map,
      glow: glow.map,
      bodyAnchorIdx: body.anchorIdx,
      glowAnchorIdx: glow.anchorIdx,
    };
  }, [pools]);

  if (!state || !data || !poolInstances || !pools) return null;

  const anchors = pools.anchors;
  const hoverHandler =
    (idxMap: number[]) =>
    (e: ThreeEvent<PointerEvent>): void => {
      if (e.instanceId === undefined) return;
      e.stopPropagation();
      const a = anchors[idxMap[e.instanceId]];
      if (a) {
        useUIStore.getState().setHoveredStructure(a.structureId);
        document.body.style.cursor = "pointer";
      }
    };
  const unhoverHandler = (): void => {
    useUIStore.getState().setHoveredStructure(null);
    document.body.style.cursor = "";
  };
  const clickHandler =
    (idxMap: number[]) =>
    (e: ThreeEvent<MouseEvent>): void => {
      if (e.instanceId === undefined) return;
      e.stopPropagation();
      const a = anchors[idxMap[e.instanceId]];
      if (!a) return;
      playChime();
      useCameraStore
        .getState()
        .inspectStructure(a.islandId, a.structureId, [
          a.position[0],
          a.position[1] + a.height * 0.5,
          a.position[2],
        ]);
    };

  const rockMat = getToonMaterial("stalactite", {
    color: PALETTE.rockUnder,
    flatShading: true,
    rimColor: "#d9c4ef",
    rimStrength: 0.22,
  });
  const bodyMat = getToonMaterial("structure-body", { rimStrength: 0.3 });

  return (
    <group>
      {data.islands.map((b, i) => (
        <KingdomIsland
          key={b.island.id}
          island={b.island}
          geom={b.geom}
          geomMid={b.geomMid}
          geomLow={b.geomLow}
          layout={b.layout}
          riseIndex={i}
        />
      ))}

      {/* dressing is world-space-baked — hidden until the genesis rise lands */}
      {dressed && (
        <>
          <InstancedPool
            geometry={GEOS.stalactite}
            material={rockMat}
            instances={data.stalactites}
          />
          <InstancedPool
            geometry={GEOS.trunk}
            material={getToonMaterial("trunk", { color: PALETTE.trunk })}
            instances={data.trunks}
            castShadow
          />
          <InstancedPool
            geometry={GEOS.canopy}
            material={getToonMaterial("canopy", {
              flatShading: true,
              rimStrength: 0.46,
              rimColor: "#ffeec2",
            })}
            instances={data.canopies}
            castShadow
            receiveShadow
          />
          <GrassField instances={data.grass} />
          <InstancedPool
            geometry={GEOS.flower}
            material={getToonMaterial("flower", {
              color: "#ffffff",
              emissive: "#fff0cd",
              emissiveIntensity: 0.45,
            })}
            instances={data.flowers}
          />
          <InstancedPool
            geometry={GEOS.boulder}
            material={getToonMaterial("boulder", {
              flatShading: true,
              rimColor: "#fff0d6",
              rimStrength: 0.24,
            })}
            instances={data.boulders}
            castShadow
            receiveShadow
          />
          <InstancedPool
            geometry={GEOS.canopy}
            material={getToonMaterial("canopy", {
              flatShading: true,
              rimStrength: 0.46,
              rimColor: "#ffeec2",
            })}
            instances={data.shrubs}
            castShadow
            receiveShadow
          />

          {PRIM_KINDS.map((kind) => (
            <InstancedPool
              key={`body-${kind}`}
              geometry={GEOS[kind]}
              material={bodyMat}
              instances={poolInstances.body[kind]}
              castShadow
              receiveShadow
              onPointerOver={hoverHandler(poolInstances.bodyAnchorIdx[kind])}
              onPointerOut={unhoverHandler}
              onClick={clickHandler(poolInstances.bodyAnchorIdx[kind])}
            />
          ))}
          {PRIM_KINDS.map((kind) => (
            <InstancedPool
              key={`glow-${kind}`}
              geometry={GEOS[kind]}
              material={glowMaterial}
              instances={poolInstances.glow[kind]}
              onPointerOver={hoverHandler(poolInstances.glowAnchorIdx[kind])}
              onPointerOut={unhoverHandler}
              onClick={clickHandler(poolInstances.glowAnchorIdx[kind])}
            />
          ))}

          <ContactBlobs blobs={allBlobs} />
          <HoverMarker anchors={pools.anchors} />
          <ContextualUI built={data.islands} anchors={pools.anchors} />

          {data.waterfalls.map((w, i) => (
            <Waterfall key={i} lip={w.lip} dir={w.dir} style={w.style} />
          ))}

          <BridgeLayer state={state} />
          <GateLayer built={data.islands} />
          <AmbientLife state={state} built={data.islands} />
          <WeatherLayer state={state} built={data.islands} />
          <BeaconLayer state={state} built={data.islands} />
          <SeasonLayer season={state.season} />
          {era === "present" && <CollectibleLayer state={state} built={data.islands} />}
          <GrowthFX anchors={pools.anchors} built={data.islands} />
        </>
      )}
    </group>
  );
}
