/**
 * IndexedDB layer (via `idb`). Snapshots power time travel: every applied
 * delta autosaves here; boot loads the latest one.
 */

import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import type { WorldState } from "@/engine/schema/world";

export interface WorldSnapshot {
  timestamp: string; // ISO — primary key
  state: WorldState;
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

// ---------------------------------------------------------------------------
// Snapshots (time-travel substrate)
// ---------------------------------------------------------------------------

const KEEP_RECENT = 200;
/** Snapshots older than this collapse to one per day. */
const COMPACT_AFTER_MS = 48 * 60 * 60 * 1000;

export async function saveSnapshot(state: WorldState): Promise<string> {
  const db = await getDB();
  const snapshot: WorldSnapshot = { timestamp: state.timestamp, state };
  await db.put("snapshots", snapshot);
  return snapshot.timestamp;
}

export async function loadSnapshot(timestamp: string): Promise<WorldSnapshot | undefined> {
  const db = await getDB();
  return db.get("snapshots", timestamp);
}

export async function loadLatestSnapshot(): Promise<WorldSnapshot | undefined> {
  const db = await getDB();
  // keys are ISO timestamps → lexicographic order is chronological
  const cursor = await db.transaction("snapshots").store.openCursor(null, "prev");
  return cursor?.value;
}

/** Keep the last KEEP_RECENT; compact older-than-48h to one per day. */
export async function pruneSnapshots(): Promise<void> {
  const db = await getDB();
  const keys = (await db.getAllKeys("snapshots")).sort();
  const doomed: string[] = [];

  const overflow = keys.length - KEEP_RECENT;
  if (overflow > 0) doomed.push(...keys.slice(0, overflow));

  const cutoff = Date.now() - COMPACT_AFTER_MS;
  const seenDays = new Set<string>();
  // newest-first so the freshest snapshot of each old day survives
  for (const key of [...keys].reverse()) {
    const t = Date.parse(key);
    if (Number.isNaN(t) || t > cutoff) continue;
    const day = key.slice(0, 10);
    if (seenDays.has(day)) doomed.push(key);
    else seenDays.add(day);
  }

  if (doomed.length > 0) {
    const tx = db.transaction("snapshots", "readwrite");
    await Promise.all([...new Set(doomed)].map((k) => tx.store.delete(k)));
    await tx.done;
  }
}
