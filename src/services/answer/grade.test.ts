import { describe, expect, it } from "vitest";
import { gradeMeaning, gradeReading, type GradableSubject } from "./grade";

const tree: GradableSubject = {
  meanings: [{ meaning: "tree", primary: true }],
  readings: [{ reading: "き", primary: true, type: "kunyomi" }],
  acceptedMeanings: ["timber"],
};

const eat: GradableSubject = {
  meanings: [{ meaning: "eat", primary: true }],
  readings: [{ reading: "た.べる", primary: true, type: "kunyomi" }],
  acceptedMeanings: [],
};

describe("gradeMeaning", () => {
  it("accepts an exact match", () => {
    expect(gradeMeaning("Tree", tree)).toEqual({ result: "correct" });
  });

  it("accepts a user-authored synonym", () => {
    expect(gradeMeaning("timber", tree)).toEqual({ result: "correct" });
  });

  it("returns almost for a one-edit-distance typo", () => {
    expect(gradeMeaning("tre", tree)).toEqual({ result: "almost" });
    expect(gradeMeaning("trees", tree)).toEqual({ result: "almost" });
  });

  it("returns incorrect for something unrelated", () => {
    expect(gradeMeaning("mountain", tree)).toEqual({ result: "incorrect" });
  });

  it("returns wrongType when the answer matches the reading instead", () => {
    expect(gradeMeaning("ki", tree)).toEqual({ result: "wrongType" });
  });

  it("returns incorrect for an empty answer", () => {
    expect(gradeMeaning("   ", tree)).toEqual({ result: "incorrect" });
  });
});

describe("gradeMeaning with isKanaRomaji", () => {
  const shi: GradableSubject = {
    meanings: [{ meaning: "shi", primary: true }],
    readings: [],
    acceptedMeanings: [],
    isKanaRomaji: true,
  };

  it("accepts the canonical stored romaji", () => {
    expect(gradeMeaning("shi", shi)).toEqual({ result: "correct" });
  });

  it("accepts a known romanization variant not in the stored meanings", () => {
    expect(gradeMeaning("si", shi)).toEqual({ result: "correct" });
  });

  it("does NOT run typed romaji through wanakana kana conversion — a raw kana answer is not accepted", () => {
    expect(gradeMeaning("し", shi)).toEqual({ result: "incorrect" });
  });

  it("rejects an unrelated romaji answer", () => {
    expect(gradeMeaning("ka", shi)).toEqual({ result: "incorrect" });
  });

  it("accepts both n and nn for ん regardless of canonical spelling", () => {
    const n: GradableSubject = {
      meanings: [{ meaning: "n", primary: true }],
      readings: [],
      acceptedMeanings: [],
      isKanaRomaji: true,
    };
    expect(gradeMeaning("n", n)).toEqual({ result: "correct" });
    expect(gradeMeaning("nn", n)).toEqual({ result: "correct" });
  });
});

describe("gradeReading", () => {
  it("accepts romaji converted to kana", () => {
    expect(gradeReading("ki", tree)).toEqual({ result: "correct" });
  });

  it("accepts kana directly", () => {
    expect(gradeReading("き", tree)).toEqual({ result: "correct" });
  });

  it("accepts a reading without okurigana against a dotted stored reading", () => {
    expect(gradeReading("たべる", eat)).toEqual({ result: "correct" });
    expect(gradeReading("taberu", eat)).toEqual({ result: "correct" });
  });

  it("returns incorrect for an unrelated reading", () => {
    expect(gradeReading("yama", tree)).toEqual({ result: "incorrect" });
  });

  it("returns wrongType when the answer matches the meaning instead", () => {
    expect(gradeReading("tree", tree)).toEqual({ result: "wrongType" });
  });
});
