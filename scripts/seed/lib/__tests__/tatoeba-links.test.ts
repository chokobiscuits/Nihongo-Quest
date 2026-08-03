import { describe, expect, it } from "vitest";
import { parseTatoebaLinks } from "../tatoeba-links";

describe("parseTatoebaLinks", () => {
  it("parses id-pair lines", () => {
    const text = ["1297\t4724", "4702\t1276", "4703\t1277"].join("\n");
    expect(parseTatoebaLinks(text)).toEqual([
      { sourceId: "1297", targetId: "4724" },
      { sourceId: "4702", targetId: "1276" },
      { sourceId: "4703", targetId: "1277" },
    ]);
  });

  it("supports a jpn sentence linking to multiple eng sentences", () => {
    const text = ["4703\t1277", "4703\t1009343"].join("\n");
    expect(parseTatoebaLinks(text)).toEqual([
      { sourceId: "4703", targetId: "1277" },
      { sourceId: "4703", targetId: "1009343" },
    ]);
  });

  it("skips blank lines and malformed rows with too few fields", () => {
    const text = ["", "1\t2", "onlyonefield", "3\t"].join("\n");
    expect(parseTatoebaLinks(text)).toEqual([{ sourceId: "1", targetId: "2" }]);
  });
});
