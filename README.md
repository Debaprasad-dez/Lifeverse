# LifeVerse

An immersive 3D life-sim where your real life is a living floating world of
kingdoms. Each life domain — Career, Health, Learning, Finance, Relationships,
Creativity, Adventure — is a floating island that grows as you act in real
life. The world **is** the interface: no dashboards, no charts, just a world
you tend.

**Live:** https://debaprasad-dez.github.io/Lifeverse/

Visual north star: Pixar / The Super Mario Bros. Movie / Zelda Sky Islands /
Disney Dreamlight Valley — golden-hour, chunky-stylized, fully traceable
floating islands.

---

## Quick start

```bash
npm install
npm run dev          # http://localhost:3000
npm run lint         # eslint
npx tsc --noEmit     # type-check
npm run build        # static export to ./out
```

Static export — host `./out` on any static host. No backend.

Useful URL params: `?debug=1` (perf HUD), `?nogenesis=1` (skip first-run
genesis), `?island=<id>` (deep-link into a kingdom).

---

## Architecture

```
app/                Next.js App Router shell, fonts, PWA metadata
engine/             Pure, deterministic, no React
  schema/           zod WorldState + WorldDelta (THE contract) + fixture + apply
  generation/       seeded island geometry, scatter, structure kit + recipes
  resolver/         WorldState → render instances; layout, slots, analytics
  evolution/        life-event → WorldDelta rules
  genesis.ts        questionnaire answers → initial world
  futureSim.ts      project the world forward (the "future glimpse")
  season.ts  collectibles.ts
components/canvas/   R3F scene: sky, lighting, islands, effects, camera, postFX
components/ui/       contextual glass panels, companion, time dial, overlay
stores/             zustand: world, camera, ui, life, companion, genesis
lib/                noise, storage (localStorage), db (IndexedDB), ai, sound,
                    crypto, quality tiers, events bus
proxy/              standalone Vercel Edge Function (AI key proxy) — deployed
                    separately; the app itself stays on GitHub Pages
```

### The contract (engine/schema/world.ts)

`WorldState` is the single source of truth. The renderer and the AI both
speak it. The world only ever changes through a `WorldDelta` (a typed,
discriminated-union patch) applied by a pure reducer (`apply.ts`). Every
significant delta autosaves a snapshot to IndexedDB — that snapshot history
**is** the time-travel substrate.

**AI emits semantic state only** (levels, stages, meanings) — never colors,
positions, or animation params. The resolver owns every aesthetic decision,
so the world always looks art-directed regardless of model output.

### Data flow

```
user check-in / AI / genesis
      → WorldDelta[]  →  apply.ts (pure)  →  WorldState
      → snapshot to IndexedDB (time-travel)
      → resolver (WorldState → instanced pools, anchors, analytics)
      → R3F renders; GrowthFX celebrates the delta
```

---

## Key decisions

- **No backend.** Client-only Next.js static export. The single exception is
  the AI: the browser calls a tiny standalone Vercel Edge Function
  (`proxy/`) that holds the OpenRouter key server-side. Users set nothing;
  a BYOK key (encrypted in-browser via WebCrypto) can override it.
- **Diegetic analytics only.** No charts. Level → island size; vitality →
  flora density + saturation; lightingIntensity → window glow; population →
  villagers; trafficFlow → airships; ecosystem → per-island weather.
- **One contextual panel max**, glass, anchored to 3D points, auto-dismiss on
  camera flight, always clamped on-screen (`ClampViewport`).
- **Deterministic procedural generation**, seeded by `worldSeed + kingdomId`
  — same inputs always yield the same world.
- **Per-frame work in `useFrame`/GSAP only** — never React state per frame.
  Everything animated is instanced; the whole archipelago of structures is
  ~10 draw calls (two material pools × five primitives).
- **Persistence:** localStorage for settings/flags; IndexedDB (`idb`) for
  world snapshots, life events, memories.

### AI

OpenRouter, free-model fallback chain (gemma → nemotron → gpt-oss →
openrouter/free). The companion ("Aria") emits only a zod-validated
`CompanionMessage`; bad JSON gets one repair retry, then a deterministic
local template so she never breaks offline. See [proxy/README.md](proxy/README.md)
for proxy deployment.

---

## Performance

Quality tiers auto-detect from the device (`lib/quality.ts`) and drive the
dpr cap, SSAO (N8AO), soft shadows, and particle density. Force a tier in
Settings. Island geometry uses a 3-tier LOD; flora, structures, and ambient
life are instanced. `?debug=1` shows the live draw-call / triangle HUD.

## Offline & install

Fully local-first. A service worker (`public/sw.js`) caches the app shell
(stale-while-revalidate, same-origin only — the AI proxy is never cached),
so after the first visit it runs offline and is installable as a PWA.

## Accessibility

Keyboard graph (Tab/Enter to traverse kingdoms, 1–7 jump, Esc cascades out),
an aria-live region narrating companion speech and events, reduced-motion
support (flights become crossfades), and high-contrast glass panels.

---

## Stack

Next.js App Router · TypeScript (strict) · React Three Fiber · drei ·
@react-three/postprocessing · N8AO · GSAP · Framer Motion · Zustand · zod ·
idb · troika-three-text
