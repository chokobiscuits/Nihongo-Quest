import { describe, expect, it } from "vitest";
import { parseTatoebaIndices } from "../tatoeba-indices";

describe("parseTatoebaIndices", () => {
  it("parses a bare headword with no optional parts", () => {
    const result = parseTatoebaIndices("1\t1\t猫");
    expect(result.lines).toEqual([
      { sentenceId: "1", meaningId: "1", tokens: [{ headword: "猫", isGoodExample: false }] },
    ]);
    expect(result.skippedTokens).toBe(0);
  });

  it("parses headword + reading", () => {
    const result = parseTatoebaIndices("1\t1\t彼(かれ)");
    expect(result.lines[0].tokens).toEqual([{ headword: "彼", reading: "かれ", isGoodExample: false }]);
  });

  it("parses headword + sense number", () => {
    const result = parseTatoebaIndices("1\t1\t好き[01]");
    expect(result.lines[0].tokens).toEqual([{ headword: "好き", senseIndex: 1, isGoodExample: false }]);
  });

  it("parses headword + surface form", () => {
    const result = parseTatoebaIndices("1\t1\t好き{好きな}");
    expect(result.lines[0].tokens).toEqual([{ headword: "好き", surface: "好きな", isGoodExample: false }]);
  });

  it("parses all parts together", () => {
    const result = parseTatoebaIndices("1\t1\t彼(かれ)[01]{彼の}~");
    expect(result.lines[0].tokens).toEqual([
      { headword: "彼", reading: "かれ", senseIndex: 1, surface: "彼の", isGoodExample: true },
    ]);
  });

  it("distinguishes the ~ good-example marker present vs absent", () => {
    const result = parseTatoebaIndices("1\t1\t猫~ 犬");
    expect(result.lines[0].tokens).toEqual([
      { headword: "猫", isGoodExample: true },
      { headword: "犬", isGoodExample: false },
    ]);
  });

  it("parses multiple space-separated tokens on one line", () => {
    const result = parseTatoebaIndices("1\t1\t彼(かれ)[01] 猫 好き{好きな}~");
    expect(result.lines[0].tokens).toEqual([
      { headword: "彼", reading: "かれ", senseIndex: 1, isGoodExample: false },
      { headword: "猫", isGoodExample: false },
      { headword: "好き", surface: "好きな", isGoodExample: true },
    ]);
  });

  it("counts malformed tokens as skipped instead of throwing or silently dropping", () => {
    const result = parseTatoebaIndices("1\t1\t猫 (無効 好き[xx]");
    // "(無効" has no headword before the paren group and isn't a valid
    // token shape; "好き[xx]" has a non-numeric sense index.
    expect(result.lines[0].tokens).toEqual([{ headword: "猫", isGoodExample: false }]);
    expect(result.skippedTokens).toBe(2);
  });

  it("skips blank lines and comment lines", () => {
    const text = ["", "# comment", "1\t1\t猫"].join("\n");
    const result = parseTatoebaIndices(text);
    expect(result.lines).toEqual([{ sentenceId: "1", meaningId: "1", tokens: [{ headword: "猫", isGoodExample: false }] }]);
  });

  it("skips lines with fewer than three tab-separated fields", () => {
    const result = parseTatoebaIndices("1\t1");
    expect(result.lines).toEqual([]);
  });
});
