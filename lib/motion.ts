import { DEFAULT_SETTINGS, getLocal } from "@/lib/storage";

/** Effective reduced-motion: explicit setting wins, "auto" follows the OS. */
export function reducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  const pref = getLocal("settings", DEFAULT_SETTINGS).reducedMotion;
  if (pref === "on") return true;
  if (pref === "off") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}
