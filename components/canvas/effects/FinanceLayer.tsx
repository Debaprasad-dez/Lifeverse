"use client";

import { useMemo, useRef } from "react";
import { useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import { MeshReflectorMaterial } from "@react-three/drei";
import {
  AdditiveBlending,
  CanvasTexture,
  CircleGeometry,
  Color,
  ConeGeometry,
  CylinderGeometry,
  EquirectangularReflectionMapping,
  Group,
  InstancedMesh,
  Matrix4,
  MeshBasicMaterial,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  OctahedronGeometry,
  PMREMGenerator,
  Quaternion,
  SpriteMaterial,
  type Texture,
  TetrahedronGeometry,
  TorusGeometry,
  Vector3,
} from "three";
import type { BuiltIsland } from "@/components/canvas/WorldGraph";
import { CORE_KINGDOM_IDS, type CoreKingdomId } from "@/engine/schema/world";
import { islandCenter, islandRadius } from "@/engine/resolver/layout";
import { buildGoldVault } from "@/engine/generation/structures/goldvault";
import { mulberry32 } from "@/lib/noise";
import { particleScale } from "@/lib/quality";
import { useCameraStore } from "@/stores/cameraStore";
import InstancedPool, { type PoolInstance } from "@/components/canvas/InstancedPool";

const octaGeo = new OctahedronGeometry(0.5, 0);
const cylGeo = new CylinderGeometry(0.5, 0.6, 1, 6);
const pyrGeo = new ConeGeometry(0.5, 1, 4); // gold pyramid mote
// 3D dollar glyph: two 270° torus arcs (the S) + a vertical bar
const dollarArcGeo = new TorusGeometry(0.5, 0.14, 16, 56, Math.PI * 1.5);
const barGeo = new CylinderGeometry(0.13, 0.13, 1, 16);

function makeAuraTexture(): CanvasTexture {
  const c = document.createElement("canvas");
  c.width = 256;
  c.height = 256;
  const ctx = c.getContext("2d")!;
  const g = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
  g.addColorStop(0, "rgba(255,225,150,0.9)");
  g.addColorStop(0.35, "rgba(255,200,90,0.35)");
  g.addColorStop(1, "rgba(255,200,90,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 256, 256);
  return new CanvasTexture(c);
}
const tetGeo = new TetrahedronGeometry(0.55); // silver tetrahedron mote
const poolGeo = new CircleGeometry(1, 40);
const ringGeo = new TorusGeometry(1, 0.03, 6, 36);

const GEM_COLS = ["#2ecf7a", "#4f7bff", "#dff2ff", "#ffd24a", "#b06cff"];
const QUARTZ_COLS = ["#b06cff", "#dff2ff", "#7fe6c0"];

const sparkleMat = new MeshBasicMaterial({ color: new Color("#fff3c0").multiplyScalar(1.8), toneMapped: false });
const goldMoteMat = new MeshBasicMaterial({ color: new Color("#ffd24a").multiplyScalar(1.4), toneMapped: false });
const silverMoteMat = new MeshBasicMaterial({ color: new Color("#dfe6ec").multiplyScalar(1.4), toneMapped: false });
const ringMat = new MeshBasicMaterial({ color: new Color("#eaf6ff").multiplyScalar(1.3), toneMapped: false, transparent: true, opacity: 0.6, depthWrite: false });

const tmpM = new Matrix4();
const tmpQ = new Quaternion();
const tmpV = new Vector3();
const tmpS = new Vector3();

function makeFlareTexture(): CanvasTexture {
  const c = document.createElement("canvas");
  c.width = 128;
  c.height = 128;
  const ctx = c.getContext("2d")!;
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, "rgba(255,255,255,0.95)");
  g.addColorStop(0.25, "rgba(255,240,200,0.55)");
  g.addColorStop(0.6, "rgba(180,220,255,0.12)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  return new CanvasTexture(c);
}

interface Mote { x: number; z: number; baseY: number; rise: number; speed: number; phase: number; spin: number; size: number; gold: boolean }

function Finance({ island, geom }: BuiltIsland) {
  const { gl } = useThree();
  const sparkleRef = useRef<InstancedMesh>(null);
  const goldRef = useRef<InstancedMesh>(null);
  const silverRef = useRef<InstancedMesh>(null);
  const ringRef = useRef<InstancedMesh>(null);

  // scoped reflection probe: procedural azure-noon sky → PMREM env
  const envMap = useMemo(() => {
    const cv = document.createElement("canvas");
    cv.width = 512;
    cv.height = 256;
    const ctx = cv.getContext("2d")!;
    const g = ctx.createLinearGradient(0, 0, 0, 256);
    g.addColorStop(0, "#0A1930");
    g.addColorStop(0.55, "#2b6fb0");
    g.addColorStop(1, "#4FC3F7");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 512, 256);
    const sg = ctx.createRadialGradient(380, 56, 0, 380, 56, 70);
    sg.addColorStop(0, "#ffffff");
    sg.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = sg;
    ctx.fillRect(300, 0, 160, 140);
    const tex = new CanvasTexture(cv);
    tex.mapping = EquirectangularReflectionMapping;
    const pmrem = new PMREMGenerator(gl);
    pmrem.compileEquirectangularShader();
    const rt = pmrem.fromEquirectangular(tex);
    tex.dispose();
    pmrem.dispose();
    return rt.texture;
  }, [gl]);

  const mats = useMemo(() => {
    const gem = new MeshStandardMaterial({ color: "#ffffff", metalness: 0.55, roughness: 0.1, envMap, envMapIntensity: 1.6, flatShading: true });
    const brass = new MeshStandardMaterial({ color: "#c9a24a", metalness: 0.9, roughness: 0.3, envMap, envMapIntensity: 1.1 });
    const quartz = new MeshStandardMaterial({ color: "#ffffff", metalness: 0.2, roughness: 0.06, envMap, envMapIntensity: 1.4, flatShading: true });
    // reflective envMap glass (no transmission pass — cheaper + avoids the
    // transmission render-target dependency; reads as gleaming structural glass)
    const vault = new MeshPhysicalMaterial({ color: "#dfeefc", metalness: 0.15, roughness: 0.04, envMap, envMapIntensity: 1.6, transparent: true, opacity: 0.72 });
    const flare = new SpriteMaterial({ map: makeFlareTexture(), color: 0xffffff, transparent: true, depthWrite: false, blending: AdditiveBlending, opacity: 0.9 });
    return { gem, brass, quartz, vault, flare };
  }, [envMap]);

  const v = useMemo(() => {
    const radius = islandRadius(island);
    const gv = buildGoldVault(island, geom, radius);
    const [ix, iy, iz] = island.position;
    const rng = mulberry32(0x60d077 ^ Math.round(radius * 100));
    const pscale = particleScale();

    // gem trees → brass (trunk + stub branches) + gems (per-instance tint)
    const brass: PoolInstance[] = [];
    const gems: PoolInstance[] = [];
    const tmpC = new Color();
    const gemCol = (): Color => tmpC.set(GEM_COLS[Math.floor(rng() * GEM_COLS.length)]).clone();
    for (const tr of gv.gemTrees) {
      const bx = ix + tr.x;
      const bz = iz + tr.z;
      const by = iy + tr.y;
      brass.push({ position: [bx, by + tr.h * 0.5, bz], rotation: [0, 0, 0], scale: [tr.w * 0.18, tr.h, tr.w * 0.18] });
      const top = by + tr.h;
      // Fibonacci-angled gem leaves around the crown
      const n = 6;
      for (let i = 0; i < n; i++) {
        const a = i * 2.399963; // golden angle
        const rr = tr.w * (0.3 + (i / n) * 0.5);
        const gy = top - tr.h * 0.25 * (i / n);
        gems.push({
          position: [bx + Math.cos(a) * rr, gy, bz + Math.sin(a) * rr],
          rotation: [rng() * 3, a, rng() * 3],
          scale: [tr.w * 0.6, tr.w * 0.9, tr.w * 0.6],
          color: gemCol(),
        });
      }
      // two stub branches
      for (const side of [-1, 1] as const) {
        const a = rng() * Math.PI * 2;
        brass.push({ position: [bx + Math.cos(a) * tr.w * 0.3, by + tr.h * 0.6, bz + Math.sin(a) * tr.w * 0.3], rotation: [side * 0.7, a, 0], scale: [tr.w * 0.1, tr.h * 0.4, tr.w * 0.1] });
      }
    }

    // crystal outcroppings (per-instance tint)
    const outc: PoolInstance[] = gv.outcrops.map((o) => ({
      position: [ix + o.x, iy + o.y + o.h * 0.4, iz + o.z],
      rotation: [o.tilt, o.rot, o.tilt * 0.5],
      scale: [o.h * 0.34, o.h, o.h * 0.34],
      color: new Color(QUARTZ_COLS[o.tint]).clone(),
    }));

    // sparkle glints (animated)
    const sparkles = gv.sparkles.map((p) => ({ pos: new Vector3(ix + p.x, iy + p.y, iz + p.z), phase: rng() * Math.PI * 2, size: radius * (0.02 + rng() * 0.02) }));

    // geometric motes rising from the centre
    const motes: Mote[] = Array.from({ length: Math.max(8, Math.round(26 * pscale)) }, () => {
      const a = rng() * Math.PI * 2;
      const r = Math.sqrt(rng()) * radius * 0.5;
      const x = Math.cos(a) * r;
      const z = Math.sin(a) * r;
      return { x: ix + x, z: iz + z, baseY: iy + geom.capHeightAt(x, z) + 0.5, rise: 4 + rng() * 4, speed: 0.06 + rng() * 0.08, phase: rng(), spin: (rng() - 0.5) * 2, size: radius * (0.03 + rng() * 0.03), gold: rng() < 0.5 };
    });
    const goldMotes = motes.filter((m) => m.gold);
    const silverMotes = motes.filter((m) => !m.gold);

    // hero crystal vault — stacked faceted octahedra
    const vaultBx = ix + gv.vault.x;
    const vaultBz = iz + gv.vault.z;
    const vaultBy = iy + gv.vault.y;

    // flare sprite anchors (vault apex + a couple gem crowns)
    const flares: [number, number, number][] = [[vaultBx, vaultBy + gv.vault.h + 0.5, vaultBz]];
    for (let i = 0; i < 2 && i < gv.gemTrees.length; i++) {
      const t = gv.gemTrees[i * 3 % gv.gemTrees.length];
      flares.push([ix + t.x, iy + t.y + t.h, iz + t.z]);
    }

    const poolW = ix + gv.pool.x;
    const poolH = iz + gv.pool.z;
    const poolY = iy + gv.pool.y + 0.04;

    const marvel = { pos: [ix, iy + geom.capHeightAt(0, 0) + radius * 0.85, iz] as [number, number, number], r: radius * 0.3 };

    return { brass, gems, outc, sparkles, goldMotes, silverMotes, vault: gv.vault, vaultBx, vaultBy, vaultBz, vaultStructureId: gv.vaultStructureId, flares, pool: { x: poolW, y: poolY, z: poolH, r: gv.pool.r }, marvel, radius };
  }, [island, geom]);

  useFrame((st) => {
    const t = st.clock.elapsedTime;

    const sp = sparkleRef.current;
    if (sp) {
      for (let i = 0; i < v.sparkles.length; i++) {
        const s = v.sparkles[i];
        const tw = Math.abs(Math.sin(t * 3 + s.phase));
        tmpM.compose(s.pos, tmpQ.identity(), tmpS.setScalar(s.size * (0.3 + tw)));
        sp.setMatrixAt(i, tmpM);
      }
      sp.instanceMatrix.needsUpdate = true;
    }

    const animMotes = (mesh: InstancedMesh | null, list: Mote[]): void => {
      if (!mesh) return;
      for (let i = 0; i < list.length; i++) {
        const m = list[i];
        const p = (t * m.speed + m.phase) % 1;
        const fade = 1 - Math.max(0, (p - 0.7) / 0.3);
        tmpV.set(m.x, m.baseY + p * m.rise, m.z);
        tmpQ.setFromAxisAngle(tmpS.set(0, 1, 0), t * m.spin + m.phase * 6);
        tmpM.compose(tmpV, tmpQ, tmpS.setScalar(Math.max(0.001, m.size * fade)));
        mesh.setMatrixAt(i, tmpM);
      }
      mesh.instanceMatrix.needsUpdate = true;
    };
    animMotes(goldRef.current, v.goldMotes);
    animMotes(silverRef.current, v.silverMotes);

    const rg = ringRef.current;
    if (rg) {
      for (let i = 0; i < 4; i++) {
        const cyc = (t * 0.3 + i * 0.25) % 1;
        const r = v.pool.r * (0.2 + cyc * 0.8);
        tmpS.set(r, r, 1);
        tmpQ.setFromAxisAngle(tmpV.set(1, 0, 0), -Math.PI / 2);
        tmpM.compose(tmpV.set(v.pool.x, v.pool.y + 0.02, v.pool.z), tmpQ, tmpS);
        rg.setMatrixAt(i, tmpM);
      }
      rg.instanceMatrix.needsUpdate = true;
    }
  });

  const enterVault = (e: ThreeEvent<MouseEvent>): void => {
    e.stopPropagation();
    const cam = useCameraStore.getState();
    if (v.vaultStructureId) cam.inspectStructure(island.id, v.vaultStructureId, [v.vaultBx, v.vaultBy + v.vault.h * 0.6, v.vaultBz]);
    else cam.flyToIsland(island.id, islandCenter(island));
  };

  return (
    <group>
      {/* gem-tree brass + gems */}
      <InstancedPool geometry={cylGeo} material={mats.brass} instances={v.brass} castShadow />
      <InstancedPool geometry={octaGeo} material={mats.gem} instances={v.gems} castShadow />

      {/* crystal outcroppings */}
      <InstancedPool geometry={octaGeo} material={mats.quartz} instances={v.outc} castShadow />

      {/* hero Crystal Vault — stacked faceted glass (click → inspect vault) */}
      <group onClick={enterVault} onPointerOver={(e) => { e.stopPropagation(); document.body.style.cursor = "pointer"; }} onPointerOut={() => { document.body.style.cursor = ""; }}>
        <mesh geometry={octaGeo} material={mats.vault} position={[v.vaultBx, v.vaultBy + v.vault.h * 0.32, v.vaultBz]} scale={[v.vault.w * 1.5, v.vault.h * 0.8, v.vault.w * 1.5]} />
        <mesh geometry={octaGeo} material={mats.vault} position={[v.vaultBx, v.vaultBy + v.vault.h * 0.72, v.vaultBz]} scale={[v.vault.w * 1.0, v.vault.h * 0.6, v.vault.w * 1.0]} />
        <mesh geometry={octaGeo} material={mats.vault} position={[v.vaultBx, v.vaultBy + v.vault.h * 1.05, v.vaultBz]} scale={[v.vault.w * 0.55, v.vault.h * 0.5, v.vault.w * 0.55]} />
      </group>

      {/* liquid-silver pool (planar reflector) + ripples */}
      <mesh geometry={poolGeo} rotation={[-Math.PI / 2, 0, 0]} position={[v.pool.x, v.pool.y, v.pool.z]} scale={[v.pool.r, v.pool.r, 1]}>
        <MeshReflectorMaterial resolution={256} mixBlur={0.6} mixStrength={2.2} blur={[80, 30]} color="#c9d2da" metalness={1} roughness={0.06} />
      </mesh>
      <instancedMesh ref={ringRef} args={[ringGeo, ringMat, 4]} frustumCulled={false} renderOrder={6} />

      {/* sparkle glints + geometric motes */}
      <instancedMesh ref={sparkleRef} args={[octaGeo, sparkleMat, v.sparkles.length]} frustumCulled={false} />
      <instancedMesh ref={goldRef} args={[pyrGeo, goldMoteMat, Math.max(1, v.goldMotes.length)]} frustumCulled={false} />
      <instancedMesh ref={silverRef} args={[tetGeo, silverMoteMat, Math.max(1, v.silverMotes.length)]} frustumCulled={false} />

      {/* fake lens-flare sprites at hero highlights */}
      {v.flares.map((p, i) => (
        <sprite key={i} material={mats.flare} position={p} scale={[v.radius * 0.5, v.radius * 0.5, 1]} />
      ))}

      {/* hero floating $ medallion above the kingdom */}
      <DollarMarvel pos={v.marvel.pos} r={v.marvel.r} env={envMap} />
    </group>
  );
}

/** The hero floating $ — a premium clearcoat-gold 3D symbol revolving upright. */
function DollarMarvel({ pos, r, env }: { pos: [number, number, number]; r: number; env: Texture }) {
  const spinRef = useRef<Group>(null);

  const mats = useMemo(() => {
    // lacquered gold: full metal + clearcoat lobe + soft emissive bloom
    const dollar = new MeshPhysicalMaterial({
      color: "#f6c64e",
      metalness: 1,
      roughness: 0.16,
      clearcoat: 1,
      clearcoatRoughness: 0.05,
      envMap: env,
      envMapIntensity: 1.8,
      emissive: new Color("#ffcf5a"),
      emissiveIntensity: 0.9,
    });
    const aura = new SpriteMaterial({ map: makeAuraTexture(), color: 0xffe8b0, transparent: true, depthWrite: false, blending: AdditiveBlending, opacity: 0.7 });
    return { dollar, aura };
  }, [env]);

  useFrame((st) => {
    const t = st.clock.elapsedTime;
    if (spinRef.current) spinRef.current.rotation.y = t * 0.5;
    mats.dollar.emissiveIntensity = 0.8 + 0.45 * Math.sin(t * 2.2);
  });

  return (
    <group position={pos}>
      <sprite material={mats.aura} scale={[r * 3.4, r * 3.4, 1]} />
      <group ref={spinRef} scale={[r, r, r]}>
        <mesh geometry={dollarArcGeo} material={mats.dollar} position={[0, 0.52, 0]} castShadow />
        <mesh geometry={dollarArcGeo} material={mats.dollar} position={[0, -0.52, 0]} rotation={[0, 0, Math.PI]} castShadow />
        <mesh geometry={barGeo} material={mats.dollar} position={[0, 0, 0]} scale={[0.13, 2.5, 0.13]} castShadow />
      </group>
    </group>
  );
}

/** Crystal-and-glass Finance Kingdom re-skin (island-scoped, visual). */
export default function FinanceLayer({ built }: { built: BuiltIsland[] }) {
  const isles = built.filter(
    (b) => !b.island.locked && CORE_KINGDOM_IDS.includes(b.island.id as CoreKingdomId) && b.island.id === "finance"
  );
  if (isles.length === 0) return null;
  return (
    <group>
      {isles.map((b) => (
        <Finance key={b.island.id} {...b} />
      ))}
    </group>
  );
}
