/**
 * Typed localStorage wrapper. localStorage holds only small fast-boot data:
 * settings, flags, last snapshot pointer. World data lives in IndexedDB.
 */

export interface Settings {
  quality: "auto" | "high" | "medium" | "low";
  sound: boolean;
  reducedMotion: "auto" | "on" | "off";
  /** First model tried in the OpenRouter fallback chain. */
  preferredModel: string;
}

export interface Flags {
  onboarded: boolean;
  hintsSeen: boolean;
  genesisDone: boolean;
}

interface LocalSchema {
  settings: Settings;
  flags: Flags;
  lastSnapshotId: string | null;
}

export const DEFAULT_SETTINGS: Settings = {
  quality: "auto",
  sound: true,
  reducedMotion: "auto",
  preferredModel: "google/gemma-4-26b-a4b-it:free",
};

export const DEFAULT_FLAGS: Flags = {
  onboarded: false,
  hintsSeen: false,
  genesisDone: false,
};

const PREFIX = "lifeverse:";

export function getLocal<K extends keyof LocalSchema>(
  key: K,
  fallback: LocalSchema[K]
): LocalSchema[K] {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(PREFIX + key);
    if (raw === null) return fallback;
    return JSON.parse(raw) as LocalSchema[K];
  } catch {
    return fallback;
  }
}

export function setLocal<K extends keyof LocalSchema>(
  key: K,
  value: LocalSchema[K]
): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch {
    // Quota/private mode — non-fatal by design.
  }
}

export function removeLocal(key: keyof LocalSchema): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(PREFIX + key);
  } catch {
    // ignore
  }
}
