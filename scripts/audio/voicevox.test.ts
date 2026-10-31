import { describe, expect, it, vi } from "vitest";
import {
  VoicevoxClient,
  VoicevoxError,
  applyVoiceSettings,
  findSpeakerId,
  normalizeKanaForCompare,
  queryMoraText,
  readingsMatch,
  toKanaNotation,
  toKatakana,
  type AudioQuery,
} from "./voicevox";

function query(moraTexts: string[][], extra: Record<string, unknown> = {}): AudioQuery {
  return {
    accent_phrases: moraTexts.map((moras) => ({ moras: moras.map((text) => ({ text })), accent: 1 })),
    speedScale: 1,
    pitchScale: 0,
    intonationScale: 1,
    volumeScale: 1,
    prePhonemeLength: 0.1,
    postPhonemeLength: 0.1,
    outputSamplingRate: 24000,
    outputStereo: true,
    ...extra,
  };
}

describe("normalizeKanaForCompare", () => {
  it("folds katakana to hiragana and drops punctuation and spaces", () => {
    expect(normalizeKanaForCompare("タベル")).toBe("たべる");
    expect(normalizeKanaForCompare("わたし、は。 ")).toBe("わたしわ");
  });

  it("treats particles は/へ/を as their spoken forms", () => {
    expect(readingsMatch("わたしは", "ワタシワ")).toBe(true);
    expect(readingsMatch("がっこうへ", "ガッコーエ")).toBe(true);
    expect(readingsMatch("ほんを", "ホンオ")).toBe(true);
  });

  it("expands the long vowel mark and equates spelled-out long vowels", () => {
    expect(readingsMatch("とうきょう", "トーキョー")).toBe(true);
    expect(readingsMatch("せんせい", "センセー")).toBe(true);
    expect(readingsMatch("おおきい", "オーキー")).toBe(true);
    expect(readingsMatch("ラーメン", "らあめん")).toBe(true);
  });

  it("equates ぢ/づ with じ/ず", () => {
    expect(readingsMatch("はなぢ", "ハナジ")).toBe(true);
    expect(readingsMatch("つづく", "ツズク")).toBe(true);
  });
});

describe("readingsMatch", () => {
  it("accepts the same reading across scripts", () => {
    expect(readingsMatch("にほんご", "ニホンゴ")).toBe(true);
  });

  it("accepts the engine's spelling of ほう and small vowels", () => {
    expect(readingsMatch("ほうこう", "ホオコオ")).toBe(true);
    expect(readingsMatch("ねぇ", "ネエ")).toBe(true);
    expect(readingsMatch("ファン", "ファン")).toBe(true);
  });

  it("flags a different reading of the same kanji", () => {
    // 日本 read にっぽん vs にほん
    expect(readingsMatch("にほん", "ニッポン")).toBe(false);
    // 人気 read にんき vs ひとけ
    expect(readingsMatch("にんき", "ヒトケ")).toBe(false);
  });

  it("flags a missing or extra mora", () => {
    expect(readingsMatch("たべる", "タベ")).toBe(false);
    expect(readingsMatch("たべ", "タベル")).toBe(false);
  });

  it("never matches an empty expected reading", () => {
    expect(readingsMatch("", "")).toBe(false);
    expect(readingsMatch("。", "、")).toBe(false);
  });
});

describe("kana helpers", () => {
  it("converts hiragana to katakana and leaves the rest", () => {
    expect(toKatakana("たべる")).toBe("タベル");
    expect(toKatakana("コーヒーabc")).toBe("コーヒーabc");
  });

  it("marks the final mora for kana notation", () => {
    expect(toKanaNotation("たべる")).toBe("タベル'");
  });

  it("joins mora text across accent phrases", () => {
    expect(queryMoraText(query([["ワ", "タ", "シ"], ["ワ"]]))).toBe("ワタシワ");
  });
});

