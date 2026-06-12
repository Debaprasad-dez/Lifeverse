"use client";

import { useLayoutEffect, useMemo, useRef } from "react";
import { useFrame, type ThreeEvent } from "@react-three/fiber";
import {
  Color,
  ConeGeometry,
  CylinderGeometry,
  Euler,
  Group,
  IcosahedronGeometry,
  InstancedMesh,
  Matrix4,
  Quaternion,
  SphereGeometry,
  Vector3,
} from "three";
import { buildIsland, buildStalactites } from "@/engine/generation/island";
import { scatterOnCap } from "@/engine/generation/scatter";
import { getToonMaterial } from "@/engine/materials/toon";
import { PALETTE, WORLD, WORLD_SEED } from "@/lib/constants";
import { mulberry32, seedFrom } from "@/lib/noise";
import { useCameraStore } from "@/stores/cameraStore";
import Waterfall from "@/components/canvas/effects/Waterfall";
import IslandLabel from "@/components/canvas/IslandLabel";

export const FIRST_ISLAND_ID = "health";
export const FIRST_ISLAND_CENTER: [number, number, number] = [0, 1.5, 0];

const tmpMat = new Matrix4();
const tmpQuat = new Quaternion();
const tmpEuler = new Euler();
const tmpScale = new Vector3();
const tmpPos = new Vector3();
const tmpColor = new Color();
const canopyDeep = new Color(PALETTE.canopyDeep);
const canopyLight = new Color(PALETTE.canopyLight);
const grassDeep = new Color(PALETTE.grassDeep);
const grassLight = new Color(PALETTE.grassLight);

