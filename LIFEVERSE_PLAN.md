# LifeVerse — Implementation Plan & Architecture

> An immersive 3D life simulation platform. Your life is a living world of floating islands. The world IS the interface — no dashboards, no sidebars, no card grids. Exploration over administration.

Visual north star: the attached floating-island render (Career = neon-tech city island, Health = lush forest island with waterfalls, Learning = library/observatory island) + Stitch design tokens (`DESIGN.md`): Aura Blue `#006688`/`#4fc3f7`, Sunset Gold `#fdd34d`, Mystic Purple `#c8a8ff`, glassmorphic hyper-rounded UI, golden-hour lighting.

---

## 1. Product Principles

1. **World-as-Interface.** Every feature is a *place*, not a page. You fly to your Health island; you don't open a Health tab.
2. **Diegetic-first UI.** Information lives in the world (glowing trees, growing towers, light bridges). 2D UI appears only contextually — anchored to what you clicked, dismissible, never permanent.
3. **Progress = world evolution.** A consistent gym habit doesn't render a chart; it grows the forest, clears the fog, makes the waterfall flow stronger.
4. **Flight as navigation.** Camera moves like Google Earth: cinematic swoops between islands, full 360° orbit around any island, zoom from "whole world" to "single building."
5. **AI as narrator, not renderer.** The AI model only emits structured JSON world state. The frontend World Engine deterministically transforms JSON → visuals. The AI never writes Three.js code at runtime.

### Hard constraints (from brief)
- No traditional SaaS dashboard layouts, no permanent sidebars, no large card grids, no overwhelming HUD.
- 3D canvas occupies ≥ 92% of viewport at all times. Persistent chrome budget: one logo chip, one AI-companion orb, one compass/time pill. Everything else is contextual.
- Every island fully modeled and **traceable 360°** — sculpted undersides (inverted rock cones, hanging roots, crystals, waterfalls falling into cloud), no billboards that break when orbited, no "back side" shortcuts.

---

## 2. High-Level Architecture

```
┌──────────────────────────────────────────────────────────────┐
│  AI Layer (server)                                           │
│  LLM → structured JSON WorldState / WorldDelta (zod-validated)│
└──────────────┬───────────────────────────────────────────────┘
               │ /api/world  /api/simulate  /api/companion
┌──────────────▼───────────────────────────────────────────────┐
│  Next.js App (App Router, TypeScript)                        │
│  ┌─────────────┐  ┌──────────────────┐  ┌─────────────────┐  │
│  │ Zustand     │  │ World Engine     │  │ Contextual UI   │  │
│  │ stores      │→ │ (JSON → scene    │  │ (Framer Motion  │  │
│  │ (world,     │  │ graph resolver)  │  │ overlays,       │  │
│  │ camera, ui, │  └────────┬─────────┘  │ anchored panels)│  │
│  │ quests)     │           │            └─────────────────┘  │
│  └─────────────┘  ┌────────▼─────────┐                       │
│                   │ R3F / Three.js   │  GSAP: camera flights │
│                   │ render layer     │  Framer: DOM UI       │
│                   └──────────────────┘                       │
└──────────────────────────────────────────────────────────────┘
```

**Data flow (one-way):** AI JSON → zod validation → Zustand `worldStore` → World Engine resolves declarative state into scene-graph props → R3F components render → user interaction → store action → (optionally) API call → new JSON delta → animated world transition.

### Directory structure

```
lifeverse/
├─ app/
│  ├─ layout.tsx                  # fonts, providers
│  ├─ page.tsx                    # <WorldCanvas /> full-bleed
│  └─ api/
│     ├─ world/route.ts           # GET current WorldState (AI-generated/persisted)
│     ├─ simulate/route.ts        # POST future-simulation → WorldState variant
│     └─ companion/route.ts       # POST chat → CompanionResponse + WorldDelta
├─ components/
│  ├─ canvas/                     # everything inside <Canvas>
│  │  ├─ WorldCanvas.tsx
│  │  ├─ Sky/  Clouds/  Lighting/  PostFX/
│  │  ├─ islands/                 # IslandRoot + 7 domain composers
│  │  ├─ structures/              # buildings, monuments, landmarks
│  │  ├─ effects/                 # bridges, particles, waterfalls
│  │  └─ camera/                  # CameraRig, FlightController
│  └─ ui/                         # DOM overlay (contextual only)
│     ├─ CompanionOrb.tsx  TimeCompass.tsx  IslandPanel.tsx
│     ├─ QuestScroll.tsx  MemoryViewer.tsx  SimulationLens.tsx
│     └─ primitives/              # GlassPanel, PillButton, LiquidProgress
├─ engine/
│  ├─ schema/                     # zod WorldState schema (single source of truth)
│  ├─ resolver/                   # JSON → render-props (evolution stages, layout)
│  ├─ generation/                 # procedural island/terrain/flora generators
│  └─ materials/                  # toon/gradient shaders, shared materials
├─ stores/                        # worldStore, cameraStore, uiStore, questStore, timeStore
├─ lib/                           # math, seeds, easing, constants
└─ public/models/  public/textures/  public/audio/
```

