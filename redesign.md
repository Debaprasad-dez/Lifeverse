

# LifeVerse — Kingdom Environment Upgrade Pass (Phase 11)

All **7 kingdom islands already exist** in your current build (Career, Health, Learning, Finance, Relationship, Creativity, Adventure). This is **not** a "build new islands" pass — it's a **look-and-feel upgrade**: re-lighting, re-skinning, new vegetation/particles/landmarks, and a new ultra-realism layer (materials, atmospherics, post-processing) applied to each existing island, brought in line with the kingdom design brief below.

**Visual references**: the two images attached to this conversation —
1. *"THE CLOUDVERSE DESIGN CATALOG"* (multi-angle island reference sheet)
2. *World overview* (current floating-island cluster + bridges)

Save both as `reference-cloudverse-catalog.png` and `reference-world-overview.png` in your repo root.

---

## 0. Scope Summary

| Kingdom | Existing Island (current build) | Upgrade Focus |
|---|---|---|
| Career | Metropolis Island | Re-light to sunrise/golden-hour, add topiary + mist + airships, ultra-realism pass on glass towers |
| Finance | Crystal Fortress Island | Re-light to harsh noon, add money-tree/crystal formations, gem sparkle + lens-flare realism pass |
| Health | Treehouse Village Island | Re-skin to bioluminescent redwood forest, add Wellness Lake + steam, moss/SSS realism pass |
| Learning | Library & Observation Island | Re-light to perpetual autumn + steampunk fixtures, add tiered steps/archways, hollow-oak Library landmark, falling leaves/runes, volumetric god-ray realism pass |
| Adventure | Volcano & Camp Island | Split into glacier (Quest Port) + volcano (Expedition Camps) biomes, dual-atmosphere realism pass |
| Relationship | Relationship/Blossom Island (existing) | Re-skin to Sakura valley, add interwoven blossom clusters + lanterns + koi pond, warm SSS realism pass |
| Creativity | Creativity/Dreamscape Island (existing) | Re-skin to surreal watercolor dreamscape, add aurora + inverse waterfalls + floating canvases, stylized post-FX pass |

---

## 1. Integration Notes — Read Before Writing Any Code

This spec is **framework-agnostic on purpose**. Your repo already has a working config/typing system for islands from Phases 1–10, and it likely differs from any schema invented fresh here. Do not introduce a parallel/duplicate config system.

