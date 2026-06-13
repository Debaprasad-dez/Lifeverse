"use client";

import { useEffect } from "react";

/**
 * Service-worker lifecycle. PRODUCTION ONLY — in dev a caching worker would
 * serve a stale HTML shell pointing at old Turbopack chunk hashes, which Next
 * then tries to reload, looping forever ("continuously loading"). So in dev we
 * actively unregister any worker and wipe its caches to heal a stuck tab.
 */
export default function PWARegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    if (process.env.NODE_ENV !== "production") {
      void navigator.serviceWorker
        .getRegistrations()
        .then((regs) => regs.forEach((r) => void r.unregister()))
        .catch(() => {});
      if (typeof caches !== "undefined") {
        void caches.keys().then((keys) => keys.forEach((k) => void caches.delete(k))).catch(() => {});
      }
      return;
    }

    const base = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
    navigator.serviceWorker.register(`${base}/sw.js`, { scope: `${base}/` }).catch(() => {
      // offline support is best-effort; the app works without it
    });
  }, []);
  return null;
}
