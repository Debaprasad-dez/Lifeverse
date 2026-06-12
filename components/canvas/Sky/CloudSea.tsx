"use client";

import { useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import { Color, DoubleSide, ShaderMaterial, Vector3 } from "three";
import { GLSL_SIMPLEX_2D } from "@/lib/glsl";
import { PALETTE, SUN_DIRECTION, WORLD } from "@/lib/constants";

const vertexShader = /* glsl */ `
uniform float uTime;
varying float vHeight;
varying vec3 vWorld;

${GLSL_SIMPLEX_2D}

void main() {
  vec3 world = (modelMatrix * vec4(position, 1.0)).xyz;
  float swellA = fbm(world.xz * 0.012 + uTime * 0.010, 4) * 7.0;
  float swellB = fbm(world.xz * 0.046 - uTime * 0.018, 3) * 2.3;
  float h = swellA + swellB;
  // plane is rotated -90° about X, so object-space +Z is world up
  vec3 displaced = position + vec3(0.0, 0.0, h);
  vWorld = (modelMatrix * vec4(displaced, 1.0)).xyz;
  vHeight = h / 9.3;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(displaced, 1.0);
}
`;

const fragmentShader = /* glsl */ `
uniform vec3 uBase;
uniform vec3 uValley;
uniform vec3 uHorizon;
uniform vec3 uSunWarm;
uniform vec3 uCamPos;
varying float vHeight;
varying vec3 vWorld;

void main() {
  vec3 col = mix(uValley, uBase, smoothstep(-0.5, 0.8, vHeight));
  // sun-kissed crests
  col += uSunWarm * 0.17 * smoothstep(0.1, 0.95, vHeight);
  // melt into the sky at the horizon — no visible plane edge from any angle
  float dist = length(vWorld.xz - uCamPos.xz);
  col = mix(col, uHorizon, smoothstep(300.0, 680.0, dist));
  gl_FragColor = vec4(col, 1.0);
}
`;

/** Rolling cloud ocean far below the islands — waterfalls pour into it. */
export default function CloudSea() {
  const material = useMemo(
    () =>
      new ShaderMaterial({
        vertexShader,
        fragmentShader,
        uniforms: {
          uTime: { value: 0 },
          uBase: { value: new Color("#fbfdff") },
          uValley: { value: new Color("#b5d2ec") },
          uHorizon: { value: new Color(PALETTE.sky3DHorizon) },
          uSunWarm: { value: new Color(PALETTE.sunWarm) },
          uCamPos: { value: new Vector3() },
          uSunDir: { value: SUN_DIRECTION.clone() },
        },
        side: DoubleSide,
        fog: false,
      }),
    []
  );

  useFrame((state, delta) => {
    material.uniforms.uTime.value += delta;
    material.uniforms.uCamPos.value.copy(state.camera.position);
  });

  return (
    <mesh
      material={material}
      rotation={[-Math.PI / 2, 0, 0]}
      position={[0, WORLD.cloudSeaY, 0]}
      frustumCulled={false}
    >
      {/* 80² segments ≈ 12.8k tris — the sea was the biggest single tri cost */}
      <planeGeometry args={[1700, 1700, 80, 80]} />
    </mesh>
  );
}
