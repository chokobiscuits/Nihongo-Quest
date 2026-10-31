import { afterEach, describe, expect, it } from "vitest";
import {
  AUDIO_VERSION,
  VOICE,
  clearMissingAudio,
  isSpeechAudioConfigured,
  markAudioMissing,
  speechAudioKey,
  speechAudioUrl,
  speechTextHash,
} from "./speechAudio";

afterEach(() => clearMissingAudio());

describe("speechTextHash", () => {
  it("matches the published FNV-1a 64-bit test vectors", () => {
    expect(speechTextHash("")).toBe("cbf29ce484222325");
    expect(speechTextHash("a")).toBe("af63dc4c8601ec8c");
  });

  it("is always 16 lowercase hex chars", () => {
    for (const text of ["あ", "たべる", "わたしは学生です。", "x"]) {
      expect(speechTextHash(text)).toMatch(/^[0-9a-f]{16}$/);
    }
  });

  it("normalizes to NFC, so decomposed and precomposed dakuten agree", () => {
    expect(speechTextHash("が")).toBe(speechTextHash("か\u3099"));
  });

  it("ignores surrounding whitespace", () => {
    expect(speechTextHash("  たべる \n")).toBe(speechTextHash("たべる"));
  });

  it("separates different texts", () => {
    expect(speechTextHash("あ")).not.toBe(speechTextHash("ア"));
  });
});

describe("speechAudioKey", () => {
  it("is <version>-<voice>/<hh>/<hash>.mp3 with hh the hash's last two chars", () => {
    const key = speechAudioKey("たべる");
    const hash = speechTextHash("たべる");
    expect(key).toBe(`${AUDIO_VERSION}-${VOICE}/${hash.slice(-2)}/${hash}.mp3`);
    expect(key).toMatch(/^v1-meimei-himari\/[0-9a-f]{2}\/[0-9a-f]{16}\.mp3$/);
  });

  it("is stable across calls", () => {
    expect(speechAudioKey("わたし")).toBe(speechAudioKey("わたし"));
  });
});

describe("speechAudioUrl", () => {
  const base = "https://example.supabase.co/storage/v1/object/public/speech-audio";

  it("returns null when no base URL is configured", () => {
    expect(speechAudioUrl("たべる", undefined)).toBeNull();
    expect(speechAudioUrl("たべる", "")).toBeNull();
  });

  it("joins the base URL and key, tolerating a trailing slash", () => {
    const expected = `${base}/${speechAudioKey("たべる")}`;
    expect(speechAudioUrl("たべる", base)).toBe(expected);
    expect(speechAudioUrl("たべる", `${base}/`)).toBe(expected);
  });

  it("returns null for empty text", () => {
    expect(speechAudioUrl("   ", base)).toBeNull();
  });

  it("returns null once the clip is known missing", () => {
    markAudioMissing(speechAudioKey("たべる"));
    expect(speechAudioUrl("たべる", base)).toBeNull();
    expect(speechAudioUrl("のむ", base)).not.toBeNull();
  });
});

describe("isSpeechAudioConfigured", () => {
  it("reflects whether a base URL is set, independent of missing clips", () => {
    expect(isSpeechAudioConfigured(undefined)).toBe(false);
    expect(isSpeechAudioConfigured("")).toBe(false);
    expect(isSpeechAudioConfigured("https://example.test/x")).toBe(true);
    markAudioMissing(speechAudioKey("たべる"));
    expect(isSpeechAudioConfigured("https://example.test/x")).toBe(true);
  });
});
