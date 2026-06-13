/**
 * OpenRouter proxy — Vercel Edge Function. Holds the shared API key in a
 * SERVER-side env var (OPENROUTER_KEY) so it never reaches the browser
 * bundle. The client posts { messages, json } here; we walk the free-model
 * fallback chain and return the first success.
 *
 * Env:
 *   OPENROUTER_KEY    (required) — the OpenRouter secret, server-only.
 *   ALLOWED_ORIGINS   (optional) — comma list; defaults to github.io +
 *                     localhost + *.vercel.app.
 *
 * NOTE: this lives at the repo-root /api (Vercel convention), OUTSIDE the
 * Next.js app/ tree, so it deploys as a function on Vercel while the
 * static export to GitHub Pages ignores it entirely.
 */

export const config = { runtime: "edge" };

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

const MODEL_CHAIN = [
  "google/gemma-4-26b-a4b-it:free",
  "nvidia/nemotron-3-ultra-550b-a55b:free",
  "openai/gpt-oss-120b:free",
  "openrouter/free",
];

function allowOrigin(origin: string | null): string {
  const raw = process.env.ALLOWED_ORIGINS;
  const list = raw
    ? raw.split(",").map((s) => s.trim())
    : ["http://localhost:3000", "https://debaprasad-dez.github.io"];
  if (origin) {
    if (list.includes(origin)) return origin;
    if (/^http:\/\/localhost:\d+$/.test(origin)) return origin;
    if (/\.vercel\.app$/.test(new URL(origin).hostname)) return origin;
  }
  return list[0];
}

function corsHeaders(origin: string | null): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": allowOrigin(origin),
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

function json(body: unknown, status: number, origin: string | null): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders(origin) },
  });
}

export default async function handler(req: Request): Promise<Response> {
  const origin = req.headers.get("origin");

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders(origin) });
  }
  if (req.method !== "POST") {
    return json({ error: "method_not_allowed" }, 405, origin);
  }

  const key = process.env.OPENROUTER_KEY;
  if (!key) return json({ error: "proxy_not_configured" }, 500, origin);

  let payload: {
    messages?: { role: string; content: string }[];
    models?: string[];
    temperature?: number;
    maxTokens?: number;
    json?: boolean;
  };
  try {
    payload = await req.json();
  } catch {
    return json({ error: "bad_request" }, 400, origin);
  }

  const messages = payload.messages;
  if (!Array.isArray(messages) || messages.length === 0) {
    return json({ error: "no_messages" }, 400, origin);
  }

  const models = Array.isArray(payload.models) && payload.models.length > 0
    ? payload.models
    : MODEL_CHAIN;
  const temperature = typeof payload.temperature === "number" ? payload.temperature : 0.8;
  const maxTokens = typeof payload.maxTokens === "number" ? payload.maxTokens : 700;

  let lastErr = "all_models_failed";
  for (const model of models) {
    try {
      const body: Record<string, unknown> = {
        model,
        messages,
        temperature,
        max_tokens: maxTokens,
      };
      if (payload.json) body.response_format = { type: "json_object" };

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 28000);
      const r = await fetch(OPENROUTER_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json",
          "HTTP-Referer": origin ?? "https://debaprasad-dez.github.io",
          "X-Title": "LifeVerse",
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      }).finally(() => clearTimeout(timer));

      if (r.status === 429 || r.status >= 500) {
        lastErr = `model_${r.status}`;
        continue; // chain down
      }
      const data = await r.json();
      if (!r.ok) {
        lastErr = data?.error?.message ?? `model_${r.status}`;
        continue;
      }
      const content = data?.choices?.[0]?.message?.content;
      if (typeof content !== "string" || content.length === 0) {
        lastErr = "empty_completion";
        continue;
      }
      return json({ model, content }, 200, origin);
    } catch {
      lastErr = "fetch_failed";
      continue;
    }
  }

  return json({ error: lastErr }, 502, origin);
}
