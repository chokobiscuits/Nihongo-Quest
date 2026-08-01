import { describe, expect, it } from "vitest";
import iconv from "iconv-lite";
import { decodeEucJp } from "../euc-jp";

describe("decodeEucJp", () => {
  it("decodes an EUC-JP encoded kanji line back to the correct UTF-16 string", () => {
    const original = "漢 : 氵 隹 灬";
    const eucBytes = iconv.encode(original, "EUC-JP");
    expect(decodeEucJp(eucBytes)).toBe(original);
  });

  it("round-trips a KRADFILE-style line with ASCII colon separators", () => {
    const original = "字 : 宀 子";
    const eucBytes = iconv.encode(original, "EUC-JP");
    expect(decodeEucJp(eucBytes)).toBe(original);
  });

  it("would mangle the text if decoded as UTF-8 instead (sanity check the gotcha is real)", () => {
    const original = "漢字";
    const eucBytes = iconv.encode(original, "EUC-JP");
    const wrongly = eucBytes.toString("utf-8");
    expect(wrongly).not.toBe(original);
  });
});