---

## 3. World State JSON (the AI contract)

The single source of truth. AI produces it; the engine renders it. Validated with zod; versioned for time travel.

```ts
interface WorldState {
  version: string;            // schema version
  timestamp: string;          // ISO — enables time travel
  worldSeed: number;          // deterministic procedural generation
  era: "past" | "present" | "simulated";
  weather: GlobalWeather;     // derived from overall life balance
  islands: Island[];
  bridges: Bridge[];          // cross-domain connections (e.g. Career↔Learning)
  quests: Quest[];
  memories: MemoryLandmark[];
  monuments: Monument[];
  companion: CompanionState;
}

interface Island {
  id: "career" | "health" | "learning" | "relationships"
    | "finance" | "creativity" | "adventure";
  position: [number, number, number];
  level: number;              // 1–10 → island size, structure count
  vitality: number;           // 0–1 → bloom, saturation, particles, weather
  evolutionStage: 1 | 2 | 3 | 4 | 5;   // discrete visual tiers
  structures: Structure[];
  ecosystem: { flora: number; fauna: number; waterFlow: number; fogDensity: number };
  localEvents: WorldEvent[];  // e.g. "new_building_rising", "storm_clearing"
}

interface Structure {
  id: string;
  type: StructureType;        // e.g. "skill_tower", "vitality_tree", "memory_arch",
                              // "goal_beacon", "habit_garden", "project_forge"
  meaning: { label: string; description: string; linkedGoalId?: string };
  growth: number;             // 0–1 → construction/growth animation state
  state: "seed" | "rising" | "complete" | "glowing" | "dormant" | "ruined";
  slot: number;               // resolver maps slot → position on island
}

interface Quest {
  id: string; islandId: string; title: string; narrative: string;
  steps: { label: string; done: boolean }[];
  reward: { type: "structure" | "flora" | "monument" | "bridge"; payload: string };
  status: "available" | "active" | "complete";
}

interface MemoryLandmark {
  id: string; islandId: string; date: string;
  kind: "statue" | "tree" | "mural" | "crystal" | "fountain";
  title: string; story: string;        // shown in contextual panel
}
```

**Rules of the contract**
- AI emits **semantic state only** (levels, stages, meanings) — never positions of vertices, colors, or animation params. The resolver owns aesthetics, so the world always looks art-directed regardless of AI output.
- Updates arrive as `WorldDelta` (JSON-patch-like list of changes). The engine diffs and plays *transition choreography* for each delta type (building rises with dust + GSAP scale-bounce; vitality up → bloom pulse + birds).
- Every state is persisted (per timestamp) → the Time Travel system is just "load snapshot + interpolate camera/world between snapshots."

---

## 4. Scene Hierarchy

