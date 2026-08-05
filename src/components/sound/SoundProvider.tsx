"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { soundManager } from "@/lib/sound/SoundManager";

export interface SoundSettings {
  enabled: boolean;
  volume: number;
}

interface SoundContextValue extends SoundSettings {
  /// Lets the settings page preview a change before the server round-trip
  /// lands, so the volume slider is audible while you drag it.
  setLocal: (next: Partial<SoundSettings>) => void;
}

const SoundContext = createContext<SoundContextValue>({
  enabled: false,
  volume: 0.6,
  setLocal: () => {},
});

export function SoundProvider({
  enabled,
  volume,
  children,
}: SoundSettings & { children: ReactNode }) {
  // Optimistic overlay on top of the server's values, so the settings page
  // can preview a change before its round-trip lands. Cleared whenever the
  // server sends something new — that is the authoritative value, and it
  // arrives via props rather than a sync effect.
  const [override, setOverride] = useState<Partial<SoundSettings> | null>(null);
  const [serverKey, setServerKey] = useState(`${enabled}:${volume}`);
  const currentKey = `${enabled}:${volume}`;
  if (currentKey !== serverKey) {
    setServerKey(currentKey);
    setOverride(null);
  }

  const local = useMemo<SoundSettings>(
    () => ({ enabled, volume, ...override }),
    [enabled, volume, override],
  );

  useEffect(() => {
    soundManager.configure(local);
  }, [local]);

  // Browsers suspend an AudioContext until a user gesture. Warming it on the
  // first pointerdown means the first real sound is not racing the resume.
  useEffect(() => {
    if (!local.enabled) return;
    const warm = () => soundManager.warm();
    window.addEventListener("pointerdown", warm, { once: true });
    window.addEventListener("keydown", warm, { once: true });
    return () => {
      window.removeEventListener("pointerdown", warm);
      window.removeEventListener("keydown", warm);
    };
  }, [local.enabled]);

  const value = useMemo<SoundContextValue>(
    () => ({
      ...local,
      setLocal: (next) => setOverride((prev) => ({ ...prev, ...next })),
    }),
    [local],
  );

  return <SoundContext.Provider value={value}>{children}</SoundContext.Provider>;
}

export function useSoundSettings(): SoundContextValue {
  return useContext(SoundContext);
}
