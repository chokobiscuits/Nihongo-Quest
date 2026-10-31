"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { isSpeechAudioConfigured, speechAudioUrl } from "./speechAudio";
import { pickJapaneseVoice, playSpeech } from "./speechPlayer";

export interface SpeakButtonProps {
  /// What to speak. Pass kana so the engine does not guess a kanji reading.
  text: string;
  /// Explicit clip to play instead of the pre-generated one for `text`.
  audioUrl?: string;
  label?: string;
  className?: string;
}

const BUTTON_CLASS =
  "inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-[var(--radius-chip)] border border-line bg-surface text-text-muted hover:border-line-strong hover:bg-surface-3 hover:text-text transition-colors duration-[var(--duration-fast)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus)]";

function SpeakerIcon({ playing }: { playing: boolean }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      width="16"
      height="16"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn(playing && "animate-pulse")}
    >
      <path d="M11 5 6 9H3v6h3l5 4V5z" fill="currentColor" />
      <path d="M15.5 8.5a5 5 0 0 1 0 7" />
      <path d="M18.5 5.5a9 9 0 0 1 0 13" />
    </svg>
  );
}

/// Small speaker button that plays the pre-generated clip for `text` when
/// NEXT_PUBLIC_SPEECH_AUDIO_BASE_URL is set, falling back to the browser's
/// Japanese voice when the clip is missing or fails. The clip URL is a
/// build-time value, so server and client agree; the voice is only known in
/// an effect, so without a clip the button renders nothing until a voice is
/// found. With clips off and no voice it renders nothing; with clips on but
/// the clip missing (here or per another button) and no voice, it shows a
/// disabled state so the layout does not shift.
export function SpeakButton({ text, audioUrl, label, className }: SpeakButtonProps) {
  const [hasVoice, setHasVoice] = useState(false);
  const [playing, setPlaying] = useState(false);
  // The clip URL that errored for this button. Keyed by URL rather than a
  // flag so a reused button given new text starts fresh.
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const stopRef = useRef<(() => void) | null>(null);
  const mountedRef = useRef(false);

  const resolvedUrl = audioUrl ?? speechAudioUrl(text);
  const url = resolvedUrl !== failedUrl ? resolvedUrl : null;
  // A clip was expected for this button (explicit, or the feature is on) but
  // is not playable: it failed here or another button found it missing.
  const clipUnavailable = Boolean(audioUrl) || isSpeechAudioConfigured();

  useEffect(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    const synth = window.speechSynthesis;
    // Voices often load after first paint; re-check on voiceschanged.
    const refresh = () => setHasVoice(pickJapaneseVoice() !== null);
    refresh();
    synth.addEventListener("voiceschanged", refresh);
    return () => synth.removeEventListener("voiceschanged", refresh);
  }, []);

  // Stop only what this button started when it unmounts (next lesson item),
  // so unmounting one button never cuts off another's, or a quiz's, audio.
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      stopRef.current?.();
      stopRef.current = null;
    };
  }, []);

  const speak = useCallback(() => {
    setPlaying(true);
    stopRef.current = playSpeech(text, {
      audioUrl,
      onEnd: () => {
        // Late end events (including a supersede by another playback) must
        // not set state after unmount.
        if (mountedRef.current) setPlaying(false);
      },
      onAudioFailed: (failed) => {
        if (mountedRef.current) setFailedUrl(failed);
      },
    });
  }, [text, audioUrl]);

  if (!url && !hasVoice) {
    if (!clipUnavailable) return null;
    return (
      <button
        type="button"
        disabled
        aria-label="Audio unavailable"
        title="Audio unavailable"
        className={cn(BUTTON_CLASS, "cursor-not-allowed opacity-40", className)}
      >
        <SpeakerIcon playing={false} />
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={speak}
      aria-label={label ?? `Play pronunciation of ${text}`}
      className={cn(BUTTON_CLASS, playing && "border-line-strong bg-surface-3 text-text", className)}
    >
      <SpeakerIcon playing={playing} />
    </button>
  );
}
