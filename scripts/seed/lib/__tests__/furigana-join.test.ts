import { describe, expect, it } from "vitest";
import { buildFuriganaIndex, jmdictFormPairs, lookupFurigana } from "../furigana-join";
import type { JMdictEntry } from "../jmdict-parser";

describe("jmdictFormPairs", () => {
  it("cross-products kanji forms and unrestricted readings", () => {
    const entry: JMdictEntry = {
      entSeq: "1",
      kanji: [{ text: "食べる", priorities: [] }],
      readings: [{ text: "たべる", priorities: [], restrictedTo: [] }],
      senses: [],
    };
    expect(jmdictFormPairs(entry)).toEqual([{ text: "食べる", reading: "たべる" }]);
  });

  it("respects re_restr instead of cross-producting every kanji form", () => {
    const entry: JMdictEntry = {
      entSeq: "2",
      kanji: [
        { text: "生物", priorities: [] },
        { text: "生きもの", priorities: [] },
      ],
      readings: [
        { text: "なまもの", priorities: [], restrictedTo: ["生物"] },
        { text: "いきもの", priorities: [], restrictedTo: ["生きもの"] },
      ],
      senses: [],
    };
    expect(jmdictFormPairs(entry)).toEqual([
      { text: "生物", reading: "なまもの" },
      { text: "生きもの", reading: "いきもの" },
    ]);
  });

  it("falls back to reading-as-text for kana-only entries with no kanji forms", () => {
    const entry: JMdictEntry = {
      entSeq: "3",
      kanji: [],
      readings: [{ text: "ランキング", priorities: [], restrictedTo: [] }],
      senses: [],
    };
    expect(jmdictFormPairs(entry)).toEqual([{ text: "ランキング", reading: "ランキング" }]);
  });
});

describe("furigana index lookup", () => {
  const index = buildFuriganaIndex([
    { text: "食べる", reading: "たべる", furigana: [{ ruby: "食", rt: "た" }, { ruby: "べる" }] },
  ]);

  it("returns the per-character segments on a hit, with fallback false", () => {
    const result = lookupFurigana(index, "食べる", "たべる");
    expect(result.fallback).toBe(false);
    expect(result.furigana).toEqual([{ ruby: "食", rt: "た" }, { ruby: "べる" }]);
  });

  it("synthesizes a whole-word ruby span on a miss, with fallback true", () => {
    const result = lookupFurigana(index, "漢字", "かんじ");
    expect(result.fallback).toBe(true);
    expect(result.furigana).toEqual([{ ruby: "漢字", rt: "かんじ" }]);
  });

  it("does not attempt its own character alignment on a miss", () => {
    // The fallback is always a single whole-word segment, never a guessed
    // multi-segment breakdown.
    const result = lookupFurigana(index, "難しい", "むずかしい");
    expect(result.furigana).toHaveLength(1);
  });
});
