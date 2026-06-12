"use client";

import { useLayoutEffect, useRef } from "react";
import {
  BufferGeometry,
  Color,
  Euler,
  InstancedMesh,
  Material,
  Matrix4,
  Quaternion,
  Vector3,
} from "three";

export interface PoolInstance {
  position: [number, number, number];
  rotation?: [number, number, number];
  scale: [number, number, number] | number;
  color?: string | Color;
}

interface InstancedPoolProps {
  geometry: BufferGeometry;
  material: Material;
  instances: PoolInstance[];
  castShadow?: boolean;
  receiveShadow?: boolean;
}

const m = new Matrix4();
const q = new Quaternion();
const e = new Euler();
const v = new Vector3();
const c = new Color();

/** One InstancedMesh filled from plain instance data. */
export default function InstancedPool({
  geometry,
  material,
  instances,
  castShadow,
  receiveShadow,
}: InstancedPoolProps) {
  const ref = useRef<InstancedMesh>(null);

  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    instances.forEach((inst, i) => {
      const [rx, ry, rz] = inst.rotation ?? [0, 0, 0];
      q.setFromEuler(e.set(rx, ry, rz));
      const s = inst.scale;
      m.compose(
        v.set(...inst.position),
        q,
        typeof s === "number" ? new Vector3(s, s, s) : new Vector3(...s)
      );
      mesh.setMatrixAt(i, m);
      if (inst.color !== undefined) {
        mesh.setColorAt(i, c.set(inst.color));
      }
    });
    mesh.count = instances.length;
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [instances]);

  if (instances.length === 0) return null;

  return (
    <instancedMesh
      ref={ref}
      args={[geometry, material, instances.length]}
      castShadow={castShadow}
      receiveShadow={receiveShadow}
    />
  );
}
