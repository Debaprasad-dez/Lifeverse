# LifeVerse AI Proxy

A **standalone** Vercel Edge Function. Its only job: hold the OpenRouter API
key server-side and forward chat completions, so the key never ships in the
browser bundle.

The LifeVerse app itself is **not** hosted here — it lives on GitHub Pages.
Only this proxy runs on Vercel. The app fetches it cross-origin.

## What it does

`POST /api/chat` with `{ messages, models?, json?, temperature?, maxTokens? }`
→ walks the free OpenRouter model fallback chain, returns `{ model, content }`.
CORS is restricted to localhost + the github.io site + `*.vercel.app`.

## Deploy (one time)

This folder is self-contained. Deploy ONLY this folder, not the repo root.

### Option A — Vercel dashboard
1. Push this repo to GitHub (already done).
2. In Vercel: **Add New → Project → Import** this repo.
3. Set **Root Directory** to `proxy`. Framework preset: **Other**.
4. Add an Environment Variable:
   - `OPENROUTER_KEY` = your `sk-or-v1-…` key (Production + Preview + Dev).
   - *(optional)* `ALLOWED_ORIGINS` = comma list to override the default.
5. Deploy. You get a URL like `https://lifeverse-ai-proxy.vercel.app`.
   The function is at `https://lifeverse-ai-proxy.vercel.app/api/chat`.

### Option B — Vercel CLI
```bash
cd proxy
vercel            # link/create the project
vercel env add OPENROUTER_KEY        # paste the key
vercel --prod
```

## Wire the app to it

Set the function URL as the app's proxy (NOT in this folder — in the app):

- **Local dev** → `.env.local` at the repo root (gitignored):
  ```
  NEXT_PUBLIC_AI_PROXY=https://lifeverse-ai-proxy.vercel.app/api/chat
  ```
- **GitHub Pages** → repo **Settings → Secrets and variables → Actions →
  New repository secret**: `NEXT_PUBLIC_AI_PROXY` = the same URL. The deploy
  workflow bakes it into the build.

## Security

- `OPENROUTER_KEY` lives ONLY in Vercel's env. Never commit it, never prefix
  it with `NEXT_PUBLIC_`.
- The app sends no key; it just calls this URL. The key stays here.
- Rotate the key in the OpenRouter dashboard if it was ever exposed.
