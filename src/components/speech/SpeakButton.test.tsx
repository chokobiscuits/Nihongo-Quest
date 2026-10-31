import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { SpeakButton } from "./SpeakButton";
import { clearMissingAudio, markAudioMissing, speechAudioKey, speechAudioUrl } from "./speechAudio";
import { playSpeech } from "./speechPlayer";

const BASE = "https://example.supabase.co/storage/v1/object/public/speech-audio";

class FakeAudio {
  static instances: FakeAudio[] = [];
  static playResult: () => Promise<void> = () => Promise.resolve();
  src = "";
  preload = "";
  onended: (() => void) | null = null;
  onerror: (() => void) | null = null;
  play = vi.fn(() => FakeAudio.playResult());
  pause = vi.fn();
  constructor() {
    FakeAudio.instances.push(this);
  }
}

class FakeUtterance {
  lang = "";
  rate = 1;
  voice: unknown = null;
  onend: (() => void) | null = null;
  onerror: (() => void) | null = null;
  constructor(readonly text: string) {}
}

const synth = {
  getVoices: vi.fn((): { lang: string }[] => []),
  speak: vi.fn(),
  cancel: vi.fn(),
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
};

function installSynth() {
  Object.defineProperty(window, "speechSynthesis", { value: synth, configurable: true, writable: true });
}

beforeEach(() => {
  FakeAudio.instances = [];
  FakeAudio.playResult = () => Promise.resolve();
  vi.stubGlobal("Audio", FakeAudio);
  vi.stubGlobal("SpeechSynthesisUtterance", FakeUtterance);
  synth.getVoices.mockReturnValue([]);
  synth.speak.mockClear();
  synth.cancel.mockClear();
});

afterEach(() => {
  cleanup();
  clearMissingAudio();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  Reflect.deleteProperty(window, "speechSynthesis");
});

describe("SpeakButton", () => {
  it("renders nothing without a clip URL or a Japanese voice", () => {
    const { container } = render(<SpeakButton text="たべる" />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders nothing when only a non-Japanese voice exists", () => {
    installSynth();
    synth.getVoices.mockReturnValue([{ lang: "en-US" }]);
    const { container } = render(<SpeakButton text="たべる" />);
    expect(container).toBeEmptyDOMElement();
  });

  it("shows without any voice when the audio base URL is set, and plays the clip", () => {
    vi.stubEnv("NEXT_PUBLIC_SPEECH_AUDIO_BASE_URL", BASE);
    render(<SpeakButton text="たべる" />);

    // The audio element is created in the click handler, not on render.
    expect(FakeAudio.instances).toHaveLength(0);
    fireEvent.click(screen.getByRole("button"));

    expect(FakeAudio.instances).toHaveLength(1);
    const audio = FakeAudio.instances[0];
    expect(audio.src).toBe(`${BASE}/${speechAudioKey("たべる")}`);
    expect(audio.preload).toBe("none");
    expect(audio.play).toHaveBeenCalledTimes(1);
  });

  it("shows the disabled state, not nothing, when another button marked the clip missing", () => {
    vi.stubEnv("NEXT_PUBLIC_SPEECH_AUDIO_BASE_URL", BASE);
    const { rerender } = render(<SpeakButton text="たべる" />);
    expect(screen.getByRole("button")).toBeEnabled();

    markAudioMissing(speechAudioKey("たべる"));
    rerender(<SpeakButton text="たべる" label="again" />);

    expect(screen.getByRole("button", { name: "Audio unavailable" })).toBeDisabled();
  });

  it("prefers an explicit audioUrl over the derived clip", () => {
    vi.stubEnv("NEXT_PUBLIC_SPEECH_AUDIO_BASE_URL", BASE);
    render(<SpeakButton text="たべる" audioUrl="https://cdn.example/a.mp3" />);
    fireEvent.click(screen.getByRole("button"));
    expect(FakeAudio.instances[0].src).toBe("https://cdn.example/a.mp3");
  });

  it("shows a disabled unavailable state when the clip errors and there is no voice", () => {
    vi.stubEnv("NEXT_PUBLIC_SPEECH_AUDIO_BASE_URL", BASE);
    render(<SpeakButton text="たべる" />);
    fireEvent.click(screen.getByRole("button"));

    act(() => FakeAudio.instances[0].onerror?.());

    const button = screen.getByRole("button", { name: "Audio unavailable" });
    expect(button).toBeDisabled();
    // The failure is remembered, so other buttons stop requesting this clip.
    expect(speechAudioUrl("たべる", BASE)).toBeNull();
  });

  it("falls back to the browser voice when the clip errors", () => {
    vi.stubEnv("NEXT_PUBLIC_SPEECH_AUDIO_BASE_URL", BASE);
    installSynth();
    synth.getVoices.mockReturnValue([{ lang: "ja-JP" }]);
    render(<SpeakButton text="たべる" />);
    fireEvent.click(screen.getByRole("button"));

    act(() => FakeAudio.instances[0].onerror?.());

    expect(synth.speak).toHaveBeenCalledTimes(1);
    const utterance = synth.speak.mock.calls[0][0] as FakeUtterance;
    expect(utterance.text).toBe("たべる");
    expect(utterance.lang).toBe("ja-JP");
    // Still a working button, not the disabled state.
    expect(screen.getByRole("button")).toBeEnabled();
  });

  it("falls back to the browser voice when play() rejects", async () => {
    vi.stubEnv("NEXT_PUBLIC_SPEECH_AUDIO_BASE_URL", BASE);
    installSynth();
    synth.getVoices.mockReturnValue([{ lang: "ja-JP" }]);
    render(<SpeakButton text="のむ" />);

    const click = screen.getByRole("button");
    FakeAudio.playResult = () => Promise.reject(new Error("blocked"));
    await act(async () => {
      fireEvent.click(click);
    });

    expect(synth.speak).toHaveBeenCalledTimes(1);
  });

  it("speaks with the browser voice when there is no clip URL", () => {
    installSynth();
    synth.getVoices.mockReturnValue([{ lang: "ja-JP" }]);
    render(<SpeakButton text="ねこ" />);
    fireEvent.click(screen.getByRole("button"));

    expect(FakeAudio.instances).toHaveLength(0);
    expect(synth.speak).toHaveBeenCalledTimes(1);
    expect((synth.speak.mock.calls[0][0] as FakeUtterance).rate).toBe(0.9);
  });

  it("stops only its own playback when it unmounts", () => {
    vi.stubEnv("NEXT_PUBLIC_SPEECH_AUDIO_BASE_URL", BASE);
    const { unmount } = render(<SpeakButton text="たべる" />);
    fireEvent.click(screen.getByRole("button"));
    const own = FakeAudio.instances[0];

    unmount();
    expect(own.pause).toHaveBeenCalled();

    // A playback started elsewhere (a quiz's auto-play) is not touched by a
    // button that was never involved in it.
    const other = render(<SpeakButton text="のむ" />);
    other.unmount();
    playSpeech("あ");
    const quizAudio = FakeAudio.instances[FakeAudio.instances.length - 1];
    const third = render(<SpeakButton text="ねこ" />);
    third.unmount();
    expect(quizAudio.pause).not.toHaveBeenCalled();
  });
});
