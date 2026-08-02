import { describe, expect, it } from "vitest";
import { KANGXI_RADICALS } from "../kangxi-radicals";

describe("KANGXI_RADICALS", () => {
  it("has exactly 214 entries, numbered 1..214 with no gaps or duplicates", () => {
    expect(KANGXI_RADICALS).toHaveLength(214);
    const numbers = KANGXI_RADICALS.map((r) => r.number).sort((a, b) => a - b);
    expect(numbers).toEqual(Array.from({ length: 214 }, (_, i) => i + 1));
  });

  it("never has an English name equal to its own character", () => {
    for (const r of KANGXI_RADICALS) {
      expect(r.name).not.toBe(r.character);
    }
  });

  it("every character (and variant) is a real, single Unicode character, not a placeholder code", () => {
    for (const r of KANGXI_RADICALS) {
      expect([...r.character]).toHaveLength(1);
      expect(r.character).not.toMatch(/^CDP-/);
      for (const v of r.variants) {
        expect(v).not.toMatch(/^CDP-/);
      }
    }
  });

  it("has a positive stroke count and non-empty romaji for every radical", () => {
    for (const r of KANGXI_RADICALS) {
      expect(r.strokes).toBeGreaterThan(0);
      expect(r.romaji.length).toBeGreaterThan(0);
      expect(r.name.length).toBeGreaterThan(0);
    }
  });

  it("has no duplicate canonical characters", () => {
    const chars = KANGXI_RADICALS.map((r) => r.character);
    expect(new Set(chars).size).toBe(chars.length);
  });

  it("has no character reused as another radical's variant", () => {
    const canonical = new Set(KANGXI_RADICALS.map((r) => r.character));
    const allVariants = KANGXI_RADICALS.flatMap((r) => r.variants);
    expect(new Set(allVariants).size).toBe(allVariants.length);
    for (const v of allVariants) {
      expect(canonical.has(v)).toBe(false);
    }
  });
});
