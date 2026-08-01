import { describe, expect, it } from "vitest";
import { parseJlptSource } from "../jlpt-source";

describe("parseJlptSource", () => {
  it("extracts kanji -> modern jlpt_new level pairs, ignoring jlpt_old", () => {
    const json = JSON.stringify({
      食: { jlpt_new: 5, jlpt_old: 4, grade: 2 },
      漢: { jlpt_new: 2, jlpt_old: 1 },
    });
    expect(parseJlptSource(json)).toEqual([
      { kanji: "食", jlpt: 5 },
      { kanji: "漢", jlpt: 2 },
    ]);
  });

  it("skips entries with no jlpt_new field", () => {
    const json = JSON.stringify({ 字: { grade: 1, jlpt_old: 3 } });
    expect(parseJlptSource(json)).toEqual([]);
  });

  it("returns an empty array for malformed top-level JSON", () => {
    expect(parseJlptSource("null")).toEqual([]);
    expect(parseJlptSource("[]")).toEqual([]);
  });
});
