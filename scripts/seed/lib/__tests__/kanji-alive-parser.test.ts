import { describe, expect, it } from "vitest";
import { parseKanjiAliveRadicals } from "../kanji-alive-parser";

const FIXTURE = [
  "Radical ID#,Stroke#,Radical,Meaning,Reading-J,Reading-R,R-Filename,Anim-Filename,Position-J,Position-R",
  '1,1,⼀,"one, horizontal stroke",いち,ichi,,,,',
  "5,1,,diagonal sweeping stroke,のかんむり,nokanmuri,,,かんむり,kanmuri",
  "9,2,⼆,two,に,ni,,,,",
].join("\n");

describe("parseKanjiAliveRadicals", () => {
  const rows = parseKanjiAliveRadicals(FIXTURE);

  it("parses the character, meaning, and romaji reading", () => {
    expect(rows[0]).toEqual({ radical: "⼀", meaning: "one, horizontal stroke", readingRomaji: "ichi" });
  });

  it("handles a quoted meaning field containing a comma", () => {
    expect(rows[0].meaning).toBe("one, horizontal stroke");
  });

  it("skips rows with no standalone radical glyph", () => {
    expect(rows.map((r) => r.radical)).not.toContain("");
    expect(rows).toHaveLength(2);
  });
});