/** The first kingdom: a lush Health-style island, Phase-1 hero. */
export default function FirstIsland() {
  const data = useMemo(() => {
    const seed = seedFrom(WORLD_SEED, FIRST_ISLAND_ID);
    const island = buildIsland({
      seed,
      radius: WORLD.islandRadius,
      capHeight: 2.3,
      depth: 14.5,
    });
    const stalactites = buildStalactites(seed, island);

    const avoid = [
      { x: island.waterfall.lip.x, z: island.waterfall.lip.z, r: 3.4 },
    ];
    const trees = scatterOnCap(seed ^ 0x71ee5, island, {
      count: 24,
      minDistance: 3.0,
      radialMax: 0.84,
      maxSlope: 0.8,
      scaleRange: [1.05, 2.0],
      avoid,
    });
    const grass = scatterOnCap(seed ^ 0x6e55, island, {
      count: 90,
      minDistance: 0.75,
      radialMax: 0.92,
      maxSlope: 1.1,
      scaleRange: [0.95, 1.7],
      avoid,
    });
    const flowers = scatterOnCap(seed ^ 0xf10e, island, {
      count: 24,
      minDistance: 1.3,
      radialMax: 0.88,
      maxSlope: 0.9,
      scaleRange: [0.8, 1.4],
      avoid,
    });

    // three companion rocks drifting beside the island (screen2.png)
    const rockRng = mulberry32(seed ^ 0x0c4a);
    const rocks = [0, 1, 2].map((i) => ({
      island: buildIsland({
        seed: seedFrom(seed, `rock-${i}`),
        radius: 1.5 + i * 0.45,
        capHeight: 0.6,
        depth: 3.1 + i * 0.7,
        angularSegments: 48,
      }),
      position: [
        [16.5, -3.0, -8.0],
        [-15.0, -5.0, 9.5],
        [11.5, -7.5, 14.0],
      ][i] as [number, number, number],
      phase: rockRng() * Math.PI * 2,
      spin: 0.015 + rockRng() * 0.02,
    }));

    return { island, stalactites, trees, grass, flowers, rocks };
  }, []);

  const islandMaterial = getToonMaterial("island", { vertexColors: true });
  const rockMaterial = getToonMaterial("stalactite", {
    color: PALETTE.rockUnder,
    flatShading: true,
    rimColor: "#d9c4ef",
    rimStrength: 0.22,
  });

  const stalactiteRef = useRef<InstancedMesh>(null);
  const trunkRef = useRef<InstancedMesh>(null);
  const canopyRef = useRef<InstancedMesh>(null);
  const grassRef = useRef<InstancedMesh>(null);
  const flowerRef = useRef<InstancedMesh>(null);
  const rockRefs = useRef<(Group | null)[]>([]);

  // geometries shared by the instanced layers
  const geos = useMemo(
    () => ({
      stalactite: new ConeGeometry(1, 1, 5, 1),
      trunk: new CylinderGeometry(0.14, 0.24, 1, 6),
      canopy: new IcosahedronGeometry(1, 1),
      grass: new ConeGeometry(0.1, 0.5, 5, 1),
      flower: new SphereGeometry(0.075, 6, 5),
    }),
    []
  );

  useLayoutEffect(() => {
    const { stalactites, trees, grass, flowers } = data;
    const grassRng = mulberry32(0x6e55);

    const st = stalactiteRef.current!;
    stalactites.forEach((s, i) => {
      tmpQuat.setFromEuler(tmpEuler.set(Math.PI + s.tiltX, 0, s.tiltZ));
      tmpPos.copy(s.position);
      tmpPos.y -= s.scale.y * 0.5 - 0.3;
      tmpMat.compose(tmpPos, tmpQuat, s.scale);
      st.setMatrixAt(i, tmpMat);
    });
    st.instanceMatrix.needsUpdate = true;

    const trunk = trunkRef.current!;
    const canopy = canopyRef.current!;
    const blobRng = mulberry32(0xb10b);
    trees.forEach((t, i) => {
      const s = t.scale;
      tmpQuat.setFromEuler(tmpEuler.set(0, t.rotationY, 0));
      tmpMat.compose(
        tmpPos.set(t.x, t.y + 0.5 * s - 0.08, t.z),
        tmpQuat,
        tmpScale.set(s, s, s)
      );
      trunk.setMatrixAt(i, tmpMat);

      // lumpy 3-blob canopy — single ball reads as a lollipop, three don't
      const baseY = t.y + s * 1.5;
      for (let j = 0; j < 3; j++) {
        const a = t.rotationY + j * 2.4 + blobRng() * 0.8;
        const off = j === 0 ? 0 : s * (0.55 + blobRng() * 0.25);
        const blobScale = s * (j === 0 ? 1.3 : 0.78 + blobRng() * 0.22);
        tmpQuat.setFromEuler(tmpEuler.set(0, a, 0));
        tmpMat.compose(
          tmpPos.set(
            t.x + Math.cos(a) * off,
            baseY + (j === 0 ? 0.25 * s : s * (0.1 + blobRng() * 0.45)),
            t.z + Math.sin(a) * off
          ),
          tmpQuat,
          tmpScale.set(blobScale * 1.15, blobScale, blobScale * 1.15)
        );
        canopy.setMatrixAt(i * 3 + j, tmpMat);
        tmpColor
          .copy(canopyDeep)
          .lerp(canopyLight, ((i * 0.37 + j * 0.21) % 1) * 0.9 + blobRng() * 0.1);
        canopy.setColorAt(i * 3 + j, tmpColor);
      }
    });
    trunk.instanceMatrix.needsUpdate = true;
    canopy.instanceMatrix.needsUpdate = true;
    if (canopy.instanceColor) canopy.instanceColor.needsUpdate = true;

    const gr = grassRef.current!;
    grass.forEach((g, i) => {
      tmpQuat.setFromEuler(tmpEuler.set(0, g.rotationY, (grassRng() - 0.5) * 0.3));
      tmpMat.compose(
        tmpPos.set(g.x, g.y + 0.22 * g.scale, g.z),
        tmpQuat,
        tmpScale.set(g.scale, g.scale, g.scale)
      );
      gr.setMatrixAt(i, tmpMat);
      tmpColor.copy(grassDeep).lerp(grassLight, grassRng());
      gr.setColorAt(i, tmpColor);
    });
    gr.instanceMatrix.needsUpdate = true;
    if (gr.instanceColor) gr.instanceColor.needsUpdate = true;

    const fl = flowerRef.current!;
    flowers.forEach((f, i) => {
      tmpQuat.identity();
      tmpMat.compose(
        tmpPos.set(f.x, f.y + 0.1, f.z),
        tmpQuat,
        tmpScale.set(f.scale, f.scale, f.scale)
      );
      fl.setMatrixAt(i, tmpMat);
    });
    fl.instanceMatrix.needsUpdate = true;
  }, [data, geos]);

  useFrame((state, delta) => {
    const t = state.clock.elapsedTime;
    data.rocks.forEach((rock, i) => {
      const g = rockRefs.current[i];
      if (g) {
        g.position.y = rock.position[1] + Math.sin(t * 0.45 + rock.phase) * 0.55;
        g.rotation.y += delta * rock.spin;
      }
    });
  });

  const onDoubleClick = (e: ThreeEvent<MouseEvent>): void => {
    e.stopPropagation();
    useCameraStore.getState().flyToIsland(FIRST_ISLAND_ID, FIRST_ISLAND_CENTER);
  };

  const labelTheta = 0.45; // camera-facing side, clear of the waterfall
  const labelEdge = data.island.edgePointAt(labelTheta);
  const labelPos: [number, number, number] = [
    labelEdge.x + Math.cos(labelTheta) * 3.4,
    labelEdge.y - 2.6,
    labelEdge.z + Math.sin(labelTheta) * 3.4,
  ];

  return (
    <group>
      <group onDoubleClick={onDoubleClick}>
        <mesh
          geometry={data.island.geometry}
          material={islandMaterial}
          castShadow
          receiveShadow
        />
        <instancedMesh
          ref={stalactiteRef}
          args={[geos.stalactite, rockMaterial, data.stalactites.length]}
        />
        <instancedMesh
          ref={trunkRef}
          args={[geos.trunk, getToonMaterial("trunk", { color: PALETTE.trunk }), data.trees.length]}
          castShadow
        />
        <instancedMesh
          ref={canopyRef}
          args={[
            geos.canopy,
            getToonMaterial("canopy", { flatShading: true, rimStrength: 0.38 }),
            data.trees.length * 3,
          ]}
          castShadow
          receiveShadow
        />
        <instancedMesh
          ref={grassRef}
          args={[geos.grass, getToonMaterial("grass", { flatShading: true }), data.grass.length]}
        />
        <instancedMesh
          ref={flowerRef}
          args={[
            geos.flower,
            getToonMaterial("flower", {
              color: PALETTE.gold,
              emissive: "#ffc83d",
              emissiveIntensity: 0.85,
            }),
            data.flowers.length,
          ]}
        />
        <Waterfall lip={data.island.waterfall.lip} dir={data.island.waterfall.dir} />
      </group>

      {data.rocks.map((rock, i) => (
        <group
          key={i}
          ref={(g) => {
            rockRefs.current[i] = g;
          }}
          position={rock.position}
        >
          <mesh geometry={rock.island.geometry} material={islandMaterial} />
        </group>
      ))}

      <IslandLabel
        text="HEALTH"
        position={labelPos}
        plateColor={PALETTE.healthAccent}
        plateDark="#1d6b40"
      />
    </group>
  );
}
