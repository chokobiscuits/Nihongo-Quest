import { markAudioMissing, speechAudioKey, speechAudioUrl } from "./speechAudio";

/// Picks a Japanese voice from the browser, preferring an exact ja-JP match.
/// Voices often load after first paint, so callers re-check on `voiceschanged`.
export function pickJapaneseVoice(): SpeechSynthesisVoice | null {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return null;
  const voices = window.speechSynthesis.getVoices();
  return (
    voices.find((v) => v.lang.toLowerCase().replace("_", "-") === "ja-jp") ??
    voices.find((v) => v.lang.toLowerCase().startsWith("ja")) ??
    null
  );
}

export interface PlaySpeechOptions {
  /// Explicit clip to play instead of the pre-generated one for `text`.
  audioUrl?: string;
  /// Fires once when playback finishes, fails, or is stopped or superseded.
  onEnd?: () => void;
  /// Fires when a clip could not be played, with the URL that failed.
  onAudioFailed?: (url: string) => void;
}

/// The one playback that is active across the whole page. A new playback
/// stops it first, matching speechSynthesis's own one-at-a-time behaviour
/// and keeping a clip and a synthesized voice from talking over each other.
let active: { stop: () => void } | null = null;

/// Plays `text`: the pre-generated clip when one is configured and not known
/// missing, otherwise (or when the clip fails) the browser's Japanese voice.
/// Silently does nothing when neither is available. Returns a `stop` function
/// that halts only this playback.
///
/// Lives outside any component so audio started by a quiz submit is not cut
/// off when the button or card that triggered it unmounts.
export function playSpeech(text: string, options: PlaySpeechOptions = {}): () => void {
  active?.stop();

  let ended = false;
  let halt: () => void = () => {};
  const playback = {
    stop: () => {
      if (ended) return;
      halt();
      finish();
    },
  };
  function finish() {
    if (ended) return;
    ended = true;
    if (active === playback) active = null;
    options.onEnd?.();
  }
  active = playback;

  function speakWithVoice() {
    const voice = pickJapaneseVoice();
    if (!voice) {
      finish();
      return;
    }
    const synth = window.speechSynthesis;
    synth.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "ja-JP";
    utterance.rate = 0.9;
    utterance.voice = voice;
    utterance.onend = finish;
    utterance.onerror = finish;
    halt = () => {
      utterance.onend = null;
      utterance.onerror = null;
      synth.cancel();
    };
    synth.speak(utterance);
  }

  const url = options.audioUrl ?? speechAudioUrl(text);
  if (!url) {
    speakWithVoice();
    return playback.stop;
  }

  const audio = new Audio();
  audio.preload = "none";
  halt = () => {
    audio.onended = null;
    audio.onerror = null;
    audio.pause();
  };
  // Both the media element's error event and a rejected play() can report
  // the same failure; only the first one falls back.
  let failed = false;
  const fail = () => {
    if (ended || failed) return;
    failed = true;
    if (!options.audioUrl) markAudioMissing(speechAudioKey(text));
    options.onAudioFailed?.(url);
    halt();
    speakWithVoice();
  };
  audio.onended = finish;
  audio.onerror = fail;
  audio.src = url;
  audio.play().catch(fail);

  return playback.stop;
}
