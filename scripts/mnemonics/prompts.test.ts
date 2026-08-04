import { describe, expect, it } from "vitest";
import {
  buildRadicalPrompt,
  parseRadicalResponse,
  buildKanjiPrompt,
  parseKanjiResponse,
  buildVocabPrompt,
  parseVocabResponse,
  buildGrammarPrompt,
  parseGrammarResponse,
  buildKanaPrompt,
  parseKanaResponse,
} from "./prompts";

describe("buildRadicalPrompt", () => {
  it("includes the name and character, and asks for original content", () => {
    const prompt = buildRadicalPrompt({ name: "water", characters: "水" });
    expect(prompt).toContain("water");
    expect(prompt).toContain("水");
    expect(prompt).toContain("original");
    expect(prompt).toContain("WaniKani");
    expect(prompt).toContain("Heisig");
    expect(prompt).toContain('{"meaningMnemonic": string}');
  });

  it("handles a null character", () => {
    const prompt = buildRadicalPrompt({ name: "made-up", characters: null });
    expect(prompt).toContain("no standalone character");
  });
});

describe("parseRadicalResponse", () => {
  it("accepts a well-shaped response", () => {
    expect(parseRadicalResponse({ meaningMnemonic: "A river of water." })).toEqual({
      meaningMnemonic: "A river of water.",
    });
  });

  it("rejects missing field, wrong type, empty string, non-object, and null", () => {
    expect(parseRadicalResponse({})).toBeNull();
    expect(parseRadicalResponse({ meaningMnemonic: 5 })).toBeNull();
    expect(parseRadicalResponse({ meaningMnemonic: "   " })).toBeNull();
    expect(parseRadicalResponse("not an object")).toBeNull();
    expect(parseRadicalResponse(null)).toBeNull();
    expect(parseRadicalResponse([1, 2, 3])).toBeNull();
  });
});

describe("buildKanjiPrompt", () => {
  const input = {
    characters: "水",
    meanings: [{ meaning: "water", primary: true }],
    readings: [
      { reading: "スイ", primary: true, type: "onyomi" },
      { reading: "みず", primary: true, type: "kunyomi" },
    ],
    components: [{ name: "water", characters: "水" }],
  };

  it("includes character, meanings, readings, and component names", () => {
    const prompt = buildKanjiPrompt(input);
    expect(prompt).toContain("水");
    expect(prompt).toContain("water");
    expect(prompt).toContain("スイ");
    expect(prompt).toContain("みず");
    expect(prompt).toContain("- water (水)");
    expect(prompt).toContain('{"meaningMnemonic": string, "readingMnemonic": string}');
  });

  it("notes when there are no recorded components", () => {
    const prompt = buildKanjiPrompt({ ...input, components: [] });
    expect(prompt).toContain("no radical components recorded");
  });

  it("falls back to kun'yomi framing when there is no on'yomi", () => {
    const prompt = buildKanjiPrompt({
      ...input,
      readings: [{ reading: "みず", primary: true, type: "kunyomi" }],
    });
    expect(prompt).toContain("On'yomi: (none)");
  });
});

describe("parseKanjiResponse", () => {
  it("accepts a well-shaped response", () => {
    expect(parseKanjiResponse({ meaningMnemonic: "m", readingMnemonic: "r" })).toEqual({
      meaningMnemonic: "m",
      readingMnemonic: "r",
    });
  });

  it("rejects missing readingMnemonic and malformed shapes", () => {
    expect(parseKanjiResponse({ meaningMnemonic: "m" })).toBeNull();
    expect(parseKanjiResponse({ meaningMnemonic: "", readingMnemonic: "r" })).toBeNull();
    expect(parseKanjiResponse(undefined)).toBeNull();
  });
});

describe("buildVocabPrompt", () => {
  const base = {
    characters: "水曜日",
    reading: "すいようび",
    meanings: [{ meaning: "Wednesday", primary: true }],
    kanjiComponents: [
      { characters: "水", meaning: "water" },
      { characters: "曜", meaning: "weekday" },
      { characters: "日", meaning: "day" },
    ],
    irregularReading: false,
  };

  it("includes word, reading, meaning, and kanji components", () => {
    const prompt = buildVocabPrompt(base);
    expect(prompt).toContain("水曜日");
    expect(prompt).toContain("すいようび");
    expect(prompt).toContain("Wednesday");
    expect(prompt).toContain("- 水: water");
    expect(prompt).toContain('"readingMnemonic": string | null');
  });

  it("asks to null out the reading mnemonic for a regular reading", () => {
    const prompt = buildVocabPrompt(base);
    expect(prompt).toContain('set\n"readingMnemonic" to null');
  });

  it("asks for a reading mnemonic when the reading is irregular", () => {
    const prompt = buildVocabPrompt({ ...base, irregularReading: true });
    expect(prompt).toContain("also write a reading");
  });

  it("notes kana-only words with no kanji components", () => {
    const prompt = buildVocabPrompt({ ...base, kanjiComponents: [] });
    expect(prompt).toContain("kana-only word");
  });
});

describe("parseVocabResponse", () => {
  it("accepts a response with a string readingMnemonic", () => {
    expect(parseVocabResponse({ meaningMnemonic: "m", readingMnemonic: "r" })).toEqual({
      meaningMnemonic: "m",
      readingMnemonic: "r",
    });
  });

  it("accepts a response with a null readingMnemonic", () => {
    expect(parseVocabResponse({ meaningMnemonic: "m", readingMnemonic: null })).toEqual({
      meaningMnemonic: "m",
      readingMnemonic: null,
    });
  });

  it("rejects an empty-string readingMnemonic and a missing meaningMnemonic", () => {
    expect(parseVocabResponse({ meaningMnemonic: "m", readingMnemonic: "" })).toBeNull();
    expect(parseVocabResponse({ readingMnemonic: null })).toBeNull();
  });
});

describe("buildGrammarPrompt", () => {
  it("includes pattern, formation, and gloss", () => {
    const prompt = buildGrammarPrompt({ pattern: "～ます", formation: "V-stem + ます", titleEn: "polite non-past" });
    expect(prompt).toContain("～ます");
    expect(prompt).toContain("V-stem + ます");
    expect(prompt).toContain("polite non-past");
    expect(prompt).toContain('{"meaningMnemonic": string}');
  });

  it("handles null formation/titleEn", () => {
    const prompt = buildGrammarPrompt({ pattern: "～ます", formation: null, titleEn: null });
    expect(prompt).toContain("Formation: (unknown)");
    expect(prompt).toContain("English gloss: (unknown)");
  });
});

describe("parseGrammarResponse", () => {
  it("accepts and rejects like the radical parser", () => {
    expect(parseGrammarResponse({ meaningMnemonic: "m" })).toEqual({ meaningMnemonic: "m" });
    expect(parseGrammarResponse({ meaningMnemonic: "" })).toBeNull();
    expect(parseGrammarResponse({})).toBeNull();
  });
});

describe("buildKanaPrompt", () => {
  it("includes character, romaji, and script", () => {
    const prompt = buildKanaPrompt({ characters: "あ", romaji: "a", script: "hiragana" });
    expect(prompt).toContain("あ");
    expect(prompt).toContain('"a"');
    expect(prompt).toContain("hiragana");
    expect(prompt).toContain('{"meaningMnemonic": string}');
  });
});

describe("parseKanaResponse", () => {
  it("accepts and rejects like the radical parser", () => {
    expect(parseKanaResponse({ meaningMnemonic: "m" })).toEqual({ meaningMnemonic: "m" });
    expect(parseKanaResponse({ meaningMnemonic: 1 })).toBeNull();
  });
});