```
<Canvas>                                    // R3F root, frameloop="demand" when idle
└─ <WorldScene>
   ├─ <CameraRig>                           // PerspectiveCamera + FlightController
   ├─ <Atmosphere>
   │  ├─ <SkyDome>                          // gradient shader dome (day↔twilight)
   │  ├─ <SunLight>                         // warm directional + shadows (CSM later)
   │  ├─ <AmbientFill> <HemisphereLight>
   │  ├─ <CloudField>                       // ~40 instanced volumetric-ish billboards*
   │  │                                     //   *camera-facing impostors regenerated
   │  │                                     //   per-quadrant so 360° orbit holds up
   │  ├─ <DistantIslands>                   // low-poly background silhouettes (parallax)
   │  └─ <Airships> <Balloons> <BirdFlocks> // ambient life on spline paths
   ├─ <WorldGraph>                          // data-driven from worldStore
   │  ├─ <IslandRoot id="career">           // full 3D: topside + sculpted underside
   │  │  ├─ <IslandBase>                    // procedural rock cone + grass cap + cliffs
   │  │  ├─ <Underside>                     // inverted spires, hanging crystals/roots
   │  │  ├─ <StructureLayer>                // resolver-placed buildings (slot system)
   │  │  ├─ <EcosystemLayer>                // instanced trees/grass/flowers by vitality
   │  │  ├─ <EffectsLayer>                  // waterfalls→cloud, fireflies, god rays
   │  │  ├─ <MemoryLayer>                   // landmarks
   │  │  ├─ <MonumentLayer>                 // achievement monuments
   │  │  └─ <IslandLabel>                   // 3D extruded text à la reference image
   │  ├─ ... (health, learning, relationships, finance, creativity, adventure)
   │  └─ <BridgeLayer>                      // animated light-ribbon arcs between islands
   ├─ <InteractionLayer>                    // raycast targets, hover glow, selection ring
   ├─ <CompanionAvatar>                     // 3D orb/sprite that flies with you
   └─ <PostFX>                              // bloom, vignette, SSAO(soft), DoF on focus
```

**Island identity (matching reference image):**

| Island | Form language | Signature structures | Palette accent |
|---|---|---|---|
| Career | Neon-tech mini-city, gears, holograms | Skill Towers, Project Forge, Promotion Spire | Aura Blue glow |
| Health | Lush forest, waterfalls, giant vitality tree | Vitality Tree, Habit Gardens, Hot Springs | Emerald + green glow |
| Learning | Stone library, observatory domes, flying books | Great Library, Observatory, Skill Shrines | Warm stone + gold |
| Relationships | Village around a heart-tree, lanterns, plazas | Hearth Homes, Bond Bridges, Festival Plaza | Rose / lantern warm |
| Finance | Crystal mine + vault citadel, golden river | Vault Citadel, Crystal Veins, Trade Port | Gold + deep teal |
| Creativity | Floating paint rivers, sculpture garden | Atelier Spire, Muse Fountain, Gallery Grove | Mystic Purple |
| Adventure | Rugged peaks, airship dock, wind banners | Airship Dock, Summit Flags, Expedition Gate | Sunset orange |

---

## 5. Component Hierarchy (React/DOM side)

```
<RootLayout>
└─ <Providers>            // Zustand hydration, theme, sound
   ├─ <WorldCanvas/>      // fixed inset-0, the world
   └─ <UIOverlay>         // pointer-events: none except children
      ├─ <BrandChip/>             // top-left, tiny, glass
      ├─ <TimeCompass/>           // top-right pill: era slider trigger + compass
      ├─ <CompanionOrb/>          // bottom-right floating orb → chat sheet
      ├─ <ContextualLayer>        // AnimatePresence — only one active at a time
      │  ├─ <IslandPanel/>        // glass panel anchored beside focused island
      │  ├─ <StructureSheet/>     // detail sheet when a building is selected
      │  ├─ <QuestScroll/>        // quest UI as unrolling scroll
      │  ├─ <MemoryViewer/>       // story + photo viewer for landmarks
      │  ├─ <SimulationLens/>     // future-sim controls (sliders: habits→2030)
      │  └─ <TimeTravelDial/>     // radial era dial (past⟲present⟲future)
      ├─ <Hints/>                 // ephemeral tooltips ("Double-click to fly")
      └─ <Onboarding/>            // first-run cinematic captions
```

UI rules: every panel is glassmorphic (20–40px backdrop blur, hyper-rounded ≥1.5rem, tinted shadows per DESIGN.md), spring-animated via Framer Motion, anchored to a 3D point via `useAnchor3D` (projects world position → screen px each frame), and auto-dismisses when the camera flies away. Max one primary panel on screen.

---

## 6. Camera System (the core feel)

State machine in `cameraStore`:

```
ORBIT_WORLD ──double-click island──▶ FLY_TO ──▶ ORBIT_ISLAND
     ▲                                              │ click structure
     │◀──────────── ESC / fly out ◀── INSPECT ◀─────┘
CINEMATIC (onboarding, time travel, quest rewards) — interrupts any state
```

