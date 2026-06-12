# LifeVerse — Complete Claude Code Prompt Pack (Merged Plan, No-Backend Edition)

This document merges the original architecture plan (LIFEVERSE_PLAN.md) with the full product vision (7 core kingdoms + 6 unlockable, AI companion, quests, achievements, memories, time travel, future simulation, world evolution, social, collectibles, seasons, exploration, diegetic analytics, premium).

**Architecture change:** 100% client-side. No backend servers, no API routes, no database.
- **AI:** browser → **OpenRouter** directly (`https://openrouter.ai/api/v1/chat/completions`, OpenAI-compatible, CORS-friendly, user's own OpenRouter key). Free-model fallback chain: `google/gemma-4-26b-a4b-it:free` → `nvidia/nemotron-3-ultra-550b-a55b:free` → `openai/gpt-oss-120b:free` → `openrouter/free`. AI returns structured JSON only.
- **Storage:** `localStorage` (settings, API key [encrypted-at-rest with WebCrypto], UI prefs, onboarding flags) + `IndexedDB` via `idb` (world snapshots for time travel, quests, memories incl. photo Blobs, collectibles, cached geometry).
- **"Social":** export/import world files + shareable read-only world JSON (no servers).

---

## HOW TO USE THIS PACK

1. Scaffold the repo (Prompt 0A below, run yourself in terminal).
2. Put `CLAUDE.md` (Prompt 0B) in repo root, plus `LIFEVERSE_PLAN.md`, the `design/` folder (Stitch export), and your **3D reference images directly in the repo base directory** (e.g. `reference-1.png`, `reference-2.png`...). These renders are the visual ground truth — Claude Code reads images, so phase prompts tell it to study them before building any island or structure.
3. Open `claude` in VS Code terminal. For each phase: enter **Plan Mode (Shift+Tab)** → paste the phase prompt → review plan → approve → verify in browser → screenshot feedback → commit → `/clear` → next phase.
4. Never skip a phase's **Acceptance criteria** — they are your regression checklist.

---

## PROMPT 0A — Scaffold (run in your terminal, not Claude)

```bash
npx create-next-app@latest lifeverse --typescript --app --tailwind --eslint
cd lifeverse
npm i three @react-three/fiber @react-three/drei @react-three/postprocessing \
      zustand gsap framer-motion zod idb troika-three-text
# OpenRouter is called with plain fetch — no SDK needed
npm i -D @types/three r3f-perf
code .
```

## PROMPT 0B — CLAUDE.md (place in repo root)

```markdown
# LifeVerse

Immersive 3D life-sim. The user's real life is a living floating world of
kingdoms. The world IS the interface. Read LIFEVERSE_PLAN.md for architecture;
design/DESIGN.md for color/typography tokens.

## Visual references (MANDATORY)
3D reference renders live as PNG images in the REPO ROOT (reference-*.png /
*.png in base directory) plus design/*.png screen mockups. These are the
visual north star (Pixar / Mario Movie / Zelda Sky Islands / Dreamlight
Valley). Before building or restyling ANY island, structure, sky, cloud, or
lighting, view the root reference images and match their silhouettes,
palette, label style, cloud shapes, and golden-hour mood. When the user says
"match the reference," compare your output against these images.

## Absolute rules
- NO backend. No API routes, no servers. Client-only Next.js (static export).
- AI = direct browser fetch to OpenRouter ONLY
  (https://openrouter.ai/api/v1/chat/completions, OpenAI-compatible chat
  format). User's OpenRouter key stored encrypted in localStorage via
  WebCrypto. Model fallback chain, in order:
    1. google/gemma-4-26b-a4b-it:free
    2. nvidia/nemotron-3-ultra-550b-a55b:free
    3. openai/gpt-oss-120b:free
    4. openrouter/free
  On 429/5xx/timeout/invalid-JSON → try next model. Free models are weak at
  strict JSON: always request JSON-only in the prompt, strip markdown fences,
  zod-parse, one repair retry, then local template fallback. AI emits ONLY
  zod-validated JSON (WorldState / WorldDelta / CompanionMessage). Engine
  owns ALL aesthetics.
- Persistence: localStorage (settings/prefs/flags) + IndexedDB via `idb`
  (world snapshots, quests, memories w/ photo Blobs, collectibles).
- NO dashboards, sidebars, card grids, charts, or persistent HUD. Canvas ≥92%
  of viewport. All UI contextual, glassmorphic, anchored to 3D points,
  one primary panel max, auto-dismiss on camera flight.
- Analytics are diegetic ONLY: building size, ecosystem health, traffic,
  lighting, weather — never charts.
- Islands traceable 360°: sculpted undersides, no broken billboards.
- Per-frame animation in useFrame/GSAP ticker only. Never React state per frame.
- Deterministic procedural generation: seeded by worldSeed + kingdomId.

## Stack
Next.js App Router · TypeScript strict · R3F · drei · @react-three/postprocessing
· GSAP (camera/world choreography) · Framer Motion (DOM UI) · Zustand · zod ·
idb · troika-three-text

## Verify before declaring done
npm run lint && npx tsc --noEmit && npm run dev (visual check)
```

---

# PHASE 1 — FOUNDATION: SKY, FIRST ISLAND, FLIGHT
*(paste into Claude Code, Plan Mode first)*

```
Read LIFEVERSE_PLAN.md and design/DESIGN.md fully, then VIEW every 3D
reference image in the repo base directory (*.png) before planning. Match
their sky gradient, cloud shapes, island silhouettes, and lighting mood.

Build the LifeVerse foundation:

1. APP SHELL
- Static-export Next.js App Router app. app/page.tsx renders <WorldCanvas/>
  fixed inset-0 plus <UIOverlay/> (pointer-events:none container).
- Load fonts: Plus Jakarta Sans (headings), Be Vietnam Pro (body),
  Quicksand (labels). Tailwind theme extended with all DESIGN.md color tokens.
- Persistent chrome ONLY: tiny glass BrandChip (top-left), TimeCompass pill
  (top-right, placeholder), CompanionOrb (bottom-right, placeholder).

2. ATMOSPHERE
- SkyDome: custom gradient shader (zenith #9ed4ff → horizon #f4faff), warm
  golden-hour sun (directional, color #ffd9a0, elevation ~35°), hemisphere fill.
- CloudField: ~40 instanced soft cloud impostors with depth-fade, slow drift,
  re-sorted per frame so 360° orbit never breaks.
- CloudSea: animated noise-displaced plane far below islands; waterfalls will
  fall into it.
- PostFX: Bloom (luminance threshold), Vignette, ACES tonemap via
  @react-three/postprocessing. Single EffectComposer.

3. FIRST ISLAND (procedural, seeded)
- engine/generation/island.ts: superellipse footprint + simplex radial noise →
  grass cap, cliff ring, and a sculpted inverted underside cone with
  stalactite rock clusters (instanced). MUST look good from below.
- Stylized look: 3-band toon ramp material with fresnel rim light, vertex AO.
- One waterfall ribbon (scrolling UV shader) falling into the cloud sea.
- 3D extruded-look island label via troika-three-text.

4. CAMERA SYSTEM (stores/cameraStore.ts + components/canvas/camera/)
- State machine: ORBIT_WORLD → FLY_TO → ORBIT_ISLAND → INSPECT (per
  LIFEVERSE_PLAN.md §6). Custom damped spherical controller (NOT stock
  OrbitControls): inertia, soft radius/polar clamps, GSAP-interruptible.
- ORBIT_ISLAND polar extends past 90° (to ~120°) so the user can dip below
  and orbit the underside — full 360° traceability.
- FLY_TO: GSAP timeline on {radius, azimuth, polar, target} along a raised
  arc, duration 0.9–2.4s by distance, power3.inOut, FOV breathe 50→56→50.
- Inputs: drag orbit, wheel/pinch dolly, double-click fly-to, Esc zoom out,
  mobile one-finger orbit / pinch.

5. PERSISTENCE SKELETON
- lib/storage.ts: typed localStorage wrapper (settings, flags).
- lib/db.ts: idb database `lifeverse` v1 with stores: snapshots, quests,
  memories, collectibles, meta. No data yet — just the layer + types.

Acceptance criteria:
- 60fps desktop orbit; island beautiful from EVERY angle incl. directly below.
- Double-click island → cinematic Google-Earth-style flight; Esc → fly out.
- No layout shift, no sidebar, no dashboard. Canvas fills viewport.
- npm run lint && npx tsc --noEmit pass. Add r3f-perf behind ?debug=1.
```

---

# PHASE 2 — WORLD STATE SCHEMA, PERSISTENCE & SEVEN KINGDOMS

```
Implement the data heart of LifeVerse, then grey-box the full archipelago.

1. SCHEMA (engine/schema/world.ts — single source of truth, zod)
Implement WorldState per LIFEVERSE_PLAN.md §3, EXTENDED with the full
product vision:
- KingdomId: career | health | learning | finance | relationships |
  creativity | adventure, plus unlockable: business | family | mindfulness |
  community | travel | legacy. Unlockables have locked:true and render as
  distant fog-shrouded silhouettes until unlocked.
- Island: position, level 1–10, vitality 0–1, evolutionStage 1–5,
  structures[], ecosystem {flora, fauna, waterFlow, fogDensity, weather},
  population, trafficFlow, lightingIntensity (diegetic analytics inputs).
- StructureType catalog per kingdom (career_tower, promotion_hall,
  skill_academy, leadership_castle, opportunity_harbor, mentor_observatory,
  project_museum; fitness_forest, habit_garden, wellness_lake,
  energy_mountain, meditation_sanctuary, recovery_center, nutrition_village;
  knowledge_library, research_observatory, skill_tower, wisdom_temple,
  learning_academy, scholar_hub, discovery_forest; merchant_harbor,
  investment_tower, asset_vault, income_district, business_plaza,
  savings_fortress; family_village, friendship_district, relationship_bridge,
  community_square, memory_garden, celebration_plaza; art_studio, music_hall,
  film_theater, idea_factory, dream_workshop, innovation_lab; quest_port,
  expedition_camp, dream_mountain, exploration_isle, future_observatory).
- Bridges (kingdom↔kingdom, strength 0–1), quests, memories, monuments,
  collectibles (creatures, artifacts, relics, hidden_isles), season
  (spring|summer|autumn|winter), worldEvents, companion state.
- WorldDelta: typed change list (structure_added, structure_grown,
  vitality_changed, bridge_strengthened, monument_erected, creature_unlocked,
  weather_changed, district_unlocked, island_unlocked...).

2. PERSISTENCE
- stores/worldStore.ts (Zustand): holds WorldState; applyDelta(delta) diffs
  and emits engine events. Autosave: debounced full snapshot →
  IndexedDB `snapshots` keyed by ISO timestamp (this powers time travel).
  Keep last 200 snapshots + daily compaction. localStorage holds
  lastSnapshotId for instant boot.
- Seed: rich mock WorldState fixture covering all 7 core kingdoms at varied
  levels/stages so the world is interesting on first run.

3. SEVEN KINGDOMS GREYBOX
- Resolver (engine/resolver/): maps WorldState → render props. Hand-authored
  slot maps (12–24 anchors per island, position+rotation+size class).
  Structures = grey primitive kit per type for now (distinct silhouettes:
  towers, halls, domes, gardens) scaled by growth & evolutionStage.
- Layout: 7 islands arranged per the reference render — varied heights/radii,
  Career (tech-blue), Health (green), Learning (stone-gold) prominent.
- BridgeLayer: animated light-ribbon arcs (additive shader) whose thickness/
  glow = bridge strength. Six locked kingdoms as distant silhouettes.
- Keyboard 1–7 flies to each kingdom; labels on all islands.

Acceptance criteria:
- World boots from IndexedDB snapshot if present, else fixture.
- Editing fixture JSON (level/vitality/structures) visibly changes the world
  after reload — schema drives EVERYTHING.
- Fly to all 7 kingdoms; orbit each fully incl. undersides; 60fps desktop,
  ≤120 draw calls in ORBIT_WORLD (verify with r3f-perf).
```

---

# PHASE 3 — KINGDOM IDENTITY & DIEGETIC ANALYTICS

```
Replace greyboxes with art-directed identity per kingdom. FIRST view all 3D
reference images in the repo base directory — every kingdom below must match
their style (chunky stylized forms, saturated accents, glowing labels,
sculpted undersides). Keep everything procedural/parametric (no external
GLBs yet — build a parametric mesh kit).

1. PARAMETRIC STRUCTURE KIT (engine/generation/structures/)
Composable primitives (toon-shaded, beveled, hyper-rounded per DESIGN.md):
stackable tower segments, domes, arches, crystal clusters, tree archetypes
(broadleaf, pine, willow, glowing vitality tree), gear/hologram props,
banners, lanterns, bookstacks, water features. Each StructureType =
recipe composing primitives; evolutionStage 1–5 adds tiers/props/glow.

2. KINGDOM DRESSING (match the reference render + vision doc)
- CAREER: neon-tech mini-city — Career Tower (grows with level), Promotion
  Hall, Skill Academies, Leadership Castle, Opportunity Harbor with arriving
  AIRSHIPS (spline paths; each airship = an opportunity), Mentor Observatory,
  Project Museum. Aura-blue emissive windows, slow-rotating gears, holograms.
- HEALTH: Fitness Forest (tree count/size = exercise), Habit Gardens (one
  bed per habit, bloom = streak), Wellness Lake, Energy Mountain, Meditation
  Sanctuary, Recovery Center, Nutrition Village. LOCAL WEATHER: low vitality
  → fog + storm clouds over THIS island only; high → god rays, butterflies.
- LEARNING: Knowledge Library (shelves extend per book), Research
  Observatory, Skill Towers (one per skill, height = mastery), Wisdom Temple,
  Scholar Hub, Discovery Forest, FLYING BOOKS particle system.
- FINANCE: Merchant Harbor with boats on a golden river (flow rate = income),
  Investment Tower, Asset Vault, Income District, Business Plaza, Savings
  Fortress (walls thicken with savings). Visible TRADE ROUTES (glowing
  streams) to other kingdoms.
- RELATIONSHIPS: Family Village (one hearth-home per person), Friendship
  District, Community Square, Memory Gardens, Celebration Plaza, heart-tree
  centerpiece, floating lanterns. Bond bridges to people-landmarks.
- CREATIVITY: paint-river (animated rainbow shader), Art Studios, Music Hall
  (emits note particles), Film Theater, Idea Factory (lightbulb chimney
  puffs), Dream Workshop, Innovation Lab. Mystic Purple accents.
- ADVENTURE: rugged peaks, Quest Port with airship dock, Expedition Camps,
  Dream Mountains (one peak per major dream — flag plants on completion),
  Exploration Isles, Future Observatory. Sunset-orange banners in wind
  (vertex shader sway).

3. DIEGETIC ANALYTICS (engine/resolver/analytics.ts)
Map data → world ONLY (never charts): level→island radius & structure count;
vitality→saturation/bloom/flora density; population→walking villager
sprites/impostors; trafficFlow→airship+boat frequency; lightingIntensity→
window emissive at dusk; bridge strength→ribbon thickness; weather per
ecosystem state.

4. AMBIENT LIFE: birds flocking (instanced boids-lite), airships between
kingdoms, balloons, fireflies at dusk, walking villagers on paths.

Acceptance criteria:
- Each kingdom instantly recognizable in one screenshot; matches reference
  render mood (bright sky, big clouds, warm light, playful-premium).
- Changing any numeric field in WorldState produces a visible world change.
- LOD: 3 tiers per island; budget ≤80k visible tris typical view.
```

---

# PHASE 4 — INTERACTION & CONTEXTUAL UI

```
Make the world touchable. UI appears ONLY in context, anchored to 3D.

1. INTERACTION LAYER (per LIFEVERSE_PLAN.md §7)
- useInteractive(id, kind): registers invisible hit-proxies (capsule/box).
- Hover: debounced ray → rim-light boost + label lift; structures get
  selective Outline postprocess pass. Cursor: pointer-grab states.
- Click structure → camera INSPECT (dolly + slow auto-orbit) + StructureSheet.
- Click sky/empty → dismiss everything, return to previous camera state.
- Typed event bus: island:focus, structure:select, quest:accept, etc.

2. CONTEXTUAL UI (components/ui/, Framer Motion, glassmorphic per DESIGN.md:
   20–40px backdrop blur, radius ≥1.5rem, tinted shadows, pill buttons with
   bottom-heavy 3D border, liquid-light progress tubes)
- useAnchor3D(worldPos): projects to screen px each frame; panels track
  smoothly and auto-flip to stay on screen.
- IslandPanel (on island focus): kingdom name, level, "Kingdom Stats" as
  liquid-light tubes (Aura Vitality / sync / bloom — styled like the Stitch
  global-map screen), active quests count, Enter button.
- StructureSheet (on structure select): meaning.label, story/description,
  growth state, linked goal, actions (Upgrade via quest, View memory).
- Spatial audio + UI sounds: soft whooshes on flight, chimes on select
  (Howler or WebAudio; all optional, mute in settings).
- Onboarding cinematic: first run flies through all kingdoms with caption
  overlays, ends at world orbit. Skippable. Flag in localStorage.

3. SETTINGS SHEET (from BrandChip): OpenRouter API key entry (stored
encrypted via WebCrypto AES-GCM, key derived from a device secret in
localStorage), model picker defaulting to the free fallback chain from
CLAUDE.md, quality tier, sound, reduced motion. NO account/login — fully
local.

Acceptance criteria:
- Max ONE primary panel ever on screen; all panels die when camera flies.
- Full keyboard path: Tab cycles islands, Enter flies, Esc backs out.
- prefers-reduced-motion → crossfades replace flights.
- Still no dashboard. Still ≥92% canvas.
```

---

# PHASE 5 — WORLD EVOLUTION ENGINE & LIFE SETUP

```
The world must now GROW from real life data. All local, no backend.

1. LIFE SETUP (one-time, in-world)
- "World Genesis" flow: companion orb asks 8–12 friendly questions (career
  stage, health habits, skills, goals, key people, finances rough-level,
  creative projects, dreams). Presented as a conversational glass sheet,
  NOT a form wizard. Answers → initial WorldState via deterministic mapper
  (engine/genesis.ts) — works fully offline without AI; if an API key is
  present, optionally enrich via LLM (see Phase 7 contract).
- World "grows in" from bare rocks: Growth Director choreographs genesis
  (islands rise from cloud sea one by one, structures sprout) — GSAP master
  timeline, skippable.

2. CHECK-INS & ACTIONS (stores/lifeStore.ts)
- Lightweight in-world logging: from a kingdom's IslandPanel the user logs
  events ("worked out", "read 30 min", "saved $X", "called Mom", "shipped
  project"). Each maps to typed LifeEvent → WorldDelta rules
  (engine/evolution/rules.ts):
  exercise→flora+vitality up; reading→library shelf extends; saving→
  fortress walls + infrastructure; skill practice→tower segment; outreach→
  bridge strength; shipping→museum exhibit. Neglect decay: gentle fog +
  desaturation ("sleeping", never punitive), one nudge quest spawned.
- Streak engine: consecutive-day streaks per habit → rare visual rewards
  (golden leaves, aurora, rare creature spawn hook for Phase 8).

3. GROWTH DIRECTOR (engine/evolution/director.ts)
- Consumes WorldDelta queue; per delta type plays choreography: scaffold
  sparkles → elastic scale-up → dust puff → bloom pulse → optional companion
  toast. Batches simultaneous deltas into one cinematic if >3.
- Every applied delta autosaves a snapshot (time-travel granularity: daily
  compaction + every "significant" delta).

Acceptance criteria:
- Fresh browser profile → Genesis → personalized 7-kingdom world, no network.
- Logging events visibly evolves the world within 2s with choreography.
- Reload restores exact world from IndexedDB. Export/Import world JSON file
  works (this is also the social-share primitive).
```

---

# PHASE 6 — QUESTS, ACHIEVEMENTS & MEMORIES

```
1. QUEST SYSTEM (replaces task management)
- Quest model (already in schema): narrative framing — every goal is an
  Expedition / Treasure Hunt / Construction Project / Kingdom Restoration /
  Discovery Journey. Steps, XP, rewards (structure, flora, monument, bridge,
  creature, relic).
- In-world presentation: quest-giving structures emit Sunset-Gold beacon
  shafts. Quest Port (Adventure) lists active expeditions as docked airships.
- QuestScroll UI: unrolling parchment-style glass panel (Framer) showing
  narrative, steps as checkable runes, reward preview. Completing final step
  → camera flies to reward site → Growth Director builds the reward live →
  fanfare.
- Quest creation: user creates goals via companion sheet ("I want to learn
  React") → local template engine converts to quest with themed narrative +
  milestone steps (LLM-enrichable later, must work offline).

2. ACHIEVEMENT MONUMENTS
- Permanent landmarks for major achievements (graduation, promotion,
  marriage, business launch, fitness milestone, certification). Monument
  styles: obelisk, statue, arch, eternal flame, crystal spire. Plaque on
  inspect (date + story). Never deletable; time travel shows their absence
  in the past.

3. MEMORY SYSTEM
- Add memories: photo upload (stored as Blob in IndexedDB), title, date,
  story, kingdom. Becomes a physical place: museum, monument, garden,
  statue, or memory temple (user picks or auto by kind).
- MemoryViewer: inspect → glass gallery with the photo(s), story text,
  date — "walking through memories". Memory Gardens in Relationships
  cluster shared-people memories.
- XP & LEVELING: XP from quests/streaks/logging → kingdom level-ups →
  evolutionStage thresholds → resolver upgrades island (bigger cap, new
  district ring). Level-up = cinematic moment.

Acceptance criteria:
- Create goal → themed quest appears in-world; complete it → reward builds.
- Upload a photo memory → landmark exists; revisit and view it.
- Achievements persist across reload and appear in correct historical
  snapshots only.
```

---

# PHASE 7 — AI COMPANION (CLIENT-SIDE LLM)

```
No chatbot page. The AI is a living companion in the world.

1. COMPANION AVATAR
- Glowing orb-spirit (layered fresnel shells + trail particles + soft
  light) that idles near the camera, flies ahead during FLY_TO, perches
  near focused structures. Personality states: idle bob, excited spin
  (celebrations), thinking shimmer (LLM pending).

2. LLM SERVICE (lib/ai/openrouter.ts + lib/ai/companion.ts — STRICT CONTRACT)
- Plain fetch POST to https://openrouter.ai/api/v1/chat/completions with
  Authorization: Bearer <key from encrypted localStorage>, plus
  HTTP-Referer + X-Title headers (OpenRouter attribution). OpenAI chat
  format. Model fallback chain (config in lib/ai/models.ts):
    google/gemma-4-26b-a4b-it:free →
    nvidia/nemotron-3-ultra-550b-a55b:free →
    openai/gpt-oss-120b:free → openrouter/free
  Retry policy: on 429/5xx/timeout/unparseable output → next model in chain.
  Request response_format {type:"json_object"} when supported; ALSO instruct
  JSON-only in the prompt and strip ```json fences before parsing (free
  models are inconsistent). Graceful no-key mode: companion falls back to
  local template responses everywhere.
- System prompt: companion is coach/guide/quest-giver/narrator. It receives
  a COMPACTED world summary (engine/ai/summarize.ts: levels, vitality,
  streaks, active quests, recent events — never raw geometry) and MUST
  return ONLY JSON matching zod CompanionResponse:
  { say: string,                      // ≤2 sentences, warm, narrator-voice
    mood: "celebrate"|"encourage"|"advise"|"neutral",
    suggestions?: QuestSuggestion[],  // growth paths → user approves → quest
    deltas?: WorldDelta[] }           // engine validates + clamps EVERYTHING
- Validation pipeline: parse → zod → clamp ranges → drop unknown deltas →
  apply via Growth Director. AI can never directly touch the scene.

3. COMPANION TOUCHPOINTS
- Daily greeting (first open of day): observes world, narrates ("Your
  Fitness Forest grew three trees this week"), offers 1–2 suggestions.
- Quest giver: converts user goals into narrated quests (enriches Phase 6
  templates). Celebration: flies to completed reward, spin + confetti.
- Opportunity detection: periodic local heuristics (stale kingdom, broken
  streak, unbalanced world) → companion nudge; LLM phrases it if available.
- Chat sheet (from orb tap): conversational glass sheet anchored to orb —
  short exchanges, every reply may carry suggestions/deltas. History in
  IndexedDB, summarized after 50 turns.

Acceptance criteria:
- With no API key: everything still works (template mode).
- With key: responses always validate; malformed JSON → repair retry →
  next model in fallback chain → template fallback. Key never leaves the
  browser except to OpenRouter. No other network calls in the entire app.
- Kill any model in the chain (simulate 429) → next model transparently
  takes over; UI never shows a raw error.
```

---

# PHASE 8 — TIME TRAVEL & FUTURE SIMULATION

```
1. TIME TRAVEL (IndexedDB snapshots from Phase 2/5)
- TimeTravelDial: radial glass dial from TimeCompass — scrub Past⟲Present.
  Scrubbing previews snapshot dates; release → world morphs: Growth
  Director plays diffs REVERSED for back-travel (buildings sink, trees
  shrink) with a sepia-warm grade + drifting motes. Banner chip shows
  "Viewing: March 2026 — read-only". Esc returns to present.
- Replay Mode: "Watch your year" — camera auto-tours kingdoms while
  snapshots interpolate chronologically; companion narrates milestones
  (local template narration; LLM-enrich if key).
- Compare: split-lens slider (clip-plane or dual-viewport) past vs present.

2. FUTURE SIMULATION (flagship)
- Future Observatory (Adventure Kingdom) is the entry point — fly there
  to open SimulationLens.
- SimulationLens: horizon picker (1y/5y/10y/20y) + habit sliders
  (exercise/wk, learning hrs, savings rate, outreach/wk, creative hrs).
- Engine: deterministic local projection model (engine/simulation/
  project.ts) compounds current levels+streaks+slider deltas →
  era:"simulated" WorldState (new districts, taller towers, dream
  mountains conquered, possible decay branches). LLM optional: narrate
  the future + propose 2 alternative scenario twists (validated JSON).
- Render: dreamlike grade — Mystic Purple rim, slight chromatic aberration,
  floating particles, des/saturated push by optimism score. Explorable
  exactly like the present world. "Alternative futures" tabs (A/B/C).
- "Chart the path": from any simulated structure, generate the quest chain
  that would realize it → adds quests to present world.

Acceptance criteria:
- Past/present/future all explorable 360°; era always unmistakable from
  grade + banner. Simulated worlds never overwrite present state.
- Slider changes re-simulate (debounced 400ms) with smooth morph.
- 20-year sim with maxed sliders stays within perf budgets.
```

---

# PHASE 9 — COLLECTIBLES, SEASONS, EXPLORATION & SOCIAL

```
1. COLLECTIBLES
- Rare creatures (stylized low-poly spirits: cloud whale, glow fox, book
  owl, koi dragon...) unlocked by streaks/quests; they LIVE in kingdoms
  (idle animation loops, wander paths). Creature codex sheet (contextual,
  from Discovery Forest). Ancient artifacts & achievement relics displayed
  in Project Museum / Wisdom Temple pedestals. Hidden islands: 2–3 tiny
  secret isles in far clouds — found only by exploring (proximity reveal),
  grant cosmetics.
- Seasonal rewards rotate via local clock.

2. SEASONS & EVENTS (engine/seasons.ts, local clock driven)
- Spring/Summer/Autumn/Winter: global palette LUT shift, foliage swap
  (instanced color attribute), snow caps/falling leaves/blossom particles,
  cloud-sea tint. Smooth 2-week transitions.
- Festivals: birthdays (from profile) → Celebration Plaza fireworks + cake
  monument for the day; life anniversaries (from achievement dates) →
  lantern festival at that monument; seasonal world festival dressing.

3. EXPLORATION REWARDS
- Fog-of-wonder: unvisited regions slightly misty; visiting clears it
  permanently (visited-set in IndexedDB). First-visit sparkle + XP.
  Secret landmarks log into an Explorer's Atlas sheet. Walk mode:
  optional low-altitude glide camera (WASD) on island caps.

4. SOCIAL (no servers)
- Export "World Card": share file (.lifeverse JSON, photos optional) +
  a rendered snapshot PNG (canvas capture with title overlay).
- Import & visit: load a friend's file → read-only visit mode (their world,
  banner chip, no editing). Side-by-side compare lens vs your world.
- Unlockable kingdoms: Business/Family/Mindfulness/Community/Travel/Legacy
  unlock via level/quest thresholds — island rises from clouds cinematic;
  each gets a starter structure set (reuse parametric kit, distinct accent).

Acceptance criteria:
- Creatures animate at distance LOD-cheap; codex tracks finds.
- Season change visibly transforms the whole world; festivals trigger on
  correct local dates. Friend-world import is fully sandboxed (never
  touches own snapshots).
```

---

# PHASE 10 — POLISH, PERFORMANCE & SHIP

```
1. PERFORMANCE HARDENING (budgets from LIFEVERSE_PLAN.md §10)
- Quality tiers (auto GPU-tier + dynamic resolution): drop order SSAO →
  DoF → cloud layer C → soft shadows → particle density. frameloop=demand
  when idle w/ 24fps throttled invalidate for ambient drift.
- Geometry cache in IndexedDB (serialized BufferGeometry per
  seed/level/stage); instancing audit; dispose beyond 2-ring distance;
  draw-call budget test script (fail npm run check:perf if >120 world view).

2. MOBILE: touch polish, panel→bottom-sheet morph, reduced cloud counts,
   44px min targets, PWA manifest + service worker (full offline — it's
   local-first already), install prompt.

3. ACCESSIBILITY: full keyboard graph, SR live-region narration of focus/
   events, reduced-motion crossfades, color-contrast pass on glass panels,
   captions for all companion speech.

4. PREMIUM SCAFFOLD (local entitlement flag, no payments yet): gate deep
   future sims (10y/20y, alternatives), AI life-strategist mode (longer
   analyses), custom island themes (palette/material swaps), rare
   cosmetics, exclusive structures, premium companion skins. Free tier
   keeps everything core.

5. FINAL QA SCRIPT: genesis → log events → quest → achievement → memory →
   companion chat → time travel → future sim → season → export/import →
   reload-persistence → offline mode → ?debug=1 budgets. Fix all.
   Produce README.md (setup, architecture map, key decisions).

Ship: next build (static export) deployable to any static host.
```

---

## CROSS-PHASE REMINDERS (paste if Claude drifts)

```
Re-read CLAUDE.md. Reminders:
- No backend, no API routes. Only network call allowed: OpenRouter
  (free-model fallback chain per CLAUDE.md).
- AI output is JSON-only, zod-validated, clamped; resolver owns aesthetics.
- No charts/dashboards — diegetic analytics only.
- One contextual panel max; canvas ≥92%; panels anchored & auto-dismiss.
- 360° underside check on every new island/structure.
- Visual work must match the 3D reference images in the repo base directory.
- Snapshot to IndexedDB on every significant delta (time travel depends on it).
- useFrame/GSAP for animation; never per-frame React state.
- Verify: lint, tsc, visual orbit check, r3f-perf budgets.
```

## SUGGESTED COMMIT CADENCE
One commit per numbered section inside each phase; tag each completed phase
(`v0.1-foundation` … `v1.0-ship`). Run the previous phase's acceptance
criteria as a regression check before starting the next.