### 1.1 Audit step (mandatory, before 11.1)
1. Locate the existing per-island environment definitions (likely candidates: `src/config/islands/*`, `src/data/world.ts`, `src/components/world/islands/*`, or similar — search for the 7 kingdom/island names).
2. Identify how each island currently defines: sky/background, lighting (directional/ambient/hemisphere), fog, ground material, vegetation/props, particles, water, landmarks, ambient audio, and world position.
3. Report back the **actual current shape** (field names, types, file locations) before changing anything.
4. Extend that existing shape with new fields only where genuinely new data is needed (e.g., `auroraBands`, `lavaFissureMask`, `bioluminescence`). Reuse existing field names/conventions (e.g., if lighting is currently `sunLight`, don't rename it to `directionalLight`).

### 1.2 Conceptual data this upgrade needs per island (map onto whatever the existing shape calls these)
- Sky gradient + sun/light-source direction & color
- Directional / ambient / hemisphere / point-light values (color, intensity, position)
- Fog (color, near/far or density), including any per-zone fog overrides
- Ground material (base + secondary color, roughness, metalness, special shader)
- Palette (primary/secondary/accent/highlight hex)
- Vegetation/prop sets (type, count, colors, placement pattern)
- Particle systems (id, count, colors, behavior)
- Water features (shape, color, material props, position/scale)
- Landmark (unique structure component + position/scale)
- Ambient audio track + volume
- **New**: post-processing / ultra-realism layer (see per-kingdom sections) — check whether `@react-three/postprocessing` (or equivalent) is already installed; if not, this is a new dependency to add once, shared across all 7 islands via a single `<EffectComposer>` whose settings swap per active island.

### 1.3 Shared systems to check for before creating new ones
Phases 1–10 may already have some of: instanced vegetation helpers, particle system components, water material components, bridge components. Reuse/extend these. Only create new shared components (`ParticleField`, `AuroraBands`, `WatercolorGround`, etc.) for capabilities that genuinely don't exist yet.

---

## 2. CAREER KINGDOM — Metropolis Oasis

*"Pre-dawn energy, crisp efficiency, polished confidence."* Upgrade target: **Metropolis Island** (existing).

### 2.1 Environment Target
- **Sky**: gradient top `#1B2A4A` → horizon `#FFB35C` → bottom `#FFF4DD` (pre-dawn fading to sunrise gold). Sun low on horizon, direction `[0.85, 0.15, 0.5]`, color `#FFD9A0`.
- **Lighting**: directional `color #FFD9A0`, `intensity 2.2`, `castShadow true`, `shadowMapSize 2048`; ambient `color #4A5A7A`, `intensity 0.4`; hemisphere `sky #87B4FF / ground #2E3A4F`, `intensity 0.6`.
- **Fog**: `color #C9D6E8`, `near 15`, `far 120`, `density 0.015` — low valley mist between towers.
- **Ground**: base `#3F4E5E` (slate pavers) with `#2ECC71` (emerald lawn) in symmetric 6×6-unit courtyard cells, `roughness 0.6`, `metalness 0.1`.
- **Palette**: primary `#4A5568`, secondary `#1E88E5`, accent `#2ECC71`, highlight `#FFD9A0`.
- **Vegetation**: 120 manicured topiary (cones + spheres, `#1F7A4C`/`#2ECC71`) in symmetric grid rows, 2-unit spacing.
- **Particles**: low valley mist (200, white, drift, y 0.5–1.5); airship vapor trails (80, white, trailing flight splines).
- **Water**: reflective courtyard pool, `color #1E88E5`, `metalness 0.9`, `roughness 0.05`.
- **Landmark**: central tapering glass spire (height 18), `MeshPhysicalMaterial` `color #BFE3FF`, `transmission 0.5`, vertical emissive blue strips, 3 orbiting docking airships.
- **Audio**: soft city hum + distant airship engines, `volume 0.3`.

### 2.2 Ultra-Realistic New Elements
- **Glass tower materials**: upgrade all tower facades to `MeshPhysicalMaterial` with `clearcoat 1.0`, `clearcoatRoughness 0.05`, `transmission 0.3`, `ior 1.52` (real glass IOR), and a tiled 4K normal map of subtle window-mullion grids (0.02 unit bevel) so facades catch the sunrise as sharp, elongated highlight streaks rather than flat color.
- **Screen-space reflections (SSR)**: enable SSR (via postprocessing pass) limited to the glass towers and the courtyard pool — sunrise-orange sky should visibly streak across tower glass and ripple faintly on the pool surface.
- **Volumetric sunrise god-rays**: add 6–10 soft volumetric light shafts radiating from the sun position through the gaps between towers, additive-blended, `color #FFD9A0`, opacity fading with distance — sells the "pre-dawn mist" line.
- **Topiary realism**: give topiary foliage a translucent "leaf SSS" shader — thin geometry edges (silhouette against the sun) glow slightly `#3FE08A` to read as living plant material, not solid green plastic.
- **Lawn micro-detail**: 4K tiling grass texture with per-blade normal variance + a fine AO map at lawn/pavement seams so the "incredibly green lawns" read as mowed turf, not a flat green plane.
- **Airship detail**: PBR brushed-aluminum hull (`metalness 0.85`, `roughness 0.35`, anisotropic highlight along hull length) with warm-glow engine nacelles (`emissive #FF9966`, `emissiveIntensity 1.5`) — vapor trails use a soft Gaussian-falloff sprite, additive blend, slight upward buoyancy drift.
- **Post-processing**: `Bloom` threshold 0.85 / intensity 0.4 (catches spire emissive strips + sunrise highlights only); subtle `ChromaticAberration` (offset 0.0008) at frame edges; cool-shadow/warm-highlight color-grade LUT (shadows pulled toward `#2E3A4F`, highlights toward `#FFD9A0`).
- **Audio realism**: position the airship-engine hum as a 3D positional source attached to each airship (falls off over ~30 units), layered under the ambient city-hum bed.

---

## 3. FINANCE KINGDOM — Crystal Desert/Oasis

*"High-value, structure, precision, abundance."* Upgrade target: **Crystal Fortress Island** (existing).

### 3.1 Environment Target
- **Sky**: gradient top `#4FA8FF` → horizon `#FFFFFF` → bottom `#F0FFF8` (harsh brilliant noon). Sun near zenith, direction `[0.2, 0.97, 0.15]`, color `#FFFFFF`.
- **Lighting**: directional `color #FFFFFF`, `intensity 4.5`, `castShadow true`, `shadowMapSize 4096` (sharp shadows); ambient `color #D4F0E8`, `intensity 0.6`; hemisphere `sky #B0E0FF / ground #E8D8A0`, `intensity 0.7`.
- **Fog**: `color #FFFFFF`, `near 50`, `far 300` — minimal, keeps the crystal gleam crisp.
- **Ground**: gold-dust `#E8C84A` blended with silver-dust `#C0C0C8` via noise mask, `roughness 0.3`, `metalness 0.4`, embedded sparkle.
- **Palette**: primary `#FFD700`, secondary `#C0C0C0`, accent `#50C878`, highlight `#B9F2FF`.
- **Vegetation**: 40 "money trees" in 4 clusters — silver octahedron-stack trunks (`#C0C0C0`, `metalness 0.8`); "leaves" are **low-poly origami-fold planes** (flat `PlaneGeometry` with hard mountain/valley creases baked into the vertex normals, folded-paper silhouette) rather than rounded gems, cycling `#50C878 / #B9F2FF / #FFD700`, `metalness 1.0`, `roughness 0.05` — each fold facet catches light at a different angle, like cut paper currency.
- **Crystal formations**: 20 elongated hexagonal-prism clusters along cliffs — quartz `#E8F4FF` (`transmission 0.9`), amethyst `#9966CC` (`transmission 0.7`), **plus emerald clusters `#50C878`** (`transmission 0.75`, `ior 1.58`) and **veins of gold ore** running through the rock faces — thin (0.1–0.3 unit) winding emissive-gold `#FFD700` seams embedded in the cliff geometry via a vein-mask normal/emissive texture, as if the rock has been cracked open to reveal raw gold.
- **Terrain tiers**: the island steps down in 2–3 broad tiers (height drops of 4–6 units each, connected by short cascades) — gold/silver dust ground continues across all tiers.
- **Particles**: gold/silver dust shimmer (400, additive, flicker).
- **Water**: two river variants, both present — a **perfectly clear, shimmering turquoise** channel (`color #40E0D0`, `roughness 0.0`, `metalness 0.0`, `transmission 0.95`, visible pebble/gold-flake bed beneath) on the upper tier, transitioning into the **liquid silver river** (`color #D8D8E0`, `metalness 1.0`, `roughness 0.0`, animated UV flow) that cascades down the tiers to the lowest level.
- **Landmark**: `CrystalSpireCluster` — 5 faceted spires (height 15–25), `transmission 0.85`, pulsing internal emissive `#B9F2FF`.
- **Audio**: crystalline chimes + soft wind, `volume 0.3`.

### 3.2 Ultra-Realistic New Elements
- **Crystal refraction**: every crystal/spire/gem-leaf gets `MeshPhysicalMaterial` with `transmission`, `ior 2.4` (matches real quartz/diamond-cut gems), `thickness 1–3` for internal refraction depth, and `dispersion`-style chromatic edge fringing (if supported, else fake via a thin secondary shell mesh with slight hue offset) — light passing through should visibly bend and split at facet edges.
- **Caustic projections**: project animated caustic light patterns (precomputed caustic texture, scrolling) onto the gold/silver ground beneath each crystal cluster and beneath the liquid-silver river — bright refracted light patches that shift slowly.
- **Specular "lens flare" rig**: real lens-flare post-process (ghosts + halo + streak elements) anchored to the noon sun, intensified when the camera looks toward crystal clusters (their normals reflect sun direction back at camera).
- **Sparkle shader detail**: ground/dust sparkle uses a two-layer normal map (coarse dune ripples + fine glitter-flake micro-normals) so individual flecks catch and lose the sun as the camera moves — not a static shimmer texture.
- **Money-tree gem leaves**: each gem leaf gets a faint per-instance emissive pulse (`emissiveIntensity` 0.2→0.6, randomized phase, period 3–6s) suggesting internal light, plus a thin `clearcoat 1.0` for a "freshly cut" look.
- **Liquid silver river**: `MeshPhysicalMaterial` `metalness 1.0`, `roughness 0.02`, with a scrolling normal map for viscous flow ripples, and SSR enabled so it mirrors the crystal spires above it.
- **Post-processing**: strong `Bloom` (threshold 0.7 / intensity 0.6) tuned to crystal highlights and gem-leaf emissives; minimal vignette; near-zero color grade (this kingdom should look the most "true color, high dynamic range" of all seven).

### 3.3 Progression-Reactive Elements
- **Crystal growth tied to savings/investments**: each `CrystalSpireCluster` spire and each of the 20 cliff crystal formations exposes a `progressScale` and `progressGlow` uniform driven by the user's savings/investment growth metric (e.g., normalized 0–1 against a goal or month-over-month delta).
  - `scale`: lerp from `baseScale * 0.85` (no/negative growth) to `baseScale * 1.25` (strong growth), animated with a slow `damp`/spring (≈2s settle) whenever the underlying value changes — crystals should visibly "grow" rather than snap.
  - `emissiveIntensity`: lerp 0.4 → 1.6 over the same range; at the top of the range, add a brief one-shot sparkle-burst particle puff (20–30 particles, `color #FFD700`/`#B9F2FF`, additive) at the moment growth crosses a milestone threshold.
  - Gold-ore veins in the cliff faces follow the same `progressGlow` value, so a strong-growth state makes the whole island read as "lit from within."
  - Read this value from existing app state (wherever financial-goal progress is already tracked from Phases 1–10) — do not introduce a new data source.

---

## 4. HEALTH KINGDOM — Bioluminescent Forest

*"Fresh mountain air, deep rest, raw energy."* Upgrade target: **Treehouse Village Island** (existing).

### 4.1 Environment Target
- **Sky**: **gentle sunrise↔sunset cycle**, not a fixed afternoon. Two gradient endpoints crossfade slowly (full cycle ≈ several real-time minutes, or tied to the existing day/night system from Phases 1–10 if one exists): sunrise endpoint top `#4A90D9` → horizon `#FFD9B8` → bottom `#EAFBF0`; sunset endpoint top `#6A8FC9` → horizon `#FF9E7A` → bottom `#FFE8D6`. Sun direction slowly arcs low→high→low across the cycle, color crossfades `#FFE8C0` (low) ↔ `#FFF6D8` (high).
- **Lighting**: directional `intensity 3.0` at peak, dimming to `1.4` at cycle endpoints, color follows sun color above, `castShadow true`; ambient `color #6FBF8F`, `intensity 0.5`; hemisphere `sky #87CEEB / ground #2F5233`, `intensity 0.7`.
- **Fog**: base `color #DCEFE3`, `near 20`, `far 150`; localized steam fog around Wellness Lake, `color #E8F5F0`, `density 0.08` within 12 units of lake center.
- **Ground**: moss `#3A5F3A` with deep-moss `#1F3D2B` under canopy, `roughness 0.9`, vertex-displacement "footstep" dimples (depth 0.05, radius 0.4, decay 1.5s) — applies to both moss and the jade-green grass zones (primary palette color `#2F5233`, deep "rich jade" reading).
- **Palette**: primary `#2F5233`, secondary `#9B7EDE`, accent `#2EC4B6`, highlight `#B8FFE0`.
- **Vegetation**: 25 giant redwoods (trunk `#4A3728`, canopy `#2F5233`); 10 weeping willows (`#5B8A5A`) near lake, each trailing **6–10 glowing vines** (thin `TubeGeometry` curves hanging from canopy to ~1 unit above ground, emissive `#9B7EDE`/`#2EC4B6`, `emissiveIntensity` pulsing 0.4–1.0, period 5s, phase-offset per vine); 300 bioluminescent flora instances (`#9B7EDE`/`#2EC4B6`, pulsing emissive 0.5–1.2, period 4s); **8–10 mossy boulder clusters** (`IcosahedronGeometry` low-poly rocks, `color #6B7A5E`, moss-patch decals `#3A5F3A` on upward faces) scattered near the lake and forest edges.
- **Lotus flowers**: 4–6 giant lotus flowers floating on Wellness Lake — layered `ConeGeometry`/petal-plane clusters, 1.5–2.5 unit diameter, colors `#FFB7C5`/`#FFFFFF` with `#FFD700` centers, gentle bob + rotation.
- **Particles**: hot-spring steam (150, rising, around lake); floating spores (80, drifting, `#B8FFE0`).
- **Water**: Wellness Lake, `color #5FBFB3`, `transmission 0.6`.
- **Landmark**: `GreatRedwoodHub` — 50-unit redwood with spiraling rope-bridge platforms lit by bioluminescent flora.
- **Audio**: birdsong + water trickle, `volume 0.4`.

### 4.2 Ultra-Realistic New Elements
- **Subsurface scattering (SSS) foliage**: redwood canopy, willow leaves, and moss all use an SSS-approximation shader (thin translucent shell or `transmission`+`thickness` on `MeshPhysicalMaterial`) so backlit leaves glow jade-green when the sun is behind them — critical for the "splendid ancient forest" read.
- **Bioluminescence as real light sources**: each of the 300 bioluminescent flora instances doubles as a tiny `PointLight` (`color #9B7EDE`/`#2EC4B6`, `intensity 0.15`, `distance 1.5`), batched via light-probe/IBL baking or a custom additive-glow shader if real point lights are too costly — moss and nearby bark should visibly pick up violet/teal rim light at dusk transitions.
- **Moss micro-geometry**: replace flat moss texture with a displaced/tessellated moss shell (height map amplitude 0.03–0.08) plus AO baked into crevices — moss should look soft and three-dimensional up close, not painted.
- **Water caustics + reflection**: Wellness Lake gets projected caustic ripples on the lakebed and surrounding moss, plus real-time reflection of redwood canopy (SSR or a reflection-probe cubemap updated at low frequency).
- **Steam volumetrics**: hot-spring steam upgraded from flat sprites to a layered volumetric fog shader (3–4 noise-driven density layers) that catches the directional sunlight as soft god-rays rising off the lake.
- **Bark & root detail**: redwood trunks get 4K bark normal/displacement with deep furrow shadows; exposed roots at the base use ambient-occlusion-baked crevices so the trunk feels rooted into the moss rather than placed on top.
- **Wind system**: GPU vertex-shader wind sway on all canopy/willow-leaf instances — low-frequency (period ~6s) primary sway + high-frequency flutter, wind direction as a global uniform shared across the island.
- **Post-processing**: gentle `Bloom` (threshold 0.9, intensity 0.25) on bioluminescent glow only; soft `DepthOfField` with focal point tracking the player, shallow background blur through tree trunks for depth; cool-to-warm dappled-light color grade.

### 4.3 Progression-Reactive Elements
- **Stress state → "muted rain" overlay**: when the user's tracked stress level is high, crossfade (≈3–5s) into an alternate environment state:
  - Fog density increases (base `density 0.08` → `0.18`, color shifts toward `#B8C4BE` desaturated gray-green)
  - Ground/foliage colors desaturate ~40% (palette primary `#2F5233` → muted `#5A6B5E`; bioluminescence dims to `emissiveIntensity` 0.1–0.3)
  - Add a light rain particle system (`count 400`, thin streak sprites, `color #C8D8D4`, `behavior: 'fall'`, fast vertical velocity) plus rain-ripple decals on the lake surface
  - Directional light dims (`intensity` ×0.5) and cools toward `#A8C0C8`
  - Reverse the crossfade automatically as stress decreases — this should read as "weather responding to the user," not a hard mode switch.
- **Health-streak → glowing butterflies**: when the user maintains a high health streak, spawn a small flock (6–12) of glowing butterfly meshes (simple double-wing plane geometry, emissive `#B8FFE0`/`#9B7EDE`, flapping animation) that "hatch" — emerge with a brief particle-burst — from the giant lotus flowers and then flutter in loose orbits around the Wellness Lake and willow canopies. Flock size scales with streak length (cap at 12); butterflies fade out gracefully if the streak breaks.
- Both mechanics read from existing user-state tracking (stress/mood and health-streak, from Phases 1–10) — do not introduce new data sources, only new visual responses to existing values.

---

## 5. LEARNING KINGDOM — Steampunk Autumn Highlands

*"Cozy focus, endless discovery, the scent of old paper."* Upgrade target: **Library & Observation Island** (existing).

### 5.1 Environment Target
- **Sky**: gradient top `#5FA8D3` → horizon `#CDE6F5` → bottom `#F2F8FC` (perfectly clear). Sun mid-high, direction `[0.5, 0.7, 0.3]`, color `#FFEFD5`.
- **Lighting**: directional `color #FFEFD5`, `intensity 2.8`, `castShadow true`; ambient `color #A8C4DE`, `intensity 0.45`; hemisphere `sky #6FB8E0 / ground #5C4A3A`, `intensity 0.5`.
- **Fog**: `color #E8E0D0`, `near 30`, `far 180` — subtle golden haze, not heavy.
- **Ground**: flagstone `#B8956A` (1.5-unit tiles, `#8B7355` grout), leaf-pile blend `#C0392B`/`#D35400`/`#E8B84B` along paths, `roughness 0.8`. Terrain is **terraced into 3–4 tiered stone-step levels** (step height 0.4 unit, depth 1.2 units, same flagstone material), connected by short staircases.
- **Palette**: primary `#D2691E`, secondary `#B22222`, accent `#8B7355`, highlight `#FFD700` — **plus steampunk accent** `#B87333` (aged brass/copper).
- **Vegetation**: 18 autumn trees (canopy clusters `#D2691E`/`#B22222`/`#FFD700`/`#CD853F`); 500 leaf-pile instances along path edges with gentle sway.
- **Architecture**: ancient **moss-covered stone archways** (`CylinderGeometry`-based arches, `color #8B7355` with `#3A5F3A` moss-patch decals on shaded faces) span the tiered staircases, framing transitions between levels.
- **Steampunk fixtures**: brass gear decorations (flat `CylinderGeometry` gears with cut teeth, `color #B87333`, `metalness 0.7`, `roughness 0.3`) embedded into archway keystones and the library-tree exterior; copper pipe runs (thin curved `TubeGeometry`, same material) tracing along stone walls between levels; small mechanical lamp-posts (brass housing + warm `emissive #FFD89B` bulb) lighting the staircases at dusk.
- **Particles**: falling leaves (300, sinusoidal drift, respawn at canopy height); drifting glowing runes/parchment (20, `#FFD700` emissive).
- **Water**: optional small reflecting pool near observatory, `color #7FA8C9`.
- **Landmarks**: `ObservatoryDome` — half-dome + angled telescope + broken-column ruins (`#8B7355`); **`KnowledgeLibraryOak`** — a massive hollowed-out ancient oak (trunk diameter ~10 units, height ~30) with a carved interior chamber housing the Knowledge Library, lit warmly from within (`emissive #FFD89B` glow spilling from windows/door cut into the bark), exterior bark inlaid with brass gear/pipe details from the steampunk fixture set above.
- **Audio**: page-turning + wind chimes, `volume 0.3`.

### 5.2 Ultra-Realistic New Elements
- **Volumetric god-rays through canopy**: the "perfectly clear blue sky" directional sun should cast visible light shafts down through gaps in the autumn canopy onto the flagstone — implement as screen-space volumetric light (radial blur from sun screen-position) or layered additive cone meshes.
- **Leaf material realism**: canopy leaves get a two-sided translucent shader (front face saturated amber/crimson, backlit faces brighten toward `#FFD700`) plus per-leaf subtle specular for a "freshly fallen, still glossy" look on the highest branches vs. matte on lower/older foliage.
- **Flagstone PBR**: 4K flagstone diffuse/normal/roughness/AO set with worn-edge variation per tile (some tiles slightly raised/cracked), moisture-darkened grout in shaded areas for age realism.
- **Leaf-pile depth**: path-edge leaf piles use layered instanced leaves at 3 depth tiers (bottom matted/darker `#8B4513`, mid mixed colors, top fresh bright) with AO between layers — piles should read as having volume, not a flat colored patch.
- **Glowing rune detail**: runes get a faint floating dust-mote trail (10–15 tiny additive particles per rune) and a soft ground-projected glow decal beneath them as they drift past.
- **Observatory glass**: telescope lens uses real refractive glass (`transmission 0.9`, `ior 1.5`) with a faint internal star-field reflection; dome material gets weathered-copper-patina texture (`#8FBC8F`/`#B8956A` patches) instead of flat gray.
- **Brass/copper realism**: all steampunk fixtures (gears, pipes, lamp-posts, oak-tree inlays) use `MeshStandardMaterial` `metalness 0.7`/`roughness 0.3` with a patina normal/AO map (verdigris `#8FBC8F` patches in crevices, polished brass `#B87333` on raised edges where hands/light would wear it) — gears get subtle slow rotation (period 20–40s) for "living machinery" ambience without being distracting.
- **Knowledge Library interior glow**: warm `emissive #FFD89B` light spilling from the oak's windows/door casts a soft pool of light onto the surrounding flagstone and leaf piles, with gentle flicker (`emissiveIntensity` 0.9–1.1) suggesting lamplight inside.
- **Post-processing**: warm autumn color-grade LUT (push mids toward `#D2691E`); subtle film-grain (very low intensity, ~0.02) for "old paper" texture feel; `Bloom` threshold 0.95 / intensity 0.2 on rune-glow only; light `Vignette`.

### 5.3 Progression-Reactive Elements
- **Skill mastery → night-sky constellations**: as the user masters skills, a localized **night-dome overlay** activates directly above the island (a secondary sky dome layer, `color #0D1B2A` with `opacity` fading in from 0, positioned only above this island's airspace — does not affect the global daytime sky elsewhere).
  - Within this overlay, render a star-field plus **constellation line-art**: each mastered skill maps to one constellation — small emissive star points (`color #FFD700`/`#FFFFFF`) connected by thin glowing lines (`color #B388EB`, `emissiveIntensity 0.8`), fading in with a soft draw-on animation (~2s) when a new skill is mastered.
  - Constellations accumulate (persisted in existing app state) — the night sky above Learning should visibly fill up over time as a "map of everything you've learned."
  - The overlay is most visible from the `ObservatoryDome` telescope viewpoint; consider a subtle camera-zoom/telescope-view interaction that frames the constellations when the player looks through it.

---

## 6. RELATIONSHIP KINGDOM — Blossom Valley

*"Comfort, connection, shared history, safety."* Upgrade target: **Relationship/Blossom Island** (existing).

### 6.1 Environment Target
- **Sky**: gradient top `#FF8C69` → horizon `#FFB6A3` → bottom `#FFE8D6` (eternal golden-hour sunset). Sun low and warm, direction `[0.9, 0.18, 0.1]`, color `#FF9966`.
- **Lighting**: directional `color #FF9966`, `intensity 2.0`, `castShadow true` (long warm shadows); ambient `color #FFC9A8`, `intensity 0.5`; hemisphere `sky #FFA07A / ground #6B4A6B`, `intensity 0.6`.
- **Fog**: `color #FFD4C4`, `near 25`, `far 140`, `density 0.012` — soft romantic haze.
- **Ground**: warm meadow `#6B8E5A` with fallen-petal carpet `#E8C4D4` under tree clusters, `roughness 0.85`.
- **Palette**: primary `#FFB7C5`, secondary `#FFD89B`, accent `#87A878`, highlight `#FF6B6B`.
- **Vegetation**: 8 clusters of 3–5 interwoven cherry-blossom trees (canopy `#FFB7C5`/`#FFC9DE`/`#FFE0EC`, overlapping by ~30%); 600 wildflower-meadow instances (`#FFD700`/`#FF6B6B`/`#FFB7C5`/`#FFFFFF`).
- **Particles**: falling petals (400, fall + drift + rotate); lantern-glow motes (60, `#FF8C42`, bobbing).
- **Water**: koi pond, `color #4A7A8C`, with 12 lily pads (`#5C8A5C`).
- **Landmarks**: `InterwovenGazebo` — wooden pavilion (`#8B5A2B`) linking blossom clusters, ~30 paper lanterns (`#FFA552` emissive); **`VillageHouseCluster`** — 5–7 small cozy cottages (simple box + steep `ConeGeometry` roof forms, warm wood `#8B5A2B` walls, roofs in `#C76B4A`/`#5C4A33`, glowing window cutouts `emissive #FFD89B`) nestled among the blossom clusters, connected to the gazebo and each other by lantern-lit paths.
- **Audio**: wind chimes + pond ripple, `volume 0.35`.

### 6.2 Ultra-Realistic New Elements
- **Petal SSS + drift physics**: petals get a thin translucent material (`transmission 0.4`, `thickness 0.02`) so backlit petals glow rose-pink against the sunset; falling motion uses layered sine + Perlin-noise drift (not pure gravity) for a "weightless float" feel, with per-petal random rotation axis.
- **Cherry-blossom canopy realism**: replace flat sphere-blob canopies with a two-tone canopy shader — base color `#FFB7C5`, with a secondary `#FFFFFF`-tinted "highlight bloom" layer on the sun-facing side and `#D88AA0` shadow-side tint, plus a fine alpha-cutout texture so canopy silhouettes show individual blossom clusters rather than smooth spheres.
- **Golden-hour volumetric light**: long, soft volumetric shafts streaming horizontally through the blossom clusters from the low sun — these should rake across the meadow and catch falling petals, making them sparkle as they pass through the light.
- **Lantern realism**: each paper lantern gets a warm `emissive #FFA552` core plus a soft external glow halo (additive billboard sprite, radius ~0.6), a subtle flicker (`emissiveIntensity` 0.9–1.1, randomized per-lantern), and a faint warm point-light contribution onto nearby foliage/ground at dusk.
- **Koi pond detail**: add 6–8 animated koi meshes (simple capsule + fin geometry, colors `#FF6B6B`/`#FFFFFF`/`#FFA552`) swimming slow figure-eight paths beneath the surface, visible through a `transmission 0.5` water material with gentle ripple-normal animation and SSR catching the sunset sky + lanterns.
- **Meadow grass realism**: wildflower meadow gets GPU wind-sway (same wind uniform as Health, but gentler amplitude) plus a warm rim-light shader on grass blade tips facing the sun.
- **Post-processing**: warm golden-hour color-grade LUT (lift shadows toward `#6B4A6B`, highlights toward `#FFD89B`); `Bloom` threshold 0.8 / intensity 0.35 on lanterns + sun disc; soft `Vignette` with warm tint; very subtle `ChromaticAberration` (0.0005) for a dreamy "memory" quality.

### 6.3 Progression-Reactive Elements
- **Lanterns light up with social interactions**: all ~30 paper lanterns (gazebo + village paths + blossom clusters) start in a **dimmed/unlit state** (`emissiveIntensity ~0.05`, cool-toned `#8B8090` rather than warm `#FFA552` — read as "paper lantern, no candle yet").
  - Each time the user logs an interaction with a close friend/family member (existing relationship-tracking data from Phases 1–10), one additional lantern transitions to its lit state (`emissiveIntensity` ramps 0.05 → 1.0 over ~1.5s, color shifts to `#FFA552`, plus the small warm point-light/glow-halo from Section 6.2 activates).
  - Lit count is persisted and capped at the total lantern count — order of lighting can follow a fixed sequence radiating outward from the gazebo, so paths between village houses visibly brighten over time as relationships are nurtured.
  - At low lit-counts, the village should feel a little dim/quiet; at full lit-count, every path glows — a clear before/after visual of relationship investment.

---

## 7. CREATIVITY KINGDOM — Surreal Dreamscape

*"Unbounded imagination, color explosion, organized chaos. Physics is optional."* Upgrade target: **Creativity/Dreamscape Island** (existing).

### 7.1 Environment Target
- **Sky**: gradient top `#2D1B4E` → horizon `#FF6EC7` → bottom `#FFD6F5`. No literal sun — 4 shifting aurora bands (`colors [#00FFC8, #FF00E6, #7B2FF7, #FFE5A8]`, heights 30/40/50/60, speeds 0.01–0.03) plus stars visible.
- **Lighting**: 3 orbiting colored point lights — magenta `#FF00E6` (intensity 1.5, orbit radius 25, speed 0.05), cyan `#00FFFF` (intensity 1.5, orbit radius 25, speed -0.04), pastel yellow `#FFF59D` (intensity 1.2, orbit radius 20, speed 0.06); ambient `color #B388EB`, `intensity 0.6`.
- **Fog**: `color #E0C3FC`, `near 10`, `far 100`, `density 0.02` — dreamy soft focus.
- **Ground**: two zones, both present — **watercolor-swirl** shader blending `[#FF6EC7, #7B2FF7, #00FFC8, #FFE5A8]` (`roughness 0.4`, `metalness 0.2`, UV animation speed 0.02/s) in one area, transitioning into a **soft-glowing cloud** zone elsewhere on the island: a volumetric-looking layered cloud shader (puffy `IcosahedronGeometry`-based cloud-cluster ground with soft self-shadowed undersides and `emissive #FFD6E8`/`#B3E5FC` highlights on top), giving the player a choice of "walking on paint" vs. "walking on clouds."
- **Palette**: primary `#FF6EC7`, secondary `#00FFFF`, accent `#FFD6E8`, highlight `#B388EB`.
- **Vegetation**: 15 spiral trees (helix trunks, `#FFB3DE`/`#B3E5FC`/`#D4B3FF`); 90 glowing geometric "fruit" attached near branch tips (octahedron/icosahedron, emissive hue-shift, period 8s → 2s within 5 units of player); **plus 120 floating pastel leaves** — detached, slowly-rotating flat leaf shapes (`PlaneGeometry`, alpha-cutout leaf silhouette) that hover and drift independently of any tree (gentle figure-eight float paths), each cycling through a pastel hue loop (`#FFB3DE → #B3E5FC → #D4B3FF → #FFE5A8`, period 6–10s, randomized phase per leaf).
- **Particles**: aurora bands (sky); inverse waterfalls (200, cyan→white gradient, rising from ground "paint pools" to floating canvases).
- **Water**: 3 swirling "paint pool" shader circles.
- **Landmark**: `FloatingCanvasCluster` — 6 tilted painterly canvases at heights 10–20, fed by inverse-waterfall streams.
- **Audio**: ambient synth pads + glass wind chimes, `volume 0.3`.

### 7.2 Ultra-Realistic New Elements
- **Watercolor ground shader detail**: layer 3 octaves of animated simplex noise (different frequencies/speeds) blended via smoothstep edges that mimic real watercolor "bleed" — add a subtle paper-texture normal map underneath so the ground reads as paint-on-paper rather than a smooth gradient.
- **Aurora realism**: each aurora band is a vertically-undulating ribbon mesh (not a flat plane) with an animated gradient + noise-driven opacity shader, additive blending, and a faint colored-light contribution onto the ground directly beneath each band (large soft `PointLight` or projected gradient decal matching the band's current color).
- **Music-reactive aurora pulsing**: if/when ambient music is playing (check existing audio system for an accessible analyser/amplitude value), drive each aurora band's `opacity`, `emissiveIntensity`, and undulation speed with the music's amplitude/beat — bands should visibly pulse and ripple in time with the ambient track. If no analyser is currently exposed, add a lightweight `AnalyserNode` tap on the existing ambient-audio `AudioContext` rather than building a separate audio pipeline. Fall back to a gentle automatic pulse (period 4s) when no audio is playing.
- **Inverse-waterfall physics**: particles use a custom shader with negative-gravity acceleration, slight horizontal turbulence (curl noise) so streams look organic rather than perfectly straight, plus a soft additive glow trail and faint splash-burst particle clusters where streams meet the floating canvases.
- **Glowing fruit material**: `MeshPhysicalMaterial` with `emissive` driven by an HSL hue-rotation uniform (`uHue` 0→1 loop), `clearcoat 1.0` for a "candy glaze" look, and a soft outer glow sprite that scales with `emissiveIntensity`.
- **Floating canvas detail**: each canvas surface uses a generative painterly shader (animated brush-stroke noise, palette matching the kingdom) with visible "impasto" via a subtle displacement/normal map — canvases should look like living paintings, slowly shifting.
- **Paint pools**: swirling color shader pools get a `transmission`-based depth effect (pool appears to have actual depth with color swirling below the surface) plus small color-pigment particle wisps occasionally rising from the surface.
- **Post-processing**: this is the most stylized kingdom — strong `Bloom` (threshold 0.6 / intensity 0.7) across all emissive/aurora elements; deliberate `ChromaticAberration` (0.002, higher than other kingdoms) for a "dreamlike" wobble; gentle `Bloom`-driven color bleeding between adjacent bright elements (UnrealBloom-style); optional subtle `Glitch`/displacement pulses (very low frequency, ~every 20–30s, barely perceptible) to reinforce "physics is optional."

### 7.3 Progression-Reactive Elements
- **Publish → permanent Neon Monument**: when the user publishes a project (existing publish event from Phases 1–10), trigger:
  1. A **localized color-burst VFX** at a designated "creation point" on the island — a brief (1.5–2.5s) explosion of additive particles in the kingdom palette (`#FF6EC7`/`#00FFFF`/`#FFD6E8`/`#B388EB`), radiating outward and upward, plus a camera-visible flash/`Bloom` spike.
  2. At the end of the burst, **spawn a permanent landmark** — a `NeonMonument` mesh (abstract geometric sculpture: stacked/intersecting torus + icosahedron forms, fully emissive, color derived from a hash of the published project's id/title so each monument is visually distinct) placed at a procedurally-chosen open spot near the creation point.
  - Monuments are **persisted** (localStorage/IndexedDB, per existing no-backend architecture) and re-rendered on every visit — over time, the Creativity island accumulates a visible "skyline" of past creative output, each monument a permanent record of something the user made.
  - Cap visual density gracefully (e.g., beyond N monuments, scale down older ones slightly or arrange in expanding rings) so the island stays navigable as the collection grows.

---

## 8. ADVENTURE KINGDOM — Craggy Frontier

*"Risk, reward, the great unknown, triumph."* Upgrade target: **Volcano & Camp Island** (existing) — split into glacier (Quest Port, west) and volcano (Expedition Camps, east) biomes.

### 8.1 Environment Target
- **Sky**: glacier zone (west) — top `#1A2F4A` → horizon `#4A6FA5` → bottom `#B8D4E8`, stars visible (500); volcano zone (east) — top `#2A1810` → horizon `#FF6B35` → bottom `#FFA552`. Split via world-space X threshold with a 10-unit blended transition band.
- **Glacier sub-zones — "Dream Mountain peak" vs. "Future Observatory"**: the glacier half itself is not visually uniform —
  - **Dream Mountain peak** (far west, highest elevation): active snowstorm — denser snowfall, `density 0.07` fog, sky desaturated toward `#3A4F6A`, reduced visibility, occasional gust-driven whiteout passes.
  - **Future Observatory area** (closer to the transition band, lower elevation): weather clears — `density 0.025` fog, full star-field visible, calmer snowfall (lighter `count`), sky brighter toward `#B8D4E8` — this is where `FutureObservatory` sits.
  - The two sub-zones crossfade over a soft elevation/X gradient — the player should feel they're descending out of a storm into a clear, contemplative overlook.
- **Lighting**: overall directional `color #B8D4FF`, `intensity 0.6` (moonlight, glacier-dominant), `castShadow true`; volcano-side fill via 6 lava-fissure point lights (`color #FF4500`, `intensity 3.0`, `distance 15`); ambient `color #6B7A8C`, `intensity 0.4`.
- **Fog**: glacier `color #D4E8F5`, `density 0.04` baseline (varies by sub-zone per above); volcano `color #4A3528`, `density 0.03` (smoke haze) — same X-threshold split.
- **Ground**: glacier — `#E8F4FF`, `roughness 0.1`, icy specular, dark ice-cave cutouts (`#1A3550`); volcano — obsidian `#2B2421`, `roughness 0.95`, emissive lava-fissure crack mask (`#FF4500`, `emissiveIntensity 2.5`).
- **Palette**: primary `#0D1B2A`, secondary `#FFFFFF`, accent `#FF4500`, highlight `#87CEFA`.
- **Vegetation**: glacier — 12 frost-pines (`#2F4F4F` with `#FFFFFF` snow caps); volcano — 8 charred dead trees (`#1A1410`).
- **Particles**: snowfall (600, glacier-only); embers/ash (300, rising from fissures, volcano-only).
- **Water**: lava river (animated `#FFD700`→`#FF4500`→`#8B0000`); frozen lake (`#B8E0F0`, crack normal map).
- **Landmarks**: `FutureObservatory` (glacier peak, ice-themed dome + telescope, 500-star field); `ExpeditionCampCluster` (5 tents `#C9A876` near fissures).
- **Audio**: wind howl (glacier) crossfading to rumble/crackle (volcano) based on player X position, `volume 0.4`.

### 8.2 Ultra-Realistic New Elements
- **Glacier ice material**: ice surfaces use `MeshPhysicalMaterial` with `transmission 0.6`, `ior 1.31` (real ice IOR), `thickness` variation for visible internal fracture planes (achieved via a layered normal/displacement map simulating subsurface cracks), plus a thin frost-crystal normal overlay that catches starlight as tiny specular points.
- **Snow accumulation**: snow isn't just falling particles — add a thin snow-cap shader layer on all upward-facing surfaces (rocks, tents, trees) on the glacier side, with edge-darkening AO where snow meets rock, and footprint decals (depth-mapped, fading over ~10s) where the player walks.
- **Volumetric snowfall + wind**: snowfall particles get curl-noise wind turbulence (matching a global "blizzard direction" uniform) and occasional gust bursts (brief density spike every 15–25s) — visually distinct from Health/Relationship's gentle particle drifts.
- **Lava realism**: lava river uses a layered shader — base emissive gradient (`#FFD700`→`#FF4500`→`#8B0000`) animated via scrolling noise for flow, a darker "cooling crust" overlay (`#1A1410`, patchy, slowly reforming/breaking), and bloom-driven glow that lights the underside of nearby smoke/ash particles and obsidian ground.
- **Fissure cracks as real light sources**: each of the 6 lava-fissure point lights flickers (`intensity` 2.5–3.5, randomized per-light, ~4–8Hz flicker) and casts dynamic shadows from nearby rocks/tents — fissures should visibly "breathe."
- **Ember/ash particles**: layered system — large slow embers (`#FF6B35`, additive, glow trail, rise + cool to `#8B0000` then fade) plus fine ash (`#4A3528`, smaller, drifts laterally with smoke).
- **Biome transition band**: the 10-unit transition zone gets its own micro-treatment — half-melted snow/ash-streaked rock, steam where lava-warmed ground meets snowmelt, fog color/density cross-fading smoothly rather than cutting.
- **Post-processing**: split-screen-aware grading — cool blue LUT + light `Vignette` on glacier side, warm orange/red LUT + slightly stronger `Bloom` (threshold 0.75/intensity 0.5 on lava+embers) on volcano side, cross-fading across the transition band based on camera X position; subtle film grain on volcano side (ash haze).

### 8.3 Progression-Reactive Elements — "Conquered Territories"
As the user completes/conquers a dream or goal (existing goal-completion event from Phases 1–10), one designated terrain patch on the relevant side transitions permanently from "hostile" to "conquered," unlocking it as a buildable zone:

- **Glacier side — ice melt**: a target ice/snow patch (predefined set of patches, one consumed per conquered goal) plays a melt transition (~4–6s): snow-cap shader fades, ice `transmission`/specular reduces toward 0, surface material crossfades to a wet-rock/grass hybrid (`color #6B7A5E`, `roughness 0.7`), with a brief meltwater-runoff particle trail (small blue streaks flowing toward the nearest edge) during the transition. Frost-pine snow-caps in that patch also melt off.
- **Volcano side — lava cooling**: a target lava-fissure segment plays a cooling transition (~4–6s): emissive `lavaFissure` intensity fades from 2.5 → 0, the crust-overlay shader (Section 8.2) expands to fully cover the segment, ending as solid matte obsidian (`color #2B2421`, `roughness 0.95`, no emissive) — a walkable solid path where there was once an active fissure. A brief steam-burst particle effect marks the moment of cooling.
- **Unlocked "Expedition Camp" zones**: each conquered patch becomes a flat buildable plot. Spawn a small marker/flag (`color` matching the kingdom accent `#FF4500` or highlight `#87CEFA`) indicating the plot is available, then allow the existing `ExpeditionCampCluster` tent/prop set (Section 8.1) to be placed there — either automatically (one tent appears per conquered goal) or via whatever building/placement UI Phases 1–10 already provide.
- **Persistence**: conquered-patch state, melt/cool progress, and placed camp props are all persisted (localStorage/IndexedDB) so the transformed terrain and camps remain across sessions — the island's frontier visibly shrinks and the "settled" footprint visibly grows as the user progresses.

---

## 9. World Layout & Bridges

All 7 islands already exist with positions, radii, and bridges defined from Phases 1–10. **Do not re-derive a new layout from scratch** — read the existing world/layout config first.

- Compare existing island positions/radii against `reference-world-overview.png`. Only adjust if an island's current lighting/fog radius doesn't fully cover its visible geometry (e.g., if Relationship's fog radius is too small once the new blossom clusters extend further than the old geometry did).
- Existing bridges should be re-themed (not rebuilt) to match each kingdom's new palette — e.g., the bridge into Relationship gets a warm lantern-lit treatment, the bridge into Creativity could reuse the `inverse-waterfall` particle system as a "light bridge" effect layered onto the existing bridge mesh.
- If the existing world-level fog/lighting transition doesn't already cross-fade between adjacent islands' configs, add a cross-fade (≈2s) triggered at bridge midpoints so e.g. Finance's harsh noon doesn't hard-cut into Relationship's sunset.

---

## 10. New Shared Components Needed (only if missing)

Audit first — only create what doesn't already exist:

| Component | Purpose | Likely needed for |
|---|---|---|
| `ParticleField` (generic, config-driven) | Reusable particle system (mist, petals, leaves, embers, snow, spores, dust) | All kingdoms |
| `AuroraBands` | Undulating multi-band aurora ribbons with light contribution | Creativity |
| `WatercolorGroundMaterial` | Animated multi-octave noise ground shader | Creativity |
| `LavaFissureMaterial` | Emissive crack-mask shader for obsidian ground | Adventure |
| `MossDisplaceMaterial` | Displaced/tessellated moss with footstep dimples | Health |
| `InverseWaterfall` | Negative-gravity particle stream with curl-noise turbulence | Creativity (and Adventure bridge if reused) |
| `EffectsStack` | Per-island post-processing preset (Bloom/DOF/ChromaticAberration/Vignette/LUT) swapped on active-island change | All kingdoms |
| `SplitBiomeController` | World-space X-threshold blending of sky/fog/lighting/ground/post-FX | Adventure |
| `ProgressionLinkedProp` (generic) | Wraps a mesh/material with `progressValue → {scale, emissiveIntensity, color, visibility}` mappings, reading from existing app-state selectors | Finance (crystal growth), Health (butterflies/fog), Relationship (lanterns), Adventure (conquered territories) |
| `ConstellationOverlay` | Localized secondary night-sky dome + star/line-art renderer, one constellation per mastered skill | Learning |
| `NeonMonument` + monument registry | Procedural emissive sculpture + persisted placement registry, one per published project | Creativity |

Each should accept a config object matching **your existing per-island config shape** (extended per Section 1.2) — not a new bespoke schema. The progression-linked components above all read from **existing** state (savings/investment progress, stress/mood, health streaks, skill mastery, social interactions, goal completions, publish events) — do not create new state sources, only new visual bindings to what already exists.

---

## 11. Implementation Order

Since all islands already exist, kingdoms can be upgraded independently and in any order. Suggested order (simplest → most complex, building shared infra incrementally):

1. **Audit** (Section 1.1) — understand existing config shape, report back
2. **Shared infra** — build/extend `ParticleField` and `EffectsStack` against one kingdom (Career is a good first target: fewer new systems)
3. **Career** (2) — topiary, mist, vapor trails, glass realism
4. **Finance** (3) — money trees, crystal formations, refraction/caustics/lens-flare
5. **Health** (4) — redwoods/willows, bioluminescence, `MossDisplaceMaterial`, SSS
6. **Learning** (5) — autumn trees, falling leaves/runes, god-rays
7. **Relationship** (6) — interwoven blossom clusters, lanterns, koi pond, petal SSS
8. **Creativity** (7) — `AuroraBands`, `WatercolorGroundMaterial`, `InverseWaterfall`, floating canvases
9. **Adventure** (8) — `SplitBiomeController`, lava/ice materials, dual particle systems
10. **World pass** — bridge re-theming, cross-fade tuning, performance audit (instancing, shadow-caster toggling, LOD)

Commit and `/clear` after each numbered step, per your existing workflow.

---

## 12. Claude Code Kickoff Prompt

Use this in your existing repo with `claude --model opus-4-8`, Plan Mode (Shift+Tab):

```
This is LifeVerse — Kingdom Environment Upgrade pass. All 7 kingdom islands
(Career, Health, Learning, Finance, Relationship, Creativity, Adventure)
already exist and are playable. This is a visual upgrade pass, not new
construction — do not change gameplay, AI/OpenRouter, or UI systems.

Before doing anything else:

1. Read CLAUDE.md and LIFEVERSE_KINGDOM_ENVIRONMENTS.md fully.
2. View reference-cloudverse-catalog.png and reference-world-overview.png in
   the repo root for visual ground truth on the current islands and layout.
3. AUDIT the existing codebase: find where each of the 7 islands defines its
   sky, lighting, fog, ground material, vegetation, particles, water,
   landmarks, audio, and world position/radius. Note the exact file paths,
   type/interface names, and field names currently used.
4. Confirm back to me in bullet points: (a) the actual current config shape
   per island, (b) which existing shared components (vegetation, particles,
   water, bridges) can be reused vs. need extending, (c) whether
   @react-three/postprocessing (or equivalent) is already set up, (d) which
   of the "New Shared Components" in Section 10 are genuinely missing, and
   (e) anything in Sections 2-8 that conflicts with what you find in the
   existing code.

Then propose your implementation plan for the FIRST step only: building/
extending the shared ParticleField and EffectsStack infrastructure (Section
10), applied to the CAREER kingdom (Section 2) as the pilot. Match the exact
hex values, light/fog/material parameters, and "Ultra-Realistic New Elements"
described in Section 2 — extend your EXISTING per-island config shape with
these values/fields rather than introducing a new schema. Do not write
production code until I approve the plan. Do not move on to other kingdoms
yet.
```

**Per-kingdom follow-ups** (after the Career pilot is approved and committed), keep these short:

```
Read CLAUDE.md and LIFEVERSE_KINGDOM_ENVIRONMENTS.md, then upgrade the FINANCE
kingdom (Section 3) following the same pattern established for Career — reuse
ParticleField/EffectsStack, extend the existing Finance island config with the
target values and ultra-realistic elements in Section 3. Plan first, then
build. Do not start the next kingdom until I approve this one.
```

Repeat for Health (4), Learning (5), Relationship (6), Creativity (7), Adventure (8), then the World Pass (Section 9, step 10).

---
