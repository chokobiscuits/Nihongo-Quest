import { describe, expect, it, vi } from "vitest";
import { speechAudioKey } from "../../src/components/speech/speechAudio";
import type { AudioJob } from "./jobs";
import { synthesizeJob, type SynthClient } from "./synth";
import { VoicevoxError, type AudioQuery } from "./voicevox";

function query(moras: string[]): AudioQuery {
  return {
    accent_phrases: [{ moras: moras.map((text) => ({ text })), accent: 1 }],
    speedScale: 1,
    pitchScale: 0,
    intonationScale: 1,
    volumeScale: 1,
    prePhonemeLength: 0.1,
    postPhonemeLength: 0.1,
    outputSamplingRate: 24000,
    outputStereo: true,
  };
}

const WAV = Buffer.from("wav");

/// `readings` maps the text sent to audio_query onto the moras the fake
/// engine "reads" for it.
function fakeClient(readings: Record<string, string[]>, accentPhrases?: SynthClient["accentPhrases"]) {
  return {
    audioQuery: vi.fn(async (text: string) => query(readings[text] ?? ["ア"])),
    accentPhrases:
      accentPhrases ??
      vi.fn(async (text: string) => [{ moras: [...text.replace("'", "")].map((t) => ({ text: t })), accent: 1 }]),
    synthesis: vi.fn(async () => WAV),
  };
}

function job(partial: Partial<AudioJob> & Pick<AudioJob, "text" | "kind">): AudioJob {
  return { key: speechAudioKey(partial.text), source: null, label: "t", ...partial };
}

describe("synthesizeJob", () => {
  it("builds kana jobs from kana notation and applies the voice settings", async () => {
    const client = fakeClient({});
    const result = await synthesizeJob(client, job({ text: "たべる", kind: "kana" }), 14);
    expect(client.accentPhrases).toHaveBeenCalledWith("タベル'", 14, true);
    expect(result).toMatchObject({ fallback: false, warning: null });
    const sent = client.synthesis.mock.calls[0] as unknown as [AudioQuery, number];
    expect(sent[0].speedScale).toBe(0.9);
    expect(sent[0].accent_phrases[0].moras.map((m) => m.text).join("")).toBe("タベル");
  });

  it("falls back to the plain frontend when the engine rejects kana notation", async () => {
    const client = fakeClient({ タベル: ["タ", "ベ", "ル"] }, vi.fn().mockRejectedValue(new VoicevoxError("bad kana", 400)));
    const result = await synthesizeJob(client, job({ text: "たべる", kind: "kana" }), 14);
    expect(result.warning).toBeNull();
    expect(client.synthesis).toHaveBeenCalledTimes(1);
  });

  it("rethrows connection errors so the caller can retry", async () => {
    const client = fakeClient({}, vi.fn().mockRejectedValue(new VoicevoxError("connection reset")));
    await expect(synthesizeJob(client, job({ text: "あ", kind: "kana" }), 14)).rejects.toThrow("connection reset");
  });

  it("keeps the natural rendering when the engine reads the kanji as expected", async () => {
    const client = fakeClient({ 食べる: ["タ", "ベ", "ル"] });
    const result = await synthesizeJob(client, job({ text: "たべる", kind: "word", source: "食べる" }), 14);
    expect(result).toMatchObject({ fallback: false, warning: null });
    expect(client.accentPhrases).not.toHaveBeenCalled();
  });

  it("falls back to kana when a word's kanji is read differently", async () => {
    // 日本 read にっぽん instead of the expected にほん.
    const client = fakeClient({ 日本: ["ニ", "ッ", "ポ", "ン"] });
    const result = await synthesizeJob(client, job({ text: "にほん", kind: "word", source: "日本" }), 14);
    expect(result.fallback).toBe(true);
    expect(client.accentPhrases).toHaveBeenCalledWith("ニホン'", 14, true);
  });

  it("verifies kana-only words directly with no source", async () => {
    const client = fakeClient({ ねこ: ["ネ", "コ"] });
    const result = await synthesizeJob(client, job({ text: "ねこ", kind: "word" }), 14);
    expect(result.fallback).toBe(false);
    expect(client.audioQuery).toHaveBeenCalledWith("ねこ", 14);
  });

  it("accepts particles and long vowels when verifying a sentence", async () => {
    const client = fakeClient({ 私は東京へ: ["ワ", "タ", "シ", "ワ", "ト", "ー", "キ", "ョ", "ー", "エ"] });
    const result = await synthesizeJob(
      client,
      job({ text: "わたしはとうきょうへ", kind: "sentence", source: "私は東京へ" }),
      14,
    );
    expect(result).toMatchObject({ fallback: false, warning: null });
    const sent = client.synthesis.mock.calls[0] as unknown as [AudioQuery, number];
    expect(sent[0].speedScale).toBe(0.85);
  });

  it("synthesizes the original characters unverified when the expected text still has kanji", async () => {
    const client = fakeClient({ "彼は廃屋に隠れた。": ["カ", "レ"] });
    const result = await synthesizeJob(
      client,
      job({ text: "かれははいおくに隠れた。", kind: "sentence", source: "彼は廃屋に隠れた。" }),
      14,
    );
    expect(result).toMatchObject({ fallback: false, verified: false, warning: null });
    expect(client.audioQuery).toHaveBeenCalledWith("彼は廃屋に隠れた。", 14);
  });

  it("re-queries a sentence as kana on mismatch and warns if it still differs", async () => {
    const client = fakeClient({ 私は: ["ア"], わたしは: ["ワ", "タ", "シ", "ワ"] });
    const ok = await synthesizeJob(client, job({ text: "わたしは", kind: "sentence", source: "私は" }), 14);
    expect(ok).toMatchObject({ fallback: true, warning: null });

    const bad = fakeClient({ 私は: ["ア"], わたしは: ["ア"] });
    const result = await synthesizeJob(bad, job({ text: "わたしは", kind: "sentence", source: "私は" }), 14);
    expect(result.fallback).toBe(true);
    expect(result.warning).toMatch(/differ/);
  });
});