- **ORBIT_WORLD**: full 360° azimuth, polar 10°–85°, radius 60–220. Custom damped spherical-coordinate controller (not stock OrbitControls — we need inertia, soft limits, and GSAP interop). Target = world centroid.
- **FLY_TO (Google Earth feel)**: GSAP timeline animating `{radius, azimuth, polar, target}` along a raised arc — pull up & out, glide over clouds, descend onto the island. Duration scales with distance (0.9–2.4s), ease `power3.inOut`, slight FOV breathe (50→56→50), subtle motion blur via velocity-scaled DoF.
- **ORBIT_ISLAND**: target = island center, radius 8–40, polar extended to 120° so you can dip *below* and admire the sculpted underside — this is what makes 360° tracing real.
- **INSPECT**: dolly to framed structure, gentle auto-orbit (0.05 rad/s) while StructureSheet is open.
- **Inputs**: drag = orbit, wheel/pinch = dolly, double-click = fly-to, right-drag = pan (clamped), keys 1–7 = fly to island, `Esc` = zoom out one level. Mobile: one-finger orbit, two-finger pinch/pan, tap-hold = inspect.
- **Collision/comfort**: spring-clamped radius prevents clipping into rock; auto polar-ease keeps horizon pleasant; camera never rolls.

---

## 7. Interaction System

- **Raycast targets, not meshes**: each island/structure registers an invisible simplified hit-proxy (capsule/box) with `useInteractive(id, type)` → cheap, stable raycasts.
- **Hover**: 80ms-debounced ray; hovered island gets rim-light shader boost + label lift + soft cursor change; hovered structure gets outline (postprocess `Outline` pass on selected objects only).
- **Select**: click structure → camera INSPECT + `StructureSheet` opens anchored. Click empty sky → dismiss.
- **Affordance, not chrome**: things that can be interacted with *glow, bob, or sparkle*. Quest-bearing structures get a gold beacon shaft (Sunset Gold). New deltas pulse for 10s.
- **Event bus**: interactions dispatch typed events (`island:focus`, `structure:select`, `quest:accept`) consumed by both UI layer and sound layer. Keeps canvas and DOM decoupled.
- **Accessibility**: full keyboard navigation (tab cycles islands → enter flies), reduced-motion mode (crossfades instead of flights), screen-reader live region narrating focus changes.

---

## 8. World Generation System

Deterministic, seeded, art-directed procedural generation:

1. **Island silhouette**: superellipse base footprint → radial noise (simplex, seeded by `worldSeed + islandId`) → extrude grass cap, sculpt cliff ring, generate inverted underside cone with stalactite clusters. Geometry cached per `(seed, level, stage)` in IndexedDB.
2. **Slot system**: each island exposes a hand-authored slot map (12–24 anchor points with orientation + size class). Resolver assigns `Structure.slot → transform`. This guarantees good composition — procedural placement, art-directed positions.
3. **Structure kit**: each domain has a modular kit (3–6 base meshes + accessory set) authored in Blender, exported as one Draco-compressed GLB per domain with named nodes. `evolutionStage` swaps/extends kit pieces (Stage 1 tent → Stage 3 hall → Stage 5 glowing spire).
4. **Ecosystem density fields**: `vitality` drives instanced flora counts (trees/grass/flowers via `InstancedMesh`, positions from blue-noise sampling on the cap, masked away from slots/paths).
5. **Evolution choreography**: on delta, the engine runs a *Growth Director*: scaffold particles → mesh scales up with elastic GSAP ease → dust puff → light bloom → companion comment. Decay (neglected domains) plays in reverse with fog + desaturation, never punitive-ugly — "sleeping," not "dead."
6. **Future simulation**: `/api/simulate` returns a *parallel* `WorldState` (era:"simulated"). Engine renders it with a dreamlike grade (slight chromatic shift, floating particles, Mystic Purple rim) and the SimulationLens lets users scrub habit sliders → debounced re-simulation.

---

## 9. Rendering Strategy (Pixar-look on a budget)

