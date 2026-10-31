import { describe, expect, it } from "vitest";
import {
  cleanReadingForSpeech,
  furiganaToSpeechText,
  sentenceSpeechText,
  subjectSpeechText,
  subjectSpeechTexts,
} from "./speechText";

describe("cleanReadingForSpeech", () => {
  it("drops the okurigana dot", () => {
    expect(cleanReadingForSpeech("た.べる")).toBe("たべる");
  });

  it("strips leading and trailing affix dashes", () => {
    expect(cleanReadingForSpeech("-ざま")).toBe("ざま");
    expect(cleanReadingForSpeech("ぬ-")).toBe("ぬ");
    expect(cleanReadingForSpeech("-あ.げる-")).toBe("あげる");
  });

  it("keeps the long vowel mark", () => {
    expect(cleanReadingForSpeech("コーヒー")).toBe("コーヒー");
  });

  it("leaves plain readings alone", () => {
    expect(cleanReadingForSpeech("にち")).toBe("にち");
  });
});

describe("furiganaToSpeechText", () => {
  it("prefers the reading over the base text", () => {
    expect(
      furiganaToSpeechText([
        { ruby: "私", rt: "わたし" },
        { ruby: "は" },
        { ruby: "学生", rt: "がくせい" },
        { ruby: "です。" },
      ]),
    ).toBe("わたしはがくせいです。");
  });

  it("returns an empty string for no segments", () => {
    expect(furiganaToSpeechText([])).toBe("");
  });
});

describe("subjectSpeechText", () => {
  const base = { characters: "x", readings: [], furigana: null };

  it("speaks the glyph for kana", () => {
    expect(subjectSpeechText({ ...base, type: "KANA", characters: "あ" })).toBe("あ");
  });

  it("speaks sentence furigana, falling back to the characters", () => {
    const furigana = [{ ruby: "私", rt: "わたし" }, { ruby: "です" }];
    expect(subjectSpeechText({ ...base, type: "SENTENCE", characters: "私です", furigana })).toBe("わたしです");
    expect(subjectSpeechText({ ...base, type: "SENTENCE", characters: "私です" })).toBe("私です");
  });

  it("speaks the primary cleaned reading for vocab and kanji", () => {
    const readings = [
      { reading: "ほか", primary: false },
      { reading: "た.べる", primary: true },
    ];
    expect(subjectSpeechText({ ...base, type: "KANJI", readings })).toBe("たべる");
    expect(subjectSpeechText({ ...base, type: "VOCAB", readings })).toBe("たべる");
  });

  it("falls back to the first reading when none is primary", () => {
    expect(subjectSpeechText({ ...base, type: "VOCAB", readings: [{ reading: "ねこ", primary: false }] })).toBe("ねこ");
  });

  it("returns null for radicals, grammar, and subjects without readings", () => {
    expect(subjectSpeechText({ ...base, type: "RADICAL" })).toBeNull();
    expect(subjectSpeechText({ ...base, type: "GRAMMAR" })).toBeNull();
    expect(subjectSpeechText({ ...base, type: "VOCAB" })).toBeNull();
  });
});

describe("subjectSpeechTexts", () => {
  const furigana = [{ ruby: "私", rt: "わたし" }, { ruby: "です" }];
  const samples = [
    { type: "KANA", characters: "あ", readings: [], furigana: null },
    {
      type: "KANJI",
      characters: "食",
      readings: [
        { reading: "しょく", primary: true, type: "onyomi" },
        { reading: "た.べる", primary: false, type: "kunyomi" },
        { reading: "く.う", primary: false, type: "kunyomi" },
      ],
      furigana: null,
    },
    {
      type: "VOCAB",
      characters: "日",
      readings: [
        { reading: "ひ", primary: true, type: "kana" },
        { reading: "にち", primary: false, type: "kana" },
      ],
      furigana: null,
    },
    { type: "SENTENCE", characters: "私です", readings: [], furigana },
    { type: "SENTENCE", characters: "私です", readings: [], furigana: null },
    { type: "RADICAL", characters: "一", readings: [{ reading: "ichi", primary: true, type: "romaji" }], furigana: null },
    { type: "GRAMMAR", characters: "～たい", readings: [], furigana: null },
  ];

  it("always contains subjectSpeechText", () => {
    for (const subject of samples) {
      const single = subjectSpeechText(subject);
      if (single !== null) expect(subjectSpeechTexts(subject)).toContain(single);
    }
  });

  it("lists every cleaned on'yomi and kun'yomi for a kanji", () => {
    expect(subjectSpeechTexts(samples[1])).toEqual(["しょく", "たべる", "くう"]);
  });

  it("lists every kana reading for a vocab", () => {
    expect(subjectSpeechTexts(samples[2])).toEqual(["ひ", "にち"]);
  });

  it("uses furigana for sentences, then characters", () => {
    expect(subjectSpeechTexts(samples[3])).toEqual(["わたしです"]);
    expect(subjectSpeechTexts(samples[4])).toEqual(["私です"]);
  });

  it("is empty for radicals and grammar", () => {
    expect(subjectSpeechTexts(samples[5])).toEqual([]);
    expect(subjectSpeechTexts(samples[6])).toEqual([]);
  });

  it("deduplicates", () => {
    const dup = {
      type: "VOCAB",
      characters: "x",
      readings: [
        { reading: "ひ", primary: true, type: "kana" },
        { reading: "ひ", primary: false, type: "kana" },
      ],
      furigana: null,
    };
    expect(subjectSpeechTexts(dup)).toEqual(["ひ"]);
  });
});

describe("sentenceSpeechText", () => {
  it("prefers furigana, falls back to characters, and is null when empty", () => {
    expect(sentenceSpeechText({ furigana: [{ ruby: "私", rt: "わたし" }], characters: "私" })).toBe("わたし");
    expect(sentenceSpeechText({ furigana: null, characters: "私" })).toBe("私");
    expect(sentenceSpeechText({ furigana: null, characters: null })).toBeNull();
  });
});
