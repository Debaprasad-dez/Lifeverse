/**
 * The AI companion ("Aria"): reads a compact world summary + recent events
 * + the user's message, returns a CompanionMessage (zod-validated). The AI
 * speaks ONLY this shape — engine owns all rendering. A failed/garbled
 * model reply falls back to a local template so the companion never breaks.
 */

import { z } from "zod";
import {
  CORE_KINGDOM_IDS,
  type CoreKingdomId,
  type WorldState,
} from "@/engine/schema/world";
import { KINGDOM_LAYOUTS } from "@/engine/resolver/layout";
import { chatCompletion, extractJson, type ChatMessage } from "@/lib/ai/client";

// ---------------------------------------------------------------------------
// CompanionMessage — the only thing the AI is allowed to emit
// ---------------------------------------------------------------------------

export const SuggestedQuestSchema = z.object({
  islandId: z.enum(CORE_KINGDOM_IDS),
  title: z.string().max(60),
  narrative: z.string().max(200),
  steps: z.array(z.string().max(60)).min(1).max(5),
  xp: z.number().int().min(20).max(300).default(100),
});
export type SuggestedQuest = z.infer<typeof SuggestedQuestSchema>;

export const CompanionMessageSchema = z.object({
  reply: z.string().max(600),
  mood: z.enum(["celebrate", "encourage", "advise", "neutral"]).default("neutral"),
  focusIsland: z.enum(CORE_KINGDOM_IDS).optional(),
  suggestedQuest: SuggestedQuestSchema.optional(),
});
export type CompanionMessage = z.infer<typeof CompanionMessageSchema>;

// ---------------------------------------------------------------------------
// World summary — a tiny, token-cheap snapshot for the prompt
// ---------------------------------------------------------------------------

export function summarizeWorld(state: WorldState): string {
  const lines: string[] = [];
  for (const id of CORE_KINGDOM_IDS) {
    const island = state.islands.find((i) => i.id === id);
    if (!island || island.locked) continue;
    const label = KINGDOM_LAYOUTS[id as CoreKingdomId].label;
    const active = state.quests.filter(
      (q) => q.islandId === id && q.status === "active"
    ).length;
    lines.push(
      `${label}: Lv${island.level} stage${island.evolutionStage} ` +
        `vitality ${(island.vitality * 100) | 0}% ` +
        `flora ${(island.ecosystem.flora * 100) | 0}% ` +
        `${active} active quest(s)`
    );
  }
  const mon = state.monuments.length;
  const mem = state.memories.length;
  return `${lines.join("\n")}\nMonuments earned: ${mon}. Memories planted: ${mem}.`;
}

const SYSTEM_PROMPT = `You are Aria, the warm, perceptive guide of LifeVerse — a 3D world where each of the user's life domains is a floating kingdom that grows as they act in real life.

Speak briefly (1-3 sentences), encouraging but never saccharine. Reference their kingdoms by name. You may notice which kingdom needs attention (low vitality) and gently suggest ONE concrete quest.

Return ONLY a JSON object, no markdown, no prose outside it:
{
  "reply": "<your message, max 3 sentences>",
  "mood": "celebrate" | "encourage" | "advise" | "neutral",
  "focusIsland": "<kingdom id, optional>",
  "suggestedQuest": {            // optional, include only when it fits
    "islandId": "<kingdom id>",
    "title": "<short title>",
    "narrative": "<one line>",
    "steps": ["<step>", "..."],  // 1-5 short steps
    "xp": <20-300>
  }
}
Kingdom ids: career, health, learning, finance, relationships, creativity, adventure.`;

function buildMessages(
  state: WorldState,
  history: ChatMessage[],
  userText: string
): ChatMessage[] {
  return [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "system", content: `Current world:\n${summarizeWorld(state)}` },
    ...history.slice(-6),
    { role: "user", content: userText },
  ];
}

function parseReply(raw: string): CompanionMessage | null {
  try {
    const obj = extractJson(raw);
    const parsed = CompanionMessageSchema.safeParse(obj);
    if (parsed.success) return parsed.data;
  } catch {
    // fall through
  }
  return null;
}

// ---------------------------------------------------------------------------
// Local fallback — deterministic, no network. Keeps Aria alive offline.
// ---------------------------------------------------------------------------

export function localReply(state: WorldState, userText: string): CompanionMessage {
  const unlocked = CORE_KINGDOM_IDS.map((id) =>
    state.islands.find((i) => i.id === id)
  ).filter((i): i is NonNullable<typeof i> => !!i && !i.locked);

  const weakest = [...unlocked].sort((a, b) => a.vitality - b.vitality)[0];
  const strongest = [...unlocked].sort((a, b) => b.vitality - a.vitality)[0];
  const t = userText.toLowerCase();

  if (/hello|hi|hey|greet/.test(t) || userText === "") {
    return {
      reply: `Welcome back. ${
        strongest ? KINGDOM_LAYOUTS[strongest.id as CoreKingdomId].label : "Your world"
      } is thriving — what shall we tend today?`,
      mood: "encourage",
    };
  }
  if (weakest && weakest.vitality < 0.4) {
    const label = KINGDOM_LAYOUTS[weakest.id as CoreKingdomId].label;
    return {
      reply: `${label} has grown quiet lately. A small step there would bring its color back.`,
      mood: "advise",
      focusIsland: weakest.id as CoreKingdomId,
    };
  }
  return {
    reply: "Every check-in reshapes this world. Tell me what you did, and watch a kingdom grow.",
    mood: "encourage",
  };
}

// ---------------------------------------------------------------------------
// Public entry: ask Aria. One repair retry, then local fallback.
// ---------------------------------------------------------------------------

export async function askCompanion(
  state: WorldState,
  history: ChatMessage[],
  userText: string
): Promise<{ message: CompanionMessage; source: "ai" | "local" }> {
  const messages = buildMessages(state, history, userText);
  try {
    const raw = await chatCompletion(messages, { json: true, maxTokens: 500 });
    const first = parseReply(raw);
    if (first) return { message: first, source: "ai" };

    // one repair pass — restate the contract
    const repair = await chatCompletion(
      [
        ...messages,
        { role: "assistant", content: raw.slice(0, 500) },
        {
          role: "user",
          content:
            "That was not valid. Reply with ONLY the JSON object described, nothing else.",
        },
      ],
      { json: true, maxTokens: 500 }
    );
    const second = parseReply(repair);
    if (second) return { message: second, source: "ai" };
  } catch {
    // network/key/all-models failure — fall through to local
  }
  return { message: localReply(state, userText), source: "local" };
}
