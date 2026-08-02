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
