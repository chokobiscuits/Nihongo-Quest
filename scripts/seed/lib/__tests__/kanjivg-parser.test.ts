import { describe, expect, it } from "vitest";
import { parseKanjiVg } from "../kanjivg-parser";

// Simplified but structurally faithful KanjiVG SVG for 休 (person + tree),
// matching the real kvg: attribute vocabulary and nested <g> shape.
const FIXTURE = `<?xml version="1.0"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:kvg="http://kanjivg.tagaini.net">
<g id="kvg:StrokePaths_04f11" style="fill:none;stroke:#000000">
  <g id="kvg:04f11" kvg:element="休">
    <g id="kvg:04f11-g1" kvg:element="亻" kvg:variant="true" kvg:original="人" kvg:position="left" kvg:radical="general">
      <path id="kvg:04f11-s1" kvg:type="㇒" d="M1,2 L3,4"/>
      <path id="kvg:04f11-s2" kvg:type="㇏" d="M3,4 L5,6"/>
    </g>
    <g id="kvg:04f11-g2" kvg:element="木" kvg:position="right">
      <path id="kvg:04f11-s3" kvg:type="㇐" d="M6,2 L8,2"/>
      <path id="kvg:04f11-s4" kvg:type="㇑" d="M7,1 L7,5"/>
      <path id="kvg:04f11-s5" kvg:type="㇒" d="M7,3 L6,5"/>
      <path id="kvg:04f11-s6" kvg:type="㇏" d="M7,3 L8,5"/>
    </g>
  </g>
</g>
</svg>`;

describe("parseKanjiVg", () => {
  const result = parseKanjiVg(FIXTURE);

  it("identifies the root kanji literal", () => {
    expect(result?.literal).toBe("休");
  });

  it("counts strokes from <path kvg:type> elements", () => {
    expect(result?.strokeCount).toBe(6);
  });

  it("extracts direct child components with position and radical/original flags", () => {
    expect(result?.components).toEqual([
      { element: "亻", original: "人", position: "left", isRadical: true },
      { element: "木", original: null, position: "right", isRadical: false },
    ]);
  });

  it("returns null for a document with no kvg:element root group", () => {
    expect(parseKanjiVg("<svg></svg>")).toBeNull();
  });
});
