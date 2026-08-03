import { describe, expect, it } from "vitest";
import { locateTokens, spliceSentenceFurigana } from "../sentence-transform";

describe("locateTokens", () => {
  it("locates tokens left-to-right by surface form when present", () => {
    const characters = "彼は二十歳になりました。";
    const tokens = [
      { headword: "彼", surface: "彼" },
      { headword: "は" },
      { headword: "二十歳", surface: "二十歳" },
      { headword: "になる", surface: "になりました" },
    ];
    const located = locateTokens(characters, tokens);
    expect(located).toEqual([
      { text: "彼", start: 0, end: 1 },
      { text: "は", start: 1, end: 2 },
      { text: "二十歳", start: 2, end: 5 },
      { text: "になりました", start: 5, end: 11 },
    ]);
  });

  it("falls back to headword when surface is absent", () => {
    const characters = "猫が好きです。";
    const tokens = [{ headword: "猫" }, { headword: "が" }];
    const located = locateTokens(characters, tokens);
    expect(located).toEqual([
      { text: "猫", start: 0, end: 1 },
      { text: "が", start: 1, end: 2 },
    ]);
  });

  it("consumes matched text so a repeated substring resolves to distinct occurrences", () => {
    const characters = "猫と猫";
    const tokens = [{ headword: "猫" }, { headword: "と" }, { headword: "猫" }];
    const located = locateTokens(characters, tokens);
    expect(located).toEqual([
      { text: "猫", start: 0, end: 1 },
      { text: "と", start: 1, end: 2 },
      { text: "猫", start: 2, end: 3 },
    ]);
  });

  it("returns null for a token whose surface text cannot be found from the cursor onward", () => {
    const characters = "猫が好きです。";
    const tokens = [{ headword: "犬" }, { headword: "が" }];
    const located = locateTokens(characters, tokens);
    expect(located[0]).toBeNull();
    // "が" is still found even though the first token failed — cursor was
    // never advanced by the miss.
    expect(located[1]).toEqual({ text: "が", start: 1, end: 2 });
  });

  it("returns null for a token with an empty headword and no surface", () => {
    const located = locateTokens("abc", [{ headword: "" }]);
    expect(located).toEqual([null]);
  });
});

describe("spliceSentenceFurigana", () => {
  it("splices resolved token furigana at their offsets with no gaps", () => {
    const characters = "猫が好き";
    const result = spliceSentenceFurigana(characters, [
      { start: 0, end: 1, furigana: [{ ruby: "猫", rt: "ねこ" }] },
      { start: 2, end: 4, furigana: [{ ruby: "好", rt: "す" }, { ruby: "き" }] },
    ]);
    expect(result).toEqual([
      { ruby: "猫", rt: "ねこ" },
      { ruby: "が" },
      { ruby: "好", rt: "す" },
      { ruby: "き" },
    ]);
  });

  it("fills a trailing gap after the last resolved token", () => {
    const characters = "猫が好きです。";
    const result = spliceSentenceFurigana(characters, [
      { start: 0, end: 1, furigana: [{ ruby: "猫", rt: "ねこ" }] },
    ]);
    expect(result).toEqual([{ ruby: "猫", rt: "ねこ" }, { ruby: "が好きです。" }]);
  });

  it("returns one plain segment for the whole sentence when nothing resolved", () => {
    const result = spliceSentenceFurigana("何もない", []);
    expect(result).toEqual([{ ruby: "何もない" }]);
  });

  it("handles a token starting at offset 0 with no leading gap", () => {
    const result = spliceSentenceFurigana("猫", [{ start: 0, end: 1, furigana: [{ ruby: "猫", rt: "ねこ" }] }]);
    expect(result).toEqual([{ ruby: "猫", rt: "ねこ" }]);
  });

  it("falls back to one plain segment spanning the full surface when the vocab's dictionary-form furigana is shorter than an inflected surface", () => {
    // "見られない" (5 chars) resolves to 見る, whose own furigana only covers
    // its own 2-character dictionary form (見/る) — splicing that directly
    // would drop られない from the rendered sentence.
    const characters = "私は見られない。";
    const result = spliceSentenceFurigana(characters, [
      { start: 0, end: 1, furigana: [{ ruby: "私", rt: "わたし" }] },
      { start: 2, end: 7, furigana: [{ ruby: "見", rt: "み" }, { ruby: "る" }] },
    ]);
    expect(result).toEqual([
      { ruby: "私", rt: "わたし" },
      { ruby: "は" },
      { ruby: "見られない" },
      { ruby: "。" },
    ]);
  });

  it("uses the vocab furigana verbatim when it reconstructs exactly to the token's surface", () => {
    const characters = "見る";
    const result = spliceSentenceFurigana(characters, [
      { start: 0, end: 2, furigana: [{ ruby: "見", rt: "み" }, { ruby: "る" }] },
    ]);
    expect(result).toEqual([{ ruby: "見", rt: "み" }, { ruby: "る" }]);
  });
});
