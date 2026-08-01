import { describe, expect, it } from "vitest";
import { parseJmdictFuriganaJson } from "../jmdict-furigana-parser";

describe("parseJmdictFuriganaJson", () => {
  it("parses a plain JSON array of rows", () => {
    const json = JSON.stringify([{ text: "食べる", reading: "たべる", furigana: [{ ruby: "食", rt: "た" }, { ruby: "べる" }] }]);
    expect(parseJmdictFuriganaJson(json)).toEqual([
      { text: "食べる", reading: "たべる", furigana: [{ ruby: "食", rt: "た" }, { ruby: "べる" }] },
    ]);
  });

  it("strips a leading UTF-8 BOM before parsing, as shipped by the release asset", () => {
    const json = "﻿" + JSON.stringify([{ text: "字", reading: "じ", furigana: [{ ruby: "字", rt: "じ" }] }]);
    expect(parseJmdictFuriganaJson(json)).toEqual([{ text: "字", reading: "じ", furigana: [{ ruby: "字", rt: "じ" }] }]);
  });
});
