import { describe, expect, it } from "vitest";
import { parseKradfile } from "../kradfile-parser";

describe("parseKradfile", () => {
  it("parses kanji to component lines", () => {
    const text = ["字 : 宀 子", "漢 : 氵 隹 灬"].join("\n");
    expect(parseKradfile(text)).toEqual([
      { kanji: "字", components: ["宀", "子"] },
      { kanji: "漢", components: ["氵", "隹", "灬"] },
    ]);
  });

  it("skips comment lines and blank lines", () => {
    const text = ["# KRADFILE comment header", "", "字 : 宀 子", "   "].join("\n");
    expect(parseKradfile(text)).toEqual([{ kanji: "字", components: ["宀", "子"] }]);
  });

  it("ignores malformed lines with no colon separator", () => {
    const text = ["not a valid line", "字 : 宀 子"].join("\n");
    expect(parseKradfile(text)).toEqual([{ kanji: "字", components: ["宀", "子"] }]);
  });
});
