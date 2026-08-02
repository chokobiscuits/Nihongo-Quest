import { describe, expect, it } from "vitest";
import { buildKangxiResolver, radicalSlugName } from "../kangxi-resolver";
import { KANGXI_RADICALS } from "../kangxi-radicals";

describe("buildKangxiResolver", () => {
  const resolver = buildKangxiResolver();

  it("resolves a canonical character to itself", () => {
    const water = resolver.get("水");
    expect(water?.number).toBe(85);
    expect(water?.name).toBe("water");
  });

  it("folds known variant forms onto their canonical radical", () => {
    expect(resolver.get("氵")?.character).toBe("水");
    expect(resolver.get("氺")?.character).toBe("水");
    expect(resolver.get("忄")?.character).toBe("心");
    expect(resolver.get("亻")?.character).toBe("人");
  });

  it("has no entry for a non-radical component", () => {
    expect(resolver.has("愛")).toBe(false);
  });

  it("covers all 214 radicals plus every declared variant", () => {
    const totalVariants = KANGXI_RADICALS.reduce((sum, r) => sum + r.variants.length, 0);
    expect(resolver.size).toBe(KANGXI_RADICALS.length + totalVariants);
  });
});

describe("radicalSlugName", () => {
  it("lowercases and hyphenates the English name", () => {
    const water = KANGXI_RADICALS.find((r) => r.number === 85)!;
    expect(radicalSlugName(water)).toBe("water");
  });

  it("hyphenates multi-word names", () => {
    const legs = KANGXI_RADICALS.find((r) => r.number === 10)!;
    expect(radicalSlugName(legs)).toBe("legs");
    const shortTailedBird = KANGXI_RADICALS.find((r) => r.number === 172)!;
    expect(radicalSlugName(shortTailedBird)).toBe("short-tailed-bird");
  });
});