describe("applyVoiceSettings", () => {
  it("applies word settings without mutating the input", () => {
    const input = query([["タ"]]);
    const out = applyVoiceSettings(input, "word");
    expect(out).toMatchObject({
      speedScale: 0.9,
      intonationScale: 1.05,
      prePhonemeLength: 0.1,
      postPhonemeLength: 0.15,
      outputSamplingRate: 24000,
      outputStereo: false,
    });
    expect(out).not.toHaveProperty("pauseLengthScale");
    expect(input.speedScale).toBe(1);
    expect(input.outputStereo).toBe(true);
  });

  it("slows sentences and widens pauses only where the engine supports it", () => {
    expect(applyVoiceSettings(query([["タ"]]), "sentence").speedScale).toBe(0.85);
    expect(applyVoiceSettings(query([["タ"]]), "sentence")).not.toHaveProperty("pauseLengthScale");
    expect(applyVoiceSettings(query([["タ"]], { pauseLengthScale: 1 }), "sentence").pauseLengthScale).toBe(1.2);
    expect(applyVoiceSettings(query([["タ"]], { pauseLengthScale: 1 }), "word").pauseLengthScale).toBe(1);
  });
});

describe("findSpeakerId", () => {
  const speakers = [
    { name: "四国めたん", styles: [{ name: "ノーマル", id: 2 }] },
    {
      name: "冥鳴ひまり",
      styles: [
        { name: "ノーマル", id: 14 },
        { name: "あまあま", id: 15 },
      ],
    },
  ];

  it("resolves a speaker and style by name", () => {
    expect(findSpeakerId(speakers, "冥鳴ひまり", "ノーマル")).toBe(14);
  });

  it("returns null when the voice or style is not installed", () => {
    expect(findSpeakerId(speakers, "冥鳴ひまり", "ささやき")).toBeNull();
    expect(findSpeakerId(speakers, "春日部つむぎ", "ノーマル")).toBeNull();
  });
});

describe("VoicevoxClient", () => {
  function jsonResponse(body: unknown, status = 200) {
    return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
  }

  it("reads the engine version", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse("0.14.7"));
    const client = new VoicevoxClient("http://engine:50021/", fetchMock as unknown as typeof fetch);
    expect(await client.version()).toBe("0.14.7");
    expect(fetchMock.mock.calls[0][0]).toBe("http://engine:50021/version");
  });

  it("posts audio_query with encoded text and speaker", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(query([["タ"]])));
    const client = new VoicevoxClient("http://engine", fetchMock as unknown as typeof fetch);
    await client.audioQuery("食べる", 14);
    const [url, init] = fetchMock.mock.calls[0];
    const parsed = new URL(url as string);
    expect(parsed.pathname).toBe("/audio_query");
    expect(parsed.searchParams.get("text")).toBe("食べる");
    expect(parsed.searchParams.get("speaker")).toBe("14");
    expect((init as RequestInit).method).toBe("POST");
  });

  it("passes is_kana to accent_phrases", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse([]));
    const client = new VoicevoxClient("http://engine", fetchMock as unknown as typeof fetch);
    await client.accentPhrases("タベル'", 14, true);
    const parsed = new URL(fetchMock.mock.calls[0][0] as string);
    expect(parsed.pathname).toBe("/accent_phrases");
    expect(parsed.searchParams.get("is_kana")).toBe("true");
  });

  it("sends the query as JSON to synthesis and returns the WAV bytes", async () => {
    const wav = new Uint8Array([82, 73, 70, 70]);
    const fetchMock = vi.fn().mockResolvedValue(new Response(wav, { status: 200 }));
    const client = new VoicevoxClient("http://engine", fetchMock as unknown as typeof fetch);
    const body = query([["タ"]]);
    const out = await client.synthesis(body, 14);
    const [url, init] = fetchMock.mock.calls[0];
    expect(new URL(url as string).pathname).toBe("/synthesis");
    expect(JSON.parse((init as RequestInit).body as string)).toEqual(body);
    expect(Array.from(out)).toEqual([82, 73, 70, 70]);
  });

  it("raises a VoicevoxError carrying the status on a non-2xx response", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("bad kana", { status: 400 }));
    const client = new VoicevoxClient("http://engine", fetchMock as unknown as typeof fetch);
    await expect(client.accentPhrases("x", 1, true)).rejects.toMatchObject({ name: "VoicevoxError", status: 400 });
  });

  it("wraps a network failure in a VoicevoxError with no status", async () => {
    const fetchMock = vi.fn().mockRejectedValue(new TypeError("fetch failed"));
    const client = new VoicevoxClient("http://engine", fetchMock as unknown as typeof fetch);
    const error = await client.version().catch((e) => e);
    expect(error).toBeInstanceOf(VoicevoxError);
    expect(error.status).toBeUndefined();
  });
});
