import { describe, expect, it } from "vitest";
import {
  CONTENT_POS,
  FUNCTION_POS,
  classifyVocabPos,
  isContentPos,
  isFunctionPos,
} from "../pos-classifier";

describe("isContentPos / isFunctionPos", () => {
  it("classifies noun codes as content", () => {
    expect(isContentPos("n")).toBe(true);
    expect(isContentPos("n-pref")).toBe(true);
    expect(isContentPos("n-suf")).toBe(true);
    expect(isContentPos("num")).toBe(true);
    expect(isContentPos("exp")).toBe(true);
  });

  it("classifies verb codes as content", () => {
    for (const code of ["v1", "v5k", "v5r-i", "vs", "vs-c", "vs-i", "vs-s", "vi", "vt", "vk", "vr"]) {
      expect(isContentPos(code)).toBe(true);
    }
  });

  it("classifies adjective codes as content", () => {
    for (const code of ["adj-i", "adj-ix", "adj-ku", "adj-na", "adj-f", "adj-pn", "adj-t"]) {
      expect(isContentPos(code)).toBe(true);
    }
  });

  it("classifies adverb codes as content", () => {
    expect(isContentPos("adv")).toBe(true);
    expect(isContentPos("adv-to")).toBe(true);
  });

  it("classifies bare affix codes as content", () => {
    expect(isContentPos("pref")).toBe(true);
    expect(isContentPos("suf")).toBe(true);
  });

  it("classifies particles, copula, auxiliaries, conjunctions, pronouns, counters, interjections as function", () => {
    for (const code of ["prt", "cop", "aux", "aux-v", "aux-adj", "conj", "pn", "ctr", "int"]) {
      expect(isFunctionPos(code)).toBe(true);
      expect(isContentPos(code)).toBe(false);
    }
  });

  it("does not classify a function code as content and vice versa", () => {
    for (const code of CONTENT_POS) {
      expect(isFunctionPos(code)).toBe(false);
    }
    for (const code of FUNCTION_POS) {
      expect(isContentPos(code)).toBe(false);
    }
  });

  it("returns false for unrecognized codes on both predicates", () => {
    expect(isContentPos("∫")).toBe(false);
    expect(isFunctionPos("∫")).toBe(false);
    expect(isContentPos("bogus-code")).toBe(false);
    expect(isFunctionPos("bogus-code")).toBe(false);
  });
});

describe("classifyVocabPos", () => {
  it("classifies a pure noun entry as content", () => {
    expect(classifyVocabPos(["n"])).toBe("content");
  });

  it("classifies a pure particle entry as function", () => {
    expect(classifyVocabPos(["prt"])).toBe("function");
  });

  it("classifies the copula as function", () => {
    expect(classifyVocabPos(["cop"])).toBe("function");
  });

  it("classifies a multi-function-code entry (e.g. aux-v + aux) as function", () => {
    expect(classifyVocabPos(["aux-v", "aux"])).toBe("function");
  });

  it("classifies an entry mixing a content and function code as content", () => {
    // e.g. 何か: pn + adv in the real dump — treat as content since it
    // carries independent lexical meaning beyond pure grammar.
    expect(classifyVocabPos(["pn", "adv"])).toBe("content");
  });

  it("classifies a suru-verb noun (n + vs) as content", () => {
    expect(classifyVocabPos(["n", "vs"])).toBe("content");
  });

  it("treats an entry with no pos codes as content (conservative default)", () => {
    expect(classifyVocabPos([])).toBe("content");
  });

  it("treats an entry with only unrecognized codes as content (conservative default)", () => {
    expect(classifyVocabPos(["∫"])).toBe("content");
    expect(classifyVocabPos(["bogus-code"])).toBe("content");
  });

  it("classifies a pronoun-only entry as function", () => {
    expect(classifyVocabPos(["pn"])).toBe("function");
  });

  it("classifies a counter-only entry as function", () => {
    expect(classifyVocabPos(["ctr"])).toBe("function");
  });

  it("classifies an interjection-only entry as function", () => {
    expect(classifyVocabPos(["int"])).toBe("function");
  });
});
