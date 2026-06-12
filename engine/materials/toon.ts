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
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        `#include <common>
         uniform vec3 uRimColor;
         uniform float uRimPower;
         uniform float uRimStrength;`
      )
      .replace(
        "#include <opaque_fragment>",
        `float lvFresnel = pow(
           1.0 - saturate(dot(normalize(vViewPosition), normal)), uRimPower);
         outgoingLight += uRimColor * lvFresnel * uRimStrength;
         #include <opaque_fragment>`
      );
  };
  // Distinct shader program per rim variant (onBeforeCompile isn't keyed).
  material.customProgramCacheKey = () => `lv-toon-rim:${key}`;

  cache.set(key, material);
  return material;
}
