"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { DEFAULT_SETTINGS, getLocal, setLocal, type Settings } from "@/lib/storage";
import { clearApiKey, hasApiKey, storeApiKey } from "@/lib/crypto";
import { MODEL_CHAIN } from "@/lib/ai/models";
import { useUIStore } from "@/stores/uiStore";
import { useWorldStore } from "@/stores/worldStore";
import { tryParseWorldState } from "@/engine/schema/world";

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="font-label text-[0.66rem] font-semibold uppercase tracking-wider text-ink-soft">
        {label}
      </span>
      {children}
    </div>
  );
}

const selectCls =
  "rounded-full border border-white/70 bg-white/70 px-2.5 py-1 font-body text-[0.7rem] text-ink outline-none";

/**
 * Local-only settings — no account, no login. The OpenRouter key is
 * encrypted at rest (AES-GCM, device secret) and never leaves the browser
 * except toward OpenRouter itself.
 */
export default function SettingsSheet() {
  // sheet only mounts client-side, after user interaction — lazy reads are safe
  const [settings, setSettings] = useState<Settings>(() =>
    getLocal("settings", DEFAULT_SETTINGS)
  );
  const [keyInput, setKeyInput] = useState("");
  const [keySet, setKeySet] = useState(() => hasApiKey());
  const [savedFlash, setSavedFlash] = useState(false);

  const update = (patch: Partial<Settings>): void => {
    const next = { ...settings, ...patch };
    setSettings(next);
    setLocal("settings", next);
  };

  const saveKey = async (): Promise<void> => {
    const trimmed = keyInput.trim();
    if (!trimmed) return;
    await storeApiKey(trimmed);
    setKeyInput("");
    setKeySet(true);
    setSavedFlash(true);
    setTimeout(() => setSavedFlash(false), 1600);
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: -16, scale: 0.96 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: -10, scale: 0.97 }}
      transition={{ type: "spring", stiffness: 360, damping: 30 }}
      className="glass-panel pointer-events-auto absolute left-4 top-16 w-72 px-5 py-4 select-none"
    >
      <div className="flex items-center justify-between">
        <h2 className="font-heading text-sm font-bold text-ink">Settings</h2>
        <button
          type="button"
          aria-label="Close settings"
          className="rounded-full px-2 py-0.5 font-heading text-xs font-bold text-ink-soft hover:bg-white/60"
          onClick={() => useUIStore.getState().dismiss()}
        >
          ✕
        </button>
      </div>

      <div className="mt-3 space-y-3">
        <div>
          <Row label="OpenRouter key">
            <span
              className={`rounded-full px-2 py-0.5 font-label text-[0.6rem] font-bold ${
                keySet ? "bg-[#3faf6e] text-white" : "bg-white/70 text-ink-soft"
              }`}
            >
              {keySet ? "Stored ✓" : "Not set"}
            </span>
          </Row>
          <div className="mt-1.5 flex gap-1.5">
            <input
              type="password"
              value={keyInput}
              onChange={(e) => setKeyInput(e.target.value)}
              placeholder="sk-or-…"
              autoComplete="off"
              className="min-w-0 flex-1 rounded-full border border-white/70 bg-white/70 px-3 py-1 font-body text-[0.7rem] text-ink outline-none placeholder:text-ink-soft/50"
            />
            <button type="button" className="pill-btn" onClick={() => void saveKey()}>
              {savedFlash ? "Saved" : "Save"}
            </button>
          </div>
          {keySet && (
            <button
              type="button"
              className="mt-1 font-body text-[0.62rem] text-ink-soft underline"
              onClick={() => {
                clearApiKey();
                setKeySet(false);
              }}
            >
              Forget key
            </button>
          )}
          <p className="mt-1 font-body text-[0.6rem] leading-snug text-ink-soft/80">
            Encrypted in this browser. Sent only to OpenRouter.
          </p>
        </div>

        <Row label="Model">
          <select
            className={selectCls}
            value={settings.preferredModel}
            onChange={(e) => update({ preferredModel: e.target.value })}
          >
            {MODEL_CHAIN.map((m) => (
              <option key={m} value={m}>
                {m.split("/")[1]?.replace(":free", "") ?? m}
              </option>
            ))}
          </select>
        </Row>

        <Row label="Quality">
          <select
            className={selectCls}
            value={settings.quality}
            onChange={(e) => update({ quality: e.target.value as Settings["quality"] })}
          >
            <option value="auto">Auto</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
        </Row>

        <Row label="Sound">
          <button
            type="button"
            className={`rounded-full px-3 py-1 font-label text-[0.62rem] font-bold ${
              settings.sound ? "bg-[#3faf6e] text-white" : "bg-white/70 text-ink-soft"
            }`}
            onClick={() => update({ sound: !settings.sound })}
          >
            {settings.sound ? "On" : "Off"}
          </button>
        </Row>

        <Row label="Reduced motion">
          <select
            className={selectCls}
            value={settings.reducedMotion}
            onChange={(e) =>
              update({ reducedMotion: e.target.value as Settings["reducedMotion"] })
            }
          >
            <option value="auto">Follow system</option>
            <option value="on">On</option>
            <option value="off">Off</option>
          </select>
        </Row>

        <div className="border-t border-white/60 pt-2.5">
          <Row label="Your world">
            <div className="flex gap-1.5">
              <button type="button" className="pill-btn secondary" onClick={exportWorld}>
                Export
              </button>
              <label className="pill-btn secondary cursor-pointer">
                Import
                <input
                  type="file"
                  accept=".json,.lifeverse"
                  className="hidden"
                  onChange={(e) => void importWorld(e)}
                />
              </label>
            </div>
          </Row>
          <p className="mt-1 font-body text-[0.6rem] leading-snug text-ink-soft/80">
            A .lifeverse.json file — share it, back it up, carry it anywhere.
          </p>
        </div>
      </div>
    </motion.div>
  );
}

function exportWorld(): void {
  const state = useWorldStore.getState().state;
  if (!state) return;
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `world-${state.timestamp.slice(0, 10)}.lifeverse.json`;
  a.click();
  URL.revokeObjectURL(url);
}

async function importWorld(e: React.ChangeEvent<HTMLInputElement>): Promise<void> {
  const file = e.target.files?.[0];
  e.target.value = "";
  if (!file) return;
  try {
    const parsed: unknown = JSON.parse(await file.text());
    const state = tryParseWorldState(parsed);
    if (state) useWorldStore.getState().replaceState(state);
  } catch {
    // malformed file — the world stays unchanged by design
  }
}
