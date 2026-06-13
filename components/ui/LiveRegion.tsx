"use client";

import { useEffect, useState } from "react";
import { useCompanionStore } from "@/stores/companionStore";
import { useLifeStore } from "@/stores/lifeStore";
import { useWorldStore } from "@/stores/worldStore";

/**
 * Visually-hidden aria-live region — narrates the diegetic events a screen
 * reader can't see in the canvas: Aria's latest line, check-in toasts, and
 * era changes. Polite so it never interrupts.
 */
export default function LiveRegion() {
  const [msg, setMsg] = useState("");

  // Aria's newest spoken line
  useEffect(() => {
    return useCompanionStore.subscribe((s, prev) => {
      if (s.turns.length > prev.turns.length) {
        const last = s.turns[s.turns.length - 1];
        if (last.role === "aria") setMsg(`Aria says: ${last.text}`);
      }
    });
  }, []);

  // check-in / collectible toasts
  useEffect(() => {
    return useLifeStore.subscribe((s, prev) => {
      if (s.toast && s.toast !== prev.toast) setMsg(s.toast);
    });
  }, []);

  // entering/leaving past or future
  useEffect(() => {
    return useWorldStore.subscribe((s, prev) => {
      if (s.era !== prev.era) {
        setMsg(
          s.era === "present"
            ? "Returned to the present."
            : s.era === "past"
              ? "Now viewing the past."
              : "Now glimpsing a possible future."
        );
      }
    });
  }, []);

  return (
    <div aria-live="polite" aria-atomic="true" className="sr-only">
      {msg}
    </div>
  );
}
