"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { listSnapshots, loadSnapshot } from "@/lib/db";
import { tryParseWorldState } from "@/engine/schema/world";
import { projectFuture } from "@/engine/futureSim";
import { useWorldStore } from "@/stores/worldStore";
import { useLifeStore } from "@/stores/lifeStore";

const FUTURE_OPTIONS = [3, 6, 12] as const;

function whenLabel(iso: string): string {
  const d = new Date(iso);
  const days = Math.round((Date.now() - d.getTime()) / 86_400_000);
  if (days <= 0) return "moments ago";
  if (days === 1) return "yesterday";
  if (days < 30) return `${days} days ago`;
  const months = Math.round(days / 30);
  return `${months} month${months > 1 ? "s" : ""} ago`;
}

export default function TimeDial({ onClose }: { onClose: () => void }) {
  const era = useWorldStore((s) => s.era);
  const [stamps, setStamps] = useState<string[]>([]);
  const [idx, setIdx] = useState<number>(-1); // -1 = present

  useEffect(() => {
    void listSnapshots().then((all) => {
      setStamps(all);
      setIdx(all.length - 1); // newest snapshot ≈ present
    });
  }, []);

  const scrubTo = async (i: number): Promise<void> => {
    setIdx(i);
    if (i < 0 || i >= stamps.length) return;
    const isPresent = i === stamps.length - 1;
    if (isPresent) {
      useWorldStore.getState().clearPreview();
      return;
    }
    const snap = await loadSnapshot(stamps[i]);
    const parsed = snap ? tryParseWorldState(snap.state) : null;
    if (parsed) useWorldStore.getState().setPreview({ ...parsed, era: "past" }, "past");
  };

  const glimpse = (months: number): void => {
    const state = useWorldStore.getState().state;
    if (!state) return;
    const events = useLifeStore.getState().events;
    useWorldStore.getState().setPreview(projectFuture(state, events, months), "simulated");
  };

  const returnNow = (): void => {
    useWorldStore.getState().clearPreview();
    setIdx(stamps.length - 1);
  };

  const hasPast = stamps.length > 1;

  return (
    <motion.div
      initial={{ opacity: 0, y: -14, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -10, scale: 0.97 }}
      transition={{ type: "spring", stiffness: 360, damping: 30 }}
      className="glass-panel pointer-events-auto absolute right-4 top-16 w-72 px-5 py-4 select-none"
    >
      <div className="flex items-center justify-between">
        <h2 className="font-heading text-sm font-bold text-ink">Time</h2>
        <button
          type="button"
          aria-label="Close time dial"
          className="rounded-full px-2 py-0.5 font-heading text-xs font-bold text-ink-soft hover:bg-white/60"
          onClick={onClose}
        >
          ✕
        </button>
      </div>

      {era !== "present" && (
        <div className="mt-2 flex items-center justify-between rounded-full bg-ink/8 px-3 py-1">
          <span className="font-label text-[0.6rem] font-bold uppercase tracking-wider text-ink-soft">
            {era === "past" ? "Viewing the past" : "Glimpsing the future"}
          </span>
          <button
            type="button"
            className="font-label text-[0.6rem] font-bold uppercase tracking-wider text-aura-deep underline"
            onClick={returnNow}
          >
            Return to now
          </button>
        </div>
      )}

      <div className="mt-3">
        <span className="font-label text-[0.62rem] font-bold uppercase tracking-wider text-ink-soft">
          The past
        </span>
        {hasPast ? (
          <>
            <input
              type="range"
              min={0}
              max={stamps.length - 1}
              value={idx < 0 ? stamps.length - 1 : idx}
              onChange={(e) => void scrubTo(Number(e.target.value))}
              className="mt-1.5 w-full accent-aura"
            />
            <div className="mt-0.5 text-right font-body text-[0.66rem] text-ink-soft">
              {idx < 0 || idx === stamps.length - 1
                ? "Now"
                : whenLabel(stamps[idx])}
            </div>
          </>
        ) : (
          <p className="mt-1 font-body text-[0.66rem] text-ink-soft/80">
            History grows as you check in. Come back after a few days to scrub
            through your world&apos;s past.
          </p>
        )}
      </div>

      <div className="mt-3 border-t border-white/60 pt-3">
        <span className="font-label text-[0.62rem] font-bold uppercase tracking-wider text-ink-soft">
          Glimpse the future
        </span>
        <p className="mb-2 mt-0.5 font-body text-[0.62rem] leading-snug text-ink-soft/80">
          A projection from your recent habits — where this world is heading.
        </p>
        <div className="flex gap-1.5">
          {FUTURE_OPTIONS.map((m) => (
            <button
              key={m}
              type="button"
              className="pill-btn secondary"
              onClick={() => glimpse(m)}
            >
              +{m}mo
            </button>
          ))}
        </div>
      </div>
    </motion.div>
  );
}
