import { describe, expect, it } from "vitest";
import { shouldShowFurigana } from "./visibility";

describe("shouldShowFurigana", () => {
  it("shows below Master (level < 65) by default", () => {
    expect(shouldShowFurigana(64, {})).toBe(true);
    expect(shouldShowFurigana(1, {})).toBe(true);
  });

  it("hides at Master and above (level >= 65) by default", () => {
    expect(shouldShowFurigana(65, {})).toBe(false);
    expect(shouldShowFurigana(100, {})).toBe(false);
  });

  it("undefined settings field behaves like null (default behavior)", () => {
    expect(shouldShowFurigana(64, { furiganaOverride: undefined })).toBe(true);
    expect(shouldShowFurigana(65, { furiganaOverride: null })).toBe(false);
  });

  it("override true forces on even at/above Master", () => {
    expect(shouldShowFurigana(65, { furiganaOverride: true })).toBe(true);
    expect(shouldShowFurigana(100, { furiganaOverride: true })).toBe(true);
  });

  it("override false forces off even below Master", () => {
    expect(shouldShowFurigana(1, { furiganaOverride: false })).toBe(false);
    expect(shouldShowFurigana(64, { furiganaOverride: false })).toBe(false);
  });
});
