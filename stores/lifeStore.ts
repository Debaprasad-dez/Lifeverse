/**
 * Check-ins. logEvent() turns a tap into WorldDeltas (rules.ts), tracks
 * per-habit day-streaks (IndexedDB meta), and surfaces a toast. The world
 * visibly evolves within a couple of seconds — that's the whole product.
 */

import { create } from "zustand";
import { getDB } from "@/lib/db";
import { lifeEventToDeltas, LIFE_EVENTS, type LifeEvent, type LifeEventKind } from "@/engine/evolution/rules";
import { advanceQuests } from "@/engine/evolution/quests";
import { useWorldStore } from "@/stores/worldStore";

const EVENTS_KEY = "lifeEvents";
const MAX_EVENTS = 2000;

function dayOf(iso: string): string {
  return iso.slice(0, 10);
}

/** Consecutive-day streak ending today for one habit. */
function streakDays(events: LifeEvent[], kind: LifeEventKind, now: Date): number {
  const days = new Set(events.filter((e) => e.kind === kind).map((e) => dayOf(e.at)));
  let streak = 0;
  const cursor = new Date(now);
  while (days.has(cursor.toISOString().slice(0, 10))) {
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

interface LifeStore {
  toast: string | null;
  events: LifeEvent[];
  hydrated: boolean;
  /** Read-only wellbeing signal 0 (calm) → 1 (stressed). Nothing writes it yet;
   *  the Health island reads it to drive fog/rain. Wire a real source later. */
  stress: number;
  hydrate: () => Promise<void>;
  logEvent: (kind: LifeEventKind) => void;
  clearToast: () => void;
}

/** Read-only consecutive-day streak across the health habits (for visuals). */
export function healthStreak(events: LifeEvent[], now = new Date()): number {
  const days = new Set(
    events.filter((e) => e.kind === "exercise" || e.kind === "meditate").map((e) => e.at.slice(0, 10))
  );
  let streak = 0;
  const cursor = new Date(now);
  while (days.has(cursor.toISOString().slice(0, 10))) {
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

let toastTimer: ReturnType<typeof setTimeout> | null = null;
let persistTimer: ReturnType<typeof setTimeout> | null = null;

export const useLifeStore = create<LifeStore>((set, get) => ({
  toast: null,
  events: [],
  hydrated: false,
  stress: 0,

  hydrate: async () => {
    if (get().hydrated) return;
    try {
      const db = await getDB();
      const stored = (await db.get("meta", EVENTS_KEY)) as LifeEvent[] | undefined;
      set({ events: stored ?? [], hydrated: true });
    } catch {
      set({ hydrated: true });
    }
  },

  logEvent: (kind) => {
    const world = useWorldStore.getState();
    if (!world.state) return;
    // time-travel / future views are read-only — no check-ins there
    if (world.era !== "present") {
      set({ toast: "You can only shape the present. Return to now to check in." });
      if (toastTimer) clearTimeout(toastTimer);
      toastTimer = setTimeout(() => set({ toast: null }), 3000);
      return;
    }

    const now = new Date();
    const event: LifeEvent = { kind, at: now.toISOString() };
    const events = [...get().events, event].slice(-MAX_EVENTS);
    set({ events });

    const streak = streakDays(events, kind, now);
    const spec = LIFE_EVENTS[kind];
    const deltas = lifeEventToDeltas(kind, world.state, streak);
    // the same check-in advances that kingdom's active quest one step
    const quest = advanceQuests(world.state, spec.islandId);
    world.applyDeltas([...deltas, ...quest.deltas]);

    const message = quest.completedQuest
      ? `Quest complete: ${quest.completedQuest.title}!`
      : streak === 7
        ? `${spec.label} — 7-day streak! An aurora rises.`
        : streak >= 2
          ? `${spec.label} — ${streak}-day streak. The kingdom grows.`
          : `${spec.label} — the kingdom stirs.`;
    set({ toast: message });
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => set({ toast: null }), 3400);

    if (persistTimer) clearTimeout(persistTimer);
    persistTimer = setTimeout(() => {
      void getDB()
        .then((db) => db.put("meta", get().events, EVENTS_KEY))
        .catch(() => {});
    }, 800);
  },

  clearToast: () => set({ toast: null }),
}));