- **Stylized lighting model**: custom `MeshToonMaterial`-derived shader with 3-band ramp + warm/cool tinting (warm key from sun, cool sky fill), fresnel rim light, and vertex-color AO baked at generation time. Golden-hour: sun at 35°, color `#ffd9a0`, sky gradient `#9ed4ff → #f4faff` (tokens from DESIGN.md).
- **Clouds**: layered approach — (a) far: skybox-painted clouds, (b) mid: ~40 instanced soft impostor puffs with depth-fade shader, (c) near "cloud sea" below islands: animated noise-displaced plane with fluffy SDF-ish shader. All read correctly through 360° orbit because impostors re-sort per frame and have no hard silhouettes.
- **Water/waterfalls**: scrolling-UV foam shader ribbons + particle spray at base, fading into the cloud sea.
- **PostFX chain** (`@react-three/postprocessing`): Bloom (luminance-threshold, drives all "glow" semantics) → soft SSAO (half-res) → DoF (only in INSPECT/flight) → Vignette → subtle filmic tonemap (ACES). One `EffectComposer`, passes toggled by quality tier.
- **Shadows**: single 2048 shadow map following camera focus (only the focused island casts/receives full shadows; others use blob shadows).
- **Text**: 3D island labels via `troika-three-text` with extrude-look shader (matches reference image's chunky labels).

## 10. Optimization Strategy

- **Asset budget**: ≤ 25 MB total GLB (Draco + meshopt), ≤ 80k visible tris typical, ≤ 120 draw calls in ORBIT_WORLD. KTX2 textures.
- **LOD**: 3 levels per island (`<Detailed>`): full kit / merged-simplified / silhouette billboard-with-normal-map for far islands. Structures pop via crossfade, not snap.
- **Instancing everywhere**: flora, rocks, clouds, birds — `InstancedMesh` with per-instance color/phase attributes (wind sway in vertex shader, zero CPU cost).
- **Frameloop discipline**: `frameloop="demand"` when idle (clouds/water keep a low-rate invalidate at 24fps via throttled `invalidate()`); full 60/120fps during flights/interactions. All animation in `useFrame`/GSAP-ticker — never React state per frame.
- **Suspense streaming**: load focused island at full quality first; neighbors stream in `useGLTF.preload` order by camera direction. Skeleton = silhouette islands so the world is never empty.
- **Quality tiers**: auto-detected (GPU tier lib + dynamic resolution scaling). Tier drops disable SSAO → DoF → soft shadows → cloud layer C, in that order.
- **Memory**: dispose island geometry beyond 2-ring distance; texture atlas per domain; share materials via `engine/materials` registry.
- **Perf gates in CI**: Lighthouse + custom r3f-perf budget test (fail build if draw calls/tris exceed budget on the reference scene).

---

## 11. Feature Roadmap

**Phase 0 — Foundation (wk 1–2)**: Repo, Next.js + TS + R3F scaffold, zod WorldState schema + mock JSON, Zustand stores, sky/lighting/cloud sea, one procedural island, camera ORBIT_WORLD + FLY_TO. *Milestone: fly around one beautiful island, 360°.*

**Phase 1 — Seven Islands (wk 3–5)**: All 7 island composers + structure kits (greybox → styled), slot resolver, island labels, bridges, ambient life (airships/birds), contextual IslandPanel + StructureSheet. *Milestone: the reference image, live and orbit-able.*

**Phase 2 — Living World (wk 6–8)**: WorldDelta pipeline + Growth Director (evolution choreography), vitality-driven ecosystems/weather, quest system + QuestScroll, achievement monuments, memory landmarks + MemoryViewer, sound design.

**Phase 3 — Time & Mind (wk 9–11)**: AI companion (orb avatar + chat → WorldDelta), time travel (snapshot store + TimeTravelDial + transition grade), future simulation (SimulationLens + dream grade), onboarding cinematic.

**Phase 4 — Polish & Ship (wk 12–14)**: quality tiers + mobile input polish, accessibility (keyboard/reduced-motion/SR), perf hardening to budgets, persistence/auth, telemetry, beta.

---

## 12. Risks & Mitigations

| Risk | Mitigation |
|---|---|
| AI emits invalid/ugly state | zod validation + resolver owns ALL aesthetics; clamp + fallback to last-good state |
| Pixar-look too heavy | look comes from ramp shading + bloom + palette, not geometry; budget gates in CI |
| 360° underside doubles geo | undersides are low-poly + normal-mapped; shared stalactite instances |
| Scope creep on 7 islands | Phase 1 greyboxes all 7 with shared kit; unique kits added incrementally |
