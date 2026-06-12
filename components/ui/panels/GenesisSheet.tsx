"use client";

import { useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { GenesisAnswers } from "@/engine/genesis";
import { useGenesisStore } from "@/stores/genesisStore";

type ChipValue = string | number;

interface Step {
  key: keyof GenesisAnswers;
  question: string;
  type: "text" | "chips";
  placeholder?: string;
  chips?: { label: string; value: ChipValue }[];
}

const STEPS: Step[] = [
  { key: "name", question: "Welcome, traveler. What should this world call you?", type: "text", placeholder: "Your name" },
  {
    key: "careerStage",
    question: "Where are you on your career road?",
    type: "chips",
    chips: [
      { label: "Studying", value: "student" },
      { label: "Early days", value: "early" },
      { label: "Mid-journey", value: "mid" },
      { label: "Senior", value: "senior" },
      { label: "Founder", value: "founder" },
      { label: "On a break", value: "break" },
    ],
  },
  {
    key: "careerJoy",
    question: "And honestly — how does work feel lately?",
    type: "chips",
    chips: [
      { label: "Heavy", value: 1 },
      { label: "Meh", value: 2 },
      { label: "Okay", value: 3 },
      { label: "Good", value: 4 },
      { label: "I love it", value: 5 },
    ],
  },
  {
    key: "exercisePerWeek",
    question: "How often does your body get to move, per week?",
    type: "chips",
    chips: [
      { label: "Rarely", value: 0 },
      { label: "1–2 times", value: 1 },
      { label: "3–4 times", value: 3 },
      { label: "5+", value: 5 },
    ],
  },
  { key: "skills", question: "What are you learning right now? (up to three, commas)", type: "text", placeholder: "e.g. React, piano, Japanese" },
  {
    key: "circle",
    question: "Your people — how wide is the circle?",
    type: "chips",
    chips: [
      { label: "A few close ones", value: "small" },
      { label: "Tight crew", value: "close" },
      { label: "Big family", value: "family" },
      { label: "Wide network", value: "wide" },
    ],
  },
  {
    key: "finance",
    question: "And the treasury — how do finances feel?",
    type: "chips",
    chips: [
      { label: "Tight", value: "tight" },
      { label: "Stable", value: "stable" },
      { label: "Growing", value: "growing" },
      { label: "Comfortable", value: "comfortable" },
    ],
  },
  {
    key: "creative",
    question: "Do you make things — art, music, words, anything?",
    type: "chips",
    chips: [
      { label: "Not yet", value: "none" },
      { label: "I dabble", value: "dabble" },
      { label: "Regularly", value: "regular" },
      { label: "I ship things", value: "shipping" },
    ],
  },
  { key: "dream", question: "Last one. Name a dream worth a mountain.", type: "text", placeholder: "e.g. See the northern lights" },
];

/**
 * World Genesis — a conversation, not a form. The companion asks; each
 * answer shapes the archipelago waiting under the clouds.
 */
export default function GenesisSheet() {
  const [step, setStep] = useState(0);
  const [text, setText] = useState("");
  const answersRef = useRef<Partial<GenesisAnswers>>({});

  const current = STEPS[step];

  const advance = (value: ChipValue): void => {
    const a = answersRef.current;
    if (current.key === "skills") {
      a.skills = String(value)
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
        .slice(0, 3);
    } else {
      (a as Record<string, ChipValue>)[current.key] = value;
    }
    setText("");
    if (step < STEPS.length - 1) {
      setStep(step + 1);
    } else {
      useGenesisStore.getState().complete({
        name: a.name || "Traveler",
        careerStage: a.careerStage ?? "early",
        careerJoy: a.careerJoy ?? 3,
        exercisePerWeek: a.exercisePerWeek ?? 1,
        skills: a.skills ?? [],
        circle: a.circle ?? "close",
        finance: a.finance ?? "stable",
        creative: a.creative ?? "dabble",
        dream: a.dream || "",
      });
    }
  };

  const submitText = (): void => {
    if (current.type === "text") advance(text.trim() || (current.placeholder ?? ""));
  };

  return (
    <div className="pointer-events-none absolute inset-0 flex items-end justify-center pb-14">
      <motion.div
        initial={{ opacity: 0, y: 28 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, ease: "easeOut" }}
        className="glass-panel pointer-events-auto w-[26rem] max-w-[92vw] px-6 py-5"
      >
        <div className="flex items-center gap-2.5">
          <span
            className="block h-8 w-8 shrink-0 rounded-full"
            style={{
              background:
                "radial-gradient(circle at 32% 30%, rgba(255,255,255,0.95), rgba(79,195,247,0.85) 45%, rgba(0,102,136,0.9))",
              boxShadow: "0 0 16px rgba(79,195,247,0.6)",
            }}
          />
          <AnimatePresence mode="wait">
            <motion.p
              key={step}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.35 }}
              className="font-heading text-sm font-semibold leading-snug text-ink"
            >
              {current.question}
            </motion.p>
          </AnimatePresence>
        </div>

        <div className="mt-4">
          {current.type === "chips" ? (
            <div className="flex flex-wrap gap-1.5">
              {current.chips!.map((chip) => (
                <button
                  key={chip.label}
                  type="button"
                  className="pill-btn secondary"
                  onClick={() => advance(chip.value)}
                >
                  {chip.label}
                </button>
              ))}
            </div>
          ) : (
            <div className="flex gap-1.5">
              <input
                autoFocus
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && submitText()}
                placeholder={current.placeholder}
                className="min-w-0 flex-1 rounded-full border border-white/70 bg-white/70 px-4 py-1.5 font-body text-sm text-ink outline-none placeholder:text-ink-soft/50"
              />
              <button type="button" className="pill-btn" onClick={submitText}>
                Next
              </button>
            </div>
          )}
        </div>

        <div className="mt-4 flex items-center justify-between">
          <div className="flex gap-1">
            {STEPS.map((_, i) => (
              <span
                key={i}
                className={`block h-1.5 w-1.5 rounded-full ${i <= step ? "bg-aura" : "bg-ink/15"}`}
              />
            ))}
          </div>
          <button
            type="button"
            className="font-label text-[0.62rem] font-bold uppercase tracking-wider text-ink-soft hover:text-ink"
            onClick={() => useGenesisStore.getState().skip()}
          >
            Skip — sample world
          </button>
        </div>
      </motion.div>
    </div>
  );
}
