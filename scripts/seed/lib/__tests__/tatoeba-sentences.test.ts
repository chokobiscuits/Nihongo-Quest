import { describe, expect, it } from "vitest";
import { parseTatoebaSentences } from "../tatoeba-sentences";

describe("parseTatoebaSentences", () => {
  it("parses normal id/lang/text lines", () => {
    const text = ["1\tjpn\t猫が好きです。", "2\teng\tI like cats."].join("\n");
    expect(parseTatoebaSentences(text)).toEqual([
      { id: "1", lang: "jpn", text: "猫が好きです。" },
      { id: "2", lang: "eng", text: "I like cats." },
    ]);
  });

  it("preserves quote characters in the text field verbatim", () => {
    const text = `3\tjpn\t彼は"こんにちは"と言った。`;
    expect(parseTatoebaSentences(text)).toEqual([{ id: "3", lang: "jpn", text: `彼は"こんにちは"と言った。` }]);
  });

  it("rejoins on tab if the text field itself contains a literal tab", () => {
    const text = "4\tjpn\tfoo\tbar";
    expect(parseTatoebaSentences(text)).toEqual([{ id: "4", lang: "jpn", text: "foo\tbar" }]);
  });

  it("includes non-jpn language rows as-is (filtering is a later phase's concern)", () => {
    const text = "5\tcmn\t我喜欢猫。";
    expect(parseTatoebaSentences(text)).toEqual([{ id: "5", lang: "cmn", text: "我喜欢猫。" }]);
  });

  it("skips blank lines and malformed rows with too few fields", () => {
    const text = ["", "1\tjpn\tvalid", "onlyonefield", "2\tjpn"].join("\n");
    expect(parseTatoebaSentences(text)).toEqual([{ id: "1", lang: "jpn", text: "valid" }]);
  });
});
