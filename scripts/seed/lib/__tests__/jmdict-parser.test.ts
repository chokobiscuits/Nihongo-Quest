import { describe, expect, it } from "vitest";
import { isCommonPriority, nfBucket, parseJMdict, stripDoctypeEntities } from "../jmdict-parser";

const FIXTURE = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE JMdict [
<!ENTITY n "noun (common) (futsuumeishi)">
<!ENTITY v5k "Godan verb with 'ku' ending">
<!ENTITY uk "word usually written using kana alone">
]>
<JMdict>
<entry>
<ent_seq>1358280</ent_seq>
<k_ele><keb>食べる</keb><ke_pri>ichi1</ke_pri></k_ele>
<r_ele><reb>たべる</reb><re_pri>ichi1</re_pri></r_ele>
<sense><pos>&v5k;</pos><gloss>to eat</gloss></sense>
</entry>
<entry>
<ent_seq>1234567</ent_seq>
<k_ele><keb>生物</keb></k_ele>
<k_ele><keb>生きもの</keb></k_ele>
<r_ele><reb>なまもの</reb><re_restr>生物</re_restr></r_ele>
<r_ele><reb>いきもの</reb><re_restr>生きもの</re_restr></r_ele>
<sense><pos>&n;</pos><misc>&uk;</misc><gloss>living creature</gloss><gloss>raw food</gloss></sense>
</entry>
<entry>
<ent_seq>9999999</ent_seq>
<r_ele><reb>ランキング</reb><re_pri>nf12</re_pri></r_ele>
<sense><pos>&n;</pos><gloss>ranking</gloss></sense>
</entry>
</JMdict>`;

describe("stripDoctypeEntities", () => {
  it("removes the internal DTD subset but leaves the rest of the document intact", () => {
    const stripped = stripDoctypeEntities(FIXTURE);
    expect(stripped).not.toContain("<!ENTITY");
    expect(stripped).toContain("<JMdict>");
    expect(stripped).toContain("食べる");
  });
});

describe("parseJMdict", () => {
  const entries = parseJMdict(FIXTURE);

  it("parses all entries", () => {
    expect(entries).toHaveLength(3);
  });

  it("keeps POS as the short entity code, not the expanded English gloss", () => {
    expect(entries[0].senses[0].pos).toEqual(["v5k"]);
  });

  it("keeps misc as the short code too", () => {
    expect(entries[1].senses[0].misc).toEqual(["uk"]);
  });

  it("parses ent_seq, kanji forms, and reading forms", () => {
    expect(entries[0].entSeq).toBe("1358280");
    expect(entries[0].kanji).toEqual([{ text: "食べる", priorities: ["ichi1"] }]);
    expect(entries[0].readings).toEqual([{ text: "たべる", priorities: ["ichi1"], restrictedTo: [] }]);
  });

  it("parses re_restr onto the reading it belongs to", () => {
    const [r1, r2] = entries[1].readings;
    expect(r1).toEqual({ text: "なまもの", priorities: [], restrictedTo: ["生物"] });
    expect(r2).toEqual({ text: "いきもの", priorities: [], restrictedTo: ["生きもの"] });
  });

  it("parses multiple glosses per sense", () => {
    expect(entries[1].senses[0].glosses).toEqual(["living creature", "raw food"]);
  });

  it("handles kana-only entries with no k_ele", () => {
    expect(entries[2].kanji).toEqual([]);
    expect(entries[2].readings[0].text).toBe("ランキング");
  });
});

describe("isCommonPriority", () => {
  it("flags news1/ichi1/spec1/spec2/gai1 as common", () => {
    expect(isCommonPriority(["news1"])).toBe(true);
    expect(isCommonPriority(["ichi1"])).toBe(true);
    expect(isCommonPriority(["spec2"])).toBe(true);
    expect(isCommonPriority(["gai1"])).toBe(true);
  });

  it("also treats any nfXX bucket as common", () => {
    expect(isCommonPriority(["nf12"])).toBe(true);
  });

  it("returns false for tags outside the common set, e.g. ichi2/news2/gai2", () => {
    expect(isCommonPriority(["ichi2"])).toBe(false);
    expect(isCommonPriority([])).toBe(false);
  });
});

describe("nfBucket", () => {
  it("extracts the numeric ranking from an nfXX tag", () => {
    expect(nfBucket(["ichi1", "nf12"])).toBe(12);
  });

  it("returns null when no nfXX tag is present", () => {
    expect(nfBucket(["ichi1"])).toBeNull();
  });
});
