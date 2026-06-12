/**
 * Tiny typed event bus decoupling engine ↔ canvas ↔ DOM UI ↔ (later) sound.
 * Interactions and world mutations dispatch here; consumers subscribe.
 */

import type { WorldDelta, WorldState } from "@/engine/schema/world";

export interface EngineEvents {
  "world:booted": { state: WorldState; source: "snapshot" | "fixture" };
  "delta:applied": { delta: WorldDelta };
  "island:focus": { islandId: string | null };
}

type Handler<T> = (payload: T) => void;

const handlers = new Map<keyof EngineEvents, Set<Handler<never>>>();

export function on<K extends keyof EngineEvents>(
  event: K,
  handler: Handler<EngineEvents[K]>
): () => void {
  let set = handlers.get(event);
  if (!set) {
    set = new Set();
    handlers.set(event, set);
  }
  set.add(handler as Handler<never>);
  return () => set.delete(handler as Handler<never>);
}

export function emit<K extends keyof EngineEvents>(
  event: K,
  payload: EngineEvents[K]
): void {
  handlers.get(event)?.forEach((h) => (h as Handler<EngineEvents[K]>)(payload));
}
