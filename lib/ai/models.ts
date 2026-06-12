/**
 * OpenRouter model fallback chain (CLAUDE.md contract). Free models first;
 * on 429/5xx/timeout/invalid-JSON the caller advances down the chain.
 */

export const MODEL_CHAIN = [
  "google/gemma-4-26b-a4b-it:free",
  "nvidia/nemotron-3-ultra-550b-a55b:free",
  "openai/gpt-oss-120b:free",
  "openrouter/free",
] as const;

export type ModelId = (typeof MODEL_CHAIN)[number];

export const DEFAULT_MODEL: ModelId = MODEL_CHAIN[0];

export const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
