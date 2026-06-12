"use client";

import { useEffect } from "react";
import { useThree } from "@react-three/fiber";
import { Stats } from "@react-three/drei";

/**
 * ?debug=1 budget HUD. (r3f-perf's bundled woff.mjs breaks Turbopack on
 * Next 16, so this reads renderer.info directly — same budget numbers:
 * draw calls, triangles, geometries, textures.)
 *
 * Lives inside <Canvas>, so it must not render DOM through React (the R3F
 * reconciler owns this subtree) — the readout div is managed imperatively.
 */
export default function DebugPerf() {
  const gl = useThree((s) => s.gl);

  useEffect(() => {
    const el = document.createElement("div");
    el.style.cssText =
      "position:fixed;left:8px;bottom:8px;z-index:50;font-family:monospace;" +
      "font-size:11px;line-height:1.5;color:#bfffd0;background:rgba(10,24,36,0.82);" +
      "padding:6px 10px;border-radius:8px;pointer-events:none;";
    document.body.appendChild(el);

    const id = setInterval(() => {
      const r = gl.info.render;
      const m = gl.info.memory;
      el.textContent = `calls ${r.calls} · tris ${(r.triangles / 1000).toFixed(1)}k · geo ${m.geometries} · tex ${m.textures}`;
    }, 500);

    return () => {
      clearInterval(id);
      el.remove();
    };
  }, [gl]);

  return <Stats showPanel={0} />;
}
