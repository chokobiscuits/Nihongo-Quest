// Streaming parser for KANJIDIC2 XML. Uses sax rather than a DOM load: the
// file is small (~13MB uncompressed) but we keep the same streaming style as
// jmdict-parser.ts for consistency and to avoid holding a second DOM tree in
// memory during transform.
//
// Gotcha (see scripts/seed/README.md): KANJIDIC2's <jlpt> element is the
// RETIRED pre-2010 4-level scale, not the modern N1-N5 scale. We surface it
// as `jlptLegacy` only; callers must overwrite `jlpt` from a modern source.
import sax from "sax";
import { cleanKunReading } from "./okurigana";

export interface KanjiRecord {
  literal: string;
  grade: number | null;
  strokeCount: number | null;
  frequency: number | null;
  jlptLegacy: number | null;
  /// English meanings only (KANJIDIC2 <meaning> with no m_lang attribute).
  meanings: string[];
  onyomi: string[];
  /// Both raw ("た.べる") and cleaned ("たべる") forms, see okurigana.ts.
  kunyomi: { raw: string; clean: string }[];
  nanori: string[];
}

export function parseKanjidic2(xml: string): KanjiRecord[] {
  const parser = sax.parser(true, { trim: false, lowercase: false });
  const results: KanjiRecord[] = [];

  let current: KanjiRecord | null = null;
  const path: string[] = [];
  let textBuffer = "";
  let currentRType: string | null = null;
  let currentMLang: string | null = null;

  parser.onopentag = (node) => {
    path.push(node.name);
    textBuffer = "";

    if (node.name === "character") {
      current = {
        literal: "",
        grade: null,
        strokeCount: null,
        frequency: null,
        jlptLegacy: null,
        meanings: [],
        onyomi: [],
        kunyomi: [],
        nanori: [],
      };
    } else if (node.name === "reading") {
      currentRType = typeof node.attributes.r_type === "string" ? node.attributes.r_type : null;
    } else if (node.name === "meaning") {
      currentMLang = typeof node.attributes.m_lang === "string" ? node.attributes.m_lang : null;
    }
  };

  parser.ontext = (t) => {
    textBuffer += t;
  };

  parser.onclosetag = (name) => {
    const text = textBuffer.trim();
    textBuffer = "";

    if (!current) {
      path.pop();
      return;
    }

    switch (name) {
      case "literal":
        // Only the direct <character><literal> counts; nested <literal> does
        // not occur in KANJIDIC2, but guard on depth just in case.
        if (path[path.length - 2] === "character") current.literal = text;
        break;
      case "grade":
        if (path[path.length - 2] === "misc") current.grade = Number(text);
        break;
      case "stroke_count":
        // Only the first stroke_count is the canonical count; KANJIDIC2 can
        // list miscounts as additional <stroke_count> siblings.
        if (path[path.length - 2] === "misc" && current.strokeCount === null) {
          current.strokeCount = Number(text);
        }
        break;
      case "freq":
        if (path[path.length - 2] === "misc") current.frequency = Number(text);
        break;
      case "jlpt":
        if (path[path.length - 2] === "misc") current.jlptLegacy = Number(text);
        break;
      case "meaning":
        // Absent m_lang means English (KANJIDIC2 convention).
        if (currentMLang === null && text.length > 0) current.meanings.push(text);
        currentMLang = null;
        break;
      case "reading":
        if (currentRType === "ja_on" && text) current.onyomi.push(text);
        if (currentRType === "ja_kun" && text) current.kunyomi.push(cleanKunReading(text));
        currentRType = null;
        break;
      case "nanori":
        if (text) current.nanori.push(text);
        break;
      case "character":
        results.push(current);
        current = null;
        break;
    }

    path.pop();
  };

  parser.write(xml).close();
  return results;
}
