/**
 * IndexedDB layer (via `idb`). Skeleton only in Phase 1 — stores + types,
 * no data written yet. Snapshots power time travel from Phase 2 on.
 */

import { openDB, type DBSchema, type IDBPDatabase } from "idb";

/** Placeholder until engine/schema (Phase 2) defines the zod WorldState. */
export interface WorldSnapshot {
  timestamp: string; // ISO — primary key
  state: unknown;
}

export interface QuestRecord {
  id: string;
  data: unknown;
}

export interface MemoryRecord {
  id: string;
  photos: Blob[];
  data: unknown;
}

export interface CollectibleRecord {
  id: string;
  data: unknown;
}

interface LifeVerseDB extends DBSchema {
  snapshots: { key: string; value: WorldSnapshot };
  quests: { key: string; value: QuestRecord };
  memories: { key: string; value: MemoryRecord };
  collectibles: { key: string; value: CollectibleRecord };
  meta: { key: string; value: unknown };
}

const DB_NAME = "lifeverse";
const DB_VERSION = 1;

let dbPromise: Promise<IDBPDatabase<LifeVerseDB>> | null = null;

export function getDB(): Promise<IDBPDatabase<LifeVerseDB>> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("IndexedDB unavailable during SSR"));
  }
  if (!dbPromise) {
    dbPromise = openDB<LifeVerseDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        db.createObjectStore("snapshots", { keyPath: "timestamp" });
        db.createObjectStore("quests", { keyPath: "id" });
        db.createObjectStore("memories", { keyPath: "id" });
        db.createObjectStore("collectibles", { keyPath: "id" });
        db.createObjectStore("meta");
      },
    });
  }
  return dbPromise;
}
