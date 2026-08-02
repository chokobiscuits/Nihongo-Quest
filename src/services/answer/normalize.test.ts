import { describe, expect, it } from "vitest";
import { normalizeMeaning, normalizeReading, stripOkuriganaDot } from "./normalize";

describe("normalizeMeaning", () => {
  it("lowercases and trims", () => {
    expect(normalizeMeaning("  A Tree  ")).toBe("a tree");
  });

  it("collapses internal whitespace", () => {
    expect(normalizeMeaning("big   tree")).toBe("big tree");
  });

  it("strips punctuation", () => {
    expect(normalizeMeaning("A Tree!")).toBe("a tree");
    expect(normalizeMeaning("well-known")).toBe("wellknown");
    expect(normalizeMeaning("one, two")).toBe("one two");
  });
});

describe("normalizeReading", () => {
  it("converts romaji to hiragana", () => {
    expect(normalizeReading("tabeta")).toBe("たべた");
  });

  it("leaves existing kana unchanged", () => {
    expect(normalizeReading("たべた")).toBe("たべた");
  });

  it("strips whitespace", () => {
    expect(normalizeReading(" ki ")).toBe("き");
  });
});

describe("stripOkuriganaDot", () => {
  it("removes the okurigana separator", () => {
    expect(stripOkuriganaDot("た.べる")).toBe("たべる");
  });

  it("passes through readings with no dot", () => {
    expect(stripOkuriganaDot("たべる")).toBe("たべる");
  });
});
