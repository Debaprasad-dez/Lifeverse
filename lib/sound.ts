/**
 * Tiny WebAudio synth — no assets. Soft whoosh on flight, glass chime on
 * select, pop on dismiss. All gated by settings.sound; context created
 * lazily on first user gesture (autoplay policy).
 */

import { getLocal, DEFAULT_SETTINGS } from "@/lib/storage";

let ctx: AudioContext | null = null;

function audio(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!getLocal("settings", DEFAULT_SETTINGS).sound) return null;
  if (!ctx) {
    try {
      ctx = new AudioContext();
    } catch {
      return null;
    }
  }
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

/** Filtered-noise sweep — camera flight. */
export function playWhoosh(duration = 0.9): void {
  const ac = audio();
  if (!ac) return;
  const frames = Math.floor(ac.sampleRate * duration);
  const buffer = ac.createBuffer(1, frames, ac.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < frames; i++) data[i] = Math.random() * 2 - 1;

  const src = ac.createBufferSource();
  src.buffer = buffer;
  const filter = ac.createBiquadFilter();
  filter.type = "bandpass";
  filter.Q.value = 0.8;
  filter.frequency.setValueAtTime(220, ac.currentTime);
  filter.frequency.exponentialRampToValueAtTime(880, ac.currentTime + duration * 0.45);
  filter.frequency.exponentialRampToValueAtTime(180, ac.currentTime + duration);
  const gain = ac.createGain();
  gain.gain.setValueAtTime(0.0001, ac.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.07, ac.currentTime + duration * 0.3);
  gain.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + duration);
  src.connect(filter).connect(gain).connect(ac.destination);
  src.start();
}

function tone(freq: number, at: number, dur: number, peak: number): void {
  const ac = ctx;
  if (!ac) return;
  const osc = ac.createOscillator();
  osc.type = "sine";
  osc.frequency.value = freq;
  const gain = ac.createGain();
  gain.gain.setValueAtTime(0.0001, ac.currentTime + at);
  gain.gain.exponentialRampToValueAtTime(peak, ac.currentTime + at + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + at + dur);
  osc.connect(gain).connect(ac.destination);
  osc.start(ac.currentTime + at);
  osc.stop(ac.currentTime + at + dur + 0.05);
}

/** Two-note glass chime — selection. */
export function playChime(): void {
  if (!audio()) return;
  tone(740, 0, 0.5, 0.045);
  tone(1108, 0.07, 0.6, 0.035);
}

/** Soft pop — dismiss. */
export function playPop(): void {
  if (!audio()) return;
  tone(420, 0, 0.12, 0.05);
}
