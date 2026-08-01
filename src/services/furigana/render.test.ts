import { describe, expect, it } from "vitest";
import { renderFurigana, wholeWordFallback } from "./render";

describe("renderFurigana", () => {
  const segments = [
    { ruby: "食", rt: "た" },
    { ruby: "べる" },
  ];

  it("returns per-segment ruby/rt pairs when shown", () => {
    const result = renderFurigana(segments, true);
    expect(result.mode).toBe("segments");
    if (result.mode !== "segments") throw new Error("unreachable");
    expect(result.segments).toEqual([
      { ruby: "食", rt: "た" },
      { ruby: "べる", rt: "" },
    ]);
  });

  it("collapses to plain text when hidden", () => {
    const result = renderFurigana(segments, false);
    expect(result).toEqual({ mode: "hidden", text: "食べる" });
  });
});

describe("wholeWordFallback", () => {
  it("builds a single whole-word ruby segment", () => {
    expect(wholeWordFallback("食べる", "たべる")).toEqual([{ ruby: "食べる", rt: "たべる" }]);
  });

  it("renders through renderFurigana like any other segment array", () => {
    const fallback = wholeWordFallback("漢字", "かんじ");
    const shown = renderFurigana(fallback, true);
    expect(shown).toEqual({ mode: "segments", segments: [{ ruby: "漢字", rt: "かんじ" }] });

    const hidden = renderFurigana(fallback, false);
    expect(hidden).toEqual({ mode: "hidden", text: "漢字" });
  });
});
