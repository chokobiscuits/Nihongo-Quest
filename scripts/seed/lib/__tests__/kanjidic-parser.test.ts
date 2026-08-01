import { describe, expect, it } from "vitest";
import { parseKanjidic2 } from "../kanjidic-parser";

const FIXTURE = `<?xml version="1.0"?>
<kanjidic2>
<character>
  <literal>食</literal>
  <misc>
    <grade>2</grade>
    <stroke_count>9</stroke_count>
    <stroke_count>8</stroke_count>
    <freq>410</freq>
    <jlpt>3</jlpt>
  </misc>
  <reading_meaning>
    <rmgroup>
      <reading r_type="ja_on">ショク</reading>
      <reading r_type="ja_kun">く.う</reading>
      <reading r_type="ja_kun">た.べる</reading>
      <reading r_type="pinyin">shi2</reading>
      <meaning>eat</meaning>
      <meaning>food</meaning>
      <meaning m_lang="fr">manger</meaning>
    </rmgroup>
    <nanori>あ</nanori>
  </reading_meaning>
</character>
</kanjidic2>`;

describe("parseKanjidic2", () => {
  const [kanji] = parseKanjidic2(FIXTURE);

  it("extracts the literal, grade, and frequency", () => {
    expect(kanji.literal).toBe("食");
    expect(kanji.grade).toBe(2);
    expect(kanji.frequency).toBe(410);
  });

  it("keeps only the first stroke_count (the canonical one)", () => {
    expect(kanji.strokeCount).toBe(9);
  });

  it("stores <jlpt> as jlptLegacy, never as jlpt (the retired-scale gotcha)", () => {
    expect(kanji.jlptLegacy).toBe(3);
    expect(kanji).not.toHaveProperty("jlpt");
  });

  it("keeps only English (no m_lang) meanings", () => {
    expect(kanji.meanings).toEqual(["eat", "food"]);
  });

  it("separates on and kun readings, ignoring other r_types like pinyin", () => {
    expect(kanji.onyomi).toEqual(["ショク"]);
    expect(kanji.kunyomi.map((k) => k.raw)).toEqual(["く.う", "た.べる"]);
  });

  it("cleans okurigana dots on kun readings", () => {
    expect(kanji.kunyomi.map((k) => k.clean)).toEqual(["くう", "たべる"]);
  });

  it("collects nanori", () => {
    expect(kanji.nanori).toEqual(["あ"]);
  });

  it("handles multiple characters in one document", () => {
    const multi = parseKanjidic2(FIXTURE.replace("</kanjidic2>", FIXTURE.match(/<character>[\s\S]*<\/character>/)![0] + "</kanjidic2>"));
    expect(multi).toHaveLength(2);
  });
});
