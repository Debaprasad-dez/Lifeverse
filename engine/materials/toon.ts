/**
 * Shared stylized material system: MeshToonMaterial with a 3-band ramp +
 * injected fresnel rim light. The engine owns ALL aesthetics — components
 * request materials from here, never construct ad-hoc ones.
 */

import {
  Color,
  DataTexture,
  LinearFilter,
  MeshToonMaterial,
  RedFormat,
  type WebGLProgramParametersWithUniforms,
} from "three";
import { GLSL_SIMPLEX_2D } from "@/lib/glsl";

let gradientMap: DataTexture | null = null;

/** 3-band toon ramp (shadow / mid / lit), linear-filtered for soft edges. */
export function getToonGradientMap(): DataTexture {
  if (!gradientMap) {
    const data = new Uint8Array([110, 185, 255]);
    gradientMap = new DataTexture(data, 3, 1, RedFormat);
    gradientMap.minFilter = LinearFilter;
    gradientMap.magFilter = LinearFilter;
    gradientMap.generateMipmaps = false;
    gradientMap.needsUpdate = true;
  }
  return gradientMap;
}

export interface ToonMaterialOptions {
  color?: string;
  vertexColors?: boolean;
  rimColor?: string;
  rimPower?: number;
  rimStrength?: number;
  emissive?: string;
  emissiveIntensity?: number;
  flatShading?: boolean;
  fog?: boolean;
  /** Procedural surface grain (0 = none). Local-position simplex mottle +
   *  fine fleck — gives ground/rock a textured, non-flat read at any zoom. */
  grain?: number;
}

const cache = new Map<string, MeshToonMaterial>();

/**
 * Toon material with fresnel rim (warm golden-hour edge light per the
 * reference renders). Cached by option signature — share, don't dispose.
 */
export function getToonMaterial(
  key: string,
  options: ToonMaterialOptions = {}
): MeshToonMaterial {
  const cached = cache.get(key);
  if (cached) return cached;

  const {
    color = "#ffffff",
    vertexColors = false,
    rimColor = "#ffe6bf",
    rimPower = 2.6,
    rimStrength = 0.32,
    emissive,
    emissiveIntensity = 1,
    flatShading = false,
    fog = true,
    grain = 0,
  } = options;

  const material = new MeshToonMaterial({
    color: new Color(color),
    gradientMap: getToonGradientMap(),
    vertexColors,
    fog,
  });
  // Not in MeshToonMaterial's type, but WebGLPrograms honors it (FLAT_SHADED).
  (material as MeshToonMaterial & { flatShading: boolean }).flatShading = flatShading;
  if (emissive) {
    material.emissive = new Color(emissive);
    material.emissiveIntensity = emissiveIntensity;
  }

  material.onBeforeCompile = (shader: WebGLProgramParametersWithUniforms) => {
    shader.uniforms.uRimColor = { value: new Color(rimColor) };
    shader.uniforms.uRimPower = { value: rimPower };
    shader.uniforms.uRimStrength = { value: rimStrength };

    let fragCommon = `#include <common>
       uniform vec3 uRimColor;
       uniform float uRimPower;
       uniform float uRimStrength;`;
    let fragOpaque = `float lvFresnel = pow(
         1.0 - saturate(dot(normalize(vViewPosition), normal)), uRimPower);
       outgoingLight += uRimColor * lvFresnel * uRimStrength;`;

    if (grain > 0) {
      shader.uniforms.uGrain = { value: grain };
      // local-position varying for stable, zoom-independent surface texture
      shader.vertexShader = shader.vertexShader
        .replace("#include <common>", `#include <common>\nvarying vec3 vLvPos;`)
        .replace("#include <begin_vertex>", `#include <begin_vertex>\nvLvPos = transformed;`);
      fragCommon += `\nuniform float uGrain;\nvarying vec3 vLvPos;\n${GLSL_SIMPLEX_2D}`;
      fragOpaque += `
         float lvG = snoise(vLvPos.xz * 0.5) * 0.5
                   + snoise(vLvPos.xz * 1.7) * 0.3
                   + snoise(vLvPos.xz * 4.6) * 0.2;
         outgoingLight *= 1.0 + lvG * uGrain;
         float lvFleck = snoise(vLvPos.xz * 13.0);
         outgoingLight *= 1.0 - smoothstep(0.6, 1.0, lvFleck) * uGrain * 0.9;
         // fine bright glints — snow sparkle / mineral specks
         outgoingLight += vec3(1.0) * smoothstep(0.87, 1.0, snoise(vLvPos.xz * 23.0)) * uGrain * 0.55;`;
    }

    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", fragCommon)
      .replace("#include <opaque_fragment>", `${fragOpaque}\n#include <opaque_fragment>`);
  };
  // Distinct shader program per rim/grain variant (onBeforeCompile isn't keyed).
  material.customProgramCacheKey = () => `lv-toon-rim:${key}:${grain > 0 ? "g" : ""}`;

  cache.set(key, material);
  return material;
}
