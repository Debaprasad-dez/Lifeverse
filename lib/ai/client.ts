/**
 * Browser AI client. Two routes:
 *   1. Shared proxy (default) — POST to NEXT_PUBLIC_AI_PROXY; the Vercel
 *      Edge Function holds the key and walks the model fallback chain.
 *   2. BYOK override — if the user stored their own key in Settings, call
 *      OpenRouter directly from the browser (CLAUDE.md's original path),
 *      walking the chain client-side.
 * Returns the raw assistant string; JSON parsing/validation is the caller's.
 */

import { hasApiKey, loadApiKey } from "@/lib/crypto";
import { MODEL_CHAIN, OPENROUTER_URL } from "@/lib/ai/models";
import { DEFAULT_SETTINGS, getLocal } from "@/lib/storage";

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface ChatOptions {
  json?: boolean;
  temperature?: number;
  maxTokens?: number;
}

export class AIUnavailableError extends Error {}

const PROXY_URL = process.env.NEXT_PUBLIC_AI_PROXY ?? "";

/** Preferred model first, then the rest of the chain (deduped). */
function modelOrder(): string[] {
  const preferred = getLocal("settings", DEFAULT_SETTINGS).preferredModel;
  const rest = MODEL_CHAIN.filter((m) => m !== preferred);
  return preferred ? [preferred, ...rest] : [...MODEL_CHAIN];
}

async function viaProxy(messages: ChatMessage[], opts: ChatOptions): Promise<string> {
  const res = await fetch(PROXY_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      messages,
      models: modelOrder(),
      json: opts.json ?? false,
      temperature: opts.temperature,
      maxTokens: opts.maxTokens,
    }),
  });
  const data = (await res.json().catch(() => null)) as
    | { content?: string; error?: string }
    | null;
  if (!res.ok || !data?.content) {
    throw new AIUnavailableError(data?.error ?? `proxy_${res.status}`);
  }
  return data.content;
}

async function viaDirectKey(
  key: string,
  messages: ChatMessage[],
  opts: ChatOptions
): Promise<string> {
  let lastErr = "all_models_failed";
  for (const model of modelOrder()) {
    try {
      const body: Record<string, unknown> = {
        model,
        messages,
        temperature: opts.temperature ?? 0.8,
        max_tokens: opts.maxTokens ?? 700,
      };
      if (opts.json) body.response_format = { type: "json_object" };

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 28000);
      const r = await fetch(OPENROUTER_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json",
          "HTTP-Referer": window.location.origin,
          "X-Title": "LifeVerse",
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      }).finally(() => clearTimeout(timer));

      if (r.status === 429 || r.status >= 500) {
        lastErr = `model_${r.status}`;
        continue;
      }
      const data = await r.json();
      if (!r.ok) {
        lastErr = data?.error?.message ?? `model_${r.status}`;
        continue;
      }
      const content = data?.choices?.[0]?.message?.content;
      if (typeof content === "string" && content.length > 0) return content;
      lastErr = "empty_completion";
    } catch {
      lastErr = "fetch_failed";
    }
  }
  throw new AIUnavailableError(lastErr);
}

export type AIRoute = "byok" | "proxy" | "none";

/** Which AI route will be used: the user's own key, the shared proxy, or none. */
export function aiRoute(): AIRoute {
  if (typeof window !== "undefined" && hasApiKey()) return "byok";
  if (PROXY_URL) return "proxy";
  return "none";
}

/**
 * Run a chat completion. BYOK key wins; otherwise the shared proxy. Throws
 * AIUnavailableError when neither route is reachable.
 */
export async function chatCompletion(
  messages: ChatMessage[],
  opts: ChatOptions = {}
): Promise<string> {
  const ownKey = await loadApiKey();
  if (ownKey) return viaDirectKey(ownKey, messages, opts);
  if (PROXY_URL) return viaProxy(messages, opts);
  throw new AIUnavailableError("no_ai_route");
}

/** Pull the first {...} JSON object out of a model reply (strips fences). */
export function extractJson(raw: string): unknown {
  let s = raw.trim();
  s = s.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");
  const start = s.indexOf("{");
  const end = s.lastIndexOf("}");
  if (start >= 0 && end > start) s = s.slice(start, end + 1);
  return JSON.parse(s);
}
