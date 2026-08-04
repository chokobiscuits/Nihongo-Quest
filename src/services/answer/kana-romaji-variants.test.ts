import { describe, expect, it } from "vitest";
import { acceptedKanaRomaji, KANA_ROMAJI_VARIANTS } from "./kana-romaji-variants";

describe("KANA_ROMAJI_VARIANTS", () => {
  it("covers every documented variant pair", () => {
    expect(KANA_ROMAJI_VARIANTS.shi).toContain("si");
    expect(KANA_ROMAJI_VARIANTS.chi).toContain("ti");
    expect(KANA_ROMAJI_VARIANTS.tsu).toContain("tu");
    expect(KANA_ROMAJI_VARIANTS.fu).toContain("hu");
    expect(KANA_ROMAJI_VARIANTS.ji).toContain("zi");
  });
});

describe("acceptedKanaRomaji", () => {
  it("always includes the canonical spelling itself", () => {
    expect(acceptedKanaRomaji("ka")).toEqual(["ka"]);
  });

  it("expands shi/si", () => {
    expect(acceptedKanaRomaji("shi")).toEqual(expect.arrayContaining(["shi", "si"]));
  });

  it("expands chi/ti", () => {
    expect(acceptedKanaRomaji("chi")).toEqual(expect.arrayContaining(["chi", "ti"]));
  });

  it("expands tsu/tu", () => {
    expect(acceptedKanaRomaji("tsu")).toEqual(expect.arrayContaining(["tsu", "tu"]));
  });

  it("expands fu/hu", () => {
    expect(acceptedKanaRomaji("fu")).toEqual(expect.arrayContaining(["fu", "hu"]));
  });

  it("expands ji/zi", () => {
    expect(acceptedKanaRomaji("ji")).toEqual(expect.arrayContaining(["ji", "zi"]));
  });

  it("accepts both n and nn for ん regardless of the canonical spelling", () => {
    expect(acceptedKanaRomaji("n")).toEqual(expect.arrayContaining(["n", "nn"]));
  });

  it("does not add unrelated variants for a plain kana", () => {
    expect(acceptedKanaRomaji("ka")).not.toContain("ca");
  });

  it("expands youon variants (sha/sya, cha/tya, ja/zya)", () => {
    expect(acceptedKanaRomaji("sha")).toEqual(expect.arrayContaining(["sha", "sya"]));
    expect(acceptedKanaRomaji("cha")).toEqual(expect.arrayContaining(["cha", "tya"]));
    expect(acceptedKanaRomaji("ja")).toEqual(expect.arrayContaining(["ja", "zya"]));
  });
});
