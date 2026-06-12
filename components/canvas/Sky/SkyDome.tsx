"use client";

import { useMemo } from "react";
import { BackSide, Color, ShaderMaterial } from "three";
import { PALETTE, SUN_DIRECTION, WORLD } from "@/lib/constants";

const vertexShader = /* glsl */ `
varying vec3 vDir;
void main() {
  vDir = (modelMatrix * vec4(position, 1.0)).xyz;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const fragmentShader = /* glsl */ `
uniform vec3 uZenith;
uniform vec3 uMid;
uniform vec3 uHorizon;
uniform vec3 uSunColor;
uniform vec3 uSunDir;
varying vec3 vDir;

void main() {
  vec3 dir = normalize(vDir);
  float h = dir.y;
  // three-stop gradient: creamy horizon → soft mid → saturated azure
  vec3 col = mix(uHorizon, uMid, smoothstep(-0.04, 0.16, h));
  col = mix(col, uZenith, smoothstep(0.08, 0.5, h));

  // warm golden-hour glow: broad wash, tight halo, hot disc (bloom fuel)
  float sunD = max(dot(dir, uSunDir), 0.0);
  col += uSunColor * (pow(sunD, 5.0) * 0.28 + pow(sunD, 48.0) * 0.55 + pow(sunD, 700.0) * 2.4);
  // low warm band hugging the horizon on the sun side
  col += uSunColor * 0.3 * pow(sunD, 2.0) * (1.0 - smoothstep(0.0, 0.5, abs(h)));

  gl_FragColor = vec4(col, 1.0);
}
`;

export default function SkyDome() {
  const material = useMemo(
    () =>
      new ShaderMaterial({
        vertexShader,
        fragmentShader,
        uniforms: {
          uZenith: { value: new Color(PALETTE.sky3DZenith) },
          uMid: { value: new Color(PALETTE.sky3DMid) },
          uHorizon: { value: new Color(PALETTE.sky3DHorizon) },
          uSunColor: { value: new Color(PALETTE.sunWarm) },
          uSunDir: { value: SUN_DIRECTION.clone() },
        },
        side: BackSide,
        depthWrite: false,
        fog: false,
      }),
    []
  );

  return (
    <mesh material={material} frustumCulled={false} renderOrder={-100}>
      <sphereGeometry args={[WORLD.skyRadius, 48, 32]} />
    </mesh>
  );
}
