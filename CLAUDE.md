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
