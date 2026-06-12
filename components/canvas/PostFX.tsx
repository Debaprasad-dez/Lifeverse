"use client";

import { Bloom, EffectComposer, ToneMapping, Vignette } from "@react-three/postprocessing";
import { ToneMappingMode } from "postprocessing";

/**
 * Single composer. Bloom is the engine's "glow" primitive — emissive
 * semantics everywhere assume it. Canvas runs `flat` (NoToneMapping);
 * ACES happens here at the end of the chain.
 */
export default function PostFX() {
  return (
    <EffectComposer multisampling={4}>
      <Bloom
        mipmapBlur
        intensity={0.7}
        luminanceThreshold={0.78}
        luminanceSmoothing={0.22}
      />
      <Vignette eskil={false} offset={0.2} darkness={0.42} />
      <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
    </EffectComposer>
  );
}
