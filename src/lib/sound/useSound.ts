"use client";

import { useCallback, useEffect } from "react";
import { soundManager } from "./SoundManager";
import type { SoundId } from "./manifest";
import { useSoundSettings } from "@/components/sound/SoundProvider";

export type PlaySound = (id: SoundId, opts?: { rate?: number }) => void;

/// Returns a stable `play` function. Handing back a function rather than the
/// manager keeps call sites out of the engine's internals.
///
/// Pass `preload` for sounds this component will fire in response to a
/// keystroke — the first play of an unloaded sound is dropped rather than
/// delayed, so the answer sounds want warming when the quiz mounts.
export function useSound(preload?: SoundId[]): PlaySound {
  const { enabled } = useSoundSettings();

  // Effect, not render: preload() fetches, and firing that during render
  // would run it on every re-render.
  useEffect(() => {
    if (!enabled || !preload?.length) return;
    soundManager.preload(preload);
    // Spread into the dep list so a stable set of ids does not re-fetch when
    // the caller passes a fresh array literal each render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, preload?.join(",")]);

  return useCallback((id: SoundId, opts?: { rate?: number }) => {
    soundManager.play(id, opts);
  }, []);
}
