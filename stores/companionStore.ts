/**
 * Aria, the AI companion. Holds the chat transcript, her mood (drives the
 * orb), and the "thinking" state. send() asks the model (proxy or BYOK),
 * applies mood, and surfaces any suggested quest for the user to accept.
 */

import { create } from "zustand";
import type { ChatMessage } from "@/lib/ai/client";
import {
  askCompanion,
  localReply,
  type CompanionMessage,
  type SuggestedQuest,
} from "@/lib/ai/companion";
import { useWorldStore } from "@/stores/worldStore";

export interface ChatTurn {
  id: string;
  role: "user" | "aria";
  text: string;
  /** A quest Aria offered with this turn, until accepted/dismissed. */
  quest?: SuggestedQuest;
}

export type CompanionMood = CompanionMessage["mood"];

interface CompanionStore {
  open: boolean;
  thinking: boolean;
  mood: CompanionMood;
  turns: ChatTurn[];
  greeted: boolean;

  toggle: () => void;
  setOpen: (open: boolean) => void;
  greet: () => void;
  send: (text: string) => Promise<void>;
  acceptQuest: (turnId: string) => void;
  dismissQuest: (turnId: string) => void;
  /** Aria announces an event (e.g. a collectible found), no model call. */
  pushAria: (text: string) => void;
}

let n = 0;
const uid = (): string => `t${Date.now().toString(36)}-${n++}`;

function history(turns: ChatTurn[]): ChatMessage[] {
  return turns.map((t) => ({
    role: t.role === "user" ? "user" : "assistant",
    content: t.text,
  }));
}

export const useCompanionStore = create<CompanionStore>((set, get) => ({
  open: false,
  thinking: false,
  mood: "neutral",
  turns: [],
  greeted: false,

  toggle: () => {
    const next = !get().open;
    set({ open: next });
    if (next && !get().greeted) get().greet();
  },
  setOpen: (open) => {
    set({ open });
    if (open && !get().greeted) get().greet();
  },

  greet: () => {
    set({ greeted: true });
    const world = useWorldStore.getState();
    if (!world.state) return;
    // greeting uses the local template instantly; no spinner on open
    const msg = localReply(world.state, "");
    set({
      turns: [...get().turns, { id: uid(), role: "aria", text: msg.reply, quest: msg.suggestedQuest }],
      mood: msg.mood,
    });
  },

  send: async (text) => {
    const trimmed = text.trim();
    if (!trimmed || get().thinking) return;
    const world = useWorldStore.getState();
    if (!world.state) return;

    const userTurn: ChatTurn = { id: uid(), role: "user", text: trimmed };
    const prior = get().turns;
    set({ turns: [...prior, userTurn], thinking: true });

    const { message } = await askCompanion(world.state, history(prior), trimmed);
    const ariaTurn: ChatTurn = {
      id: uid(),
      role: "aria",
      text: message.reply,
      quest: message.suggestedQuest,
    };
    set({ turns: [...get().turns, ariaTurn], mood: message.mood, thinking: false });
  },

  acceptQuest: (turnId) => {
    const turn = get().turns.find((t) => t.id === turnId);
    if (!turn?.quest) return;
    const q = turn.quest;
    useWorldStore.getState().applyDeltas([
      {
        type: "quest_added",
        quest: {
          id: `aria-${Date.now().toString(36)}`,
          islandId: q.islandId,
          title: q.title,
          narrative: q.narrative,
          steps: q.steps.map((label) => ({ label, done: false })),
          reward: { type: "flora", payload: "bloom" },
          status: "active",
          xp: q.xp,
        },
      },
    ]);
    // strip the offer so it can't be accepted twice
    set({
      turns: get().turns.map((t) =>
        t.id === turnId ? { ...t, quest: undefined, text: `${t.text}\n\n✓ Quest accepted.` } : t
      ),
    });
  },

  dismissQuest: (turnId) => {
    set({
      turns: get().turns.map((t) => (t.id === turnId ? { ...t, quest: undefined } : t)),
    });
  },

  pushAria: (text) => {
    set({
      turns: [...get().turns, { id: uid(), role: "aria", text }],
      mood: "celebrate",
      open: true,
      greeted: true,
    });
  },
}));
