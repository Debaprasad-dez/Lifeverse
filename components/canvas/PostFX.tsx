"use client";

import { useMemo } from "react";
import { useThree } from "@react-three/fiber";
import { Bloom, EffectComposer, ToneMapping, Vignette } from "@react-three/postprocessing";
import { ToneMappingMode } from "postprocessing";
import { N8AOPostPass } from "n8ao";
import { DEFAULT_SETTINGS, getLocal } from "@/lib/storage";

/**
 * Single composer. N8AO grounds every contact (the "rendered film frame"
 * feel); Bloom is the engine's "glow" primitive — emissive semantics
 * everywhere assume it. Canvas runs `flat` (NoToneMapping); ACES happens
 * here at the end of the chain.
 */
export default function PostFX() {
  const { scene, camera, size } = useThree();
  const quality = getLocal("settings", DEFAULT_SETTINGS).quality;
  const ao = quality !== "low";

  const aoPass = useMemo(() => {
    if (!ao) return null;
    const pass = new N8AOPostPass(scene, camera, size.width, size.height);
    pass.configuration.aoRadius = 3.2;
    pass.configuration.distanceFalloff = 2.2;
    pass.configuration.intensity = 2.6;
    pass.configuration.halfRes = true;
    // our chain is linear until the final ACES pass — N8AO must not gamma
    pass.configuration.gammaCorrection = false;
    pass.configuration.color.set(0x2a2438); // cool plum occlusion, not dead black
    return pass;
  }, [ao, scene, camera, size.width, size.height]);

  return (
    <EffectComposer multisampling={4}>
      {aoPass ? <primitive object={aoPass} /> : <></>}
      <Bloom
        mipmapBlur
        intensity={0.85}
        luminanceThreshold={0.74}
        luminanceSmoothing={0.24}
      />
      <Vignette eskil={false} offset={0.2} darkness={0.42} />
      <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
    </EffectComposer>
  );
}
