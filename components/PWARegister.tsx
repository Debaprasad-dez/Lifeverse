"use client";

import { useEffect } from "react";

/** Registers the offline service worker (basePath-aware for GitHub Pages). */
export default function PWARegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    const base = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
    const url = `${base}/sw.js`;
    navigator.serviceWorker.register(url, { scope: `${base}/` }).catch(() => {
      // offline support is best-effort; the app works without it
    });
  }, []);
  return null;
}
