"use client";

import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import type { SpeechSettings } from "./speechSettings";

interface SpeechSettingsContextValue extends SpeechSettings {
  /// Lets the settings page flip the toggle before the server round-trip
  /// lands, so the quiz behaves correctly immediately.
  setLocal: (next: Partial<SpeechSettings>) => void;
}

// Off outside a provider (tests, isolated renders): never make noise unasked.
const SpeechSettingsContext = createContext<SpeechSettingsContextValue>({
  autoplay: false,
  setLocal: () => {},
});

export function SpeechSettingsProvider({
  autoplay,
  children,
}: SpeechSettings & { children: ReactNode }) {
  // Optimistic overlay on the server's value, dropped whenever the server
  // sends a new one (same pattern as SoundProvider).
  const [override, setOverride] = useState<Partial<SpeechSettings> | null>(null);
  const [serverValue, setServerValue] = useState(autoplay);
  if (autoplay !== serverValue) {
    setServerValue(autoplay);
    setOverride(null);
  }

  const value = useMemo<SpeechSettingsContextValue>(
    () => ({
      autoplay: override?.autoplay ?? autoplay,
      setLocal: (next) => setOverride((prev) => ({ ...prev, ...next })),
    }),
    [autoplay, override],
  );

  return <SpeechSettingsContext.Provider value={value}>{children}</SpeechSettingsContext.Provider>;
}

export function useSpeechSettings(): SpeechSettingsContextValue {
  return useContext(SpeechSettingsContext);
}
