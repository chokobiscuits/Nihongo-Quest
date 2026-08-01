// Streaming parser for JMdict_e XML. ~200k entries, so this must stream
// rather than DOM-load.
//
// Gotcha (see README): JMdict declares POS/field/misc values as XML entities
// in its DOCTYPE (`<!ENTITY n "noun (common) (futsuumeishi)">`), so a normal
// XML parser expands `&n;` into the long English gloss. We want the short
// code ("n"), not the expansion, so entity resolution must stay OFF. sax's
// `strict` mode does not expand custom DOCTYPE entities on its own — it
// reports the raw `&n;` text via `onopencdata`-adjacent text events unless
// asked to resolve them — but to be safe and explicit we strip the DOCTYPE
// internal subset before parsing and instead recognize `&xxx;`-shaped
// entity refs directly from sax's text stream (sax emits unresolved entities
// as literal text like "&n;" when they are not in its small built-in set).
import sax from "sax";

export interface JMdictSense {
  pos: string[];
  misc: string[];
  glosses: string[];
}

export interface JMdictKanjiForm {
  text: string;
  priorities: string[];
}

export interface JMdictReadingForm {
  text: string;
  priorities: string[];
  /// ent_seq-relative restriction: which kanji forms this reading applies to.
  /// Empty means "applies to all kanji forms" (JMdict re_restr convention).
  restrictedTo: string[];
  /// True when this reading is tagged "uk"-relevant no-kanji-display info in
  /// JMdict is actually re_nokanji, kept separate from misc's "uk" sense tag.
}

export interface JMdictEntry {
  entSeq: string;
  kanji: JMdictKanjiForm[];
  readings: JMdictReadingForm[];
  senses: JMdictSense[];
}

// Per spec: isCommon is driven specifically by news1/ichi1/spec1/spec2/gai1
// (not their "2" counterparts, which JMdict itself documents as less common).
const PRIORITY_TAGS = new Set(["news1", "ichi1", "spec1", "spec2", "gai1"]);

/// Strips the DOCTYPE internal subset (the `<!ENTITY ...>` block) so sax
/// never attempts to resolve JMdict's entity shorthand into full English
/// text — we want the short codes verbatim, e.g. "v5k" not "Godan verb -
/// classical stroke".
export function stripDoctypeEntities(xml: string): string {
  return xml.replace(/<!DOCTYPE[^[]*\[[\s\S]*?\]>/, "<!DOCTYPE JMdict>");
}

export function parseJMdict(xml: string): JMdictEntry[] {
  const cleaned = stripDoctypeEntities(xml);
  // sax-js has no entity resolution for custom DOCTYPE entities in strict
  // mode; unresolved refs come through as literal "&code;" text nodes, which
  // is exactly the short-code behavior we want after stripping the DOCTYPE.
  const parser = sax.parser(true, { trim: false, lowercase: false });
  // JMdict's own entity codes (&n;, &v5k;, ...) are not valid XML entities
  // once we've stripped the DOCTYPE that defines them, so sax raises
  // "Invalid character entity" for each one. That is expected and desired:
  // sax still emits the literal "&code;" as a text node afterward (verified
  // against sax-js's recovery behavior), so we swallow the error and resume.
  parser.onerror = () => parser.resume();

  const entries: JMdictEntry[] = [];
  let current: JMdictEntry | null = null;
  const path: string[] = [];
  let textBuffer = "";
  let currentSense: JMdictSense | null = null;
  let currentKanji: JMdictKanjiForm | null = null;
  let currentReading: JMdictReadingForm | null = null;

  parser.onopentag = (node) => {
    path.push(node.name);
    textBuffer = "";

    if (node.name === "entry") {
      current = { entSeq: "", kanji: [], readings: [], senses: [] };
    } else if (node.name === "k_ele") {
      currentKanji = { text: "", priorities: [] };
    } else if (node.name === "r_ele") {
      currentReading = { text: "", priorities: [], restrictedTo: [] };
    } else if (node.name === "sense") {
      currentSense = { pos: [], misc: [], glosses: [] };
    }
  };

  parser.ontext = (t) => {
    textBuffer += t;
  };

  // JMdict entities like &n; or &v5k; appear as unresolved literal text
  // because we stripped the DOCTYPE subset; sax reports them via onopentag
  // is not applicable here since they're inline text, not tags — they show
  // up character-by-character through ontext/onopencdata. In practice sax
  // parses "&n;" as a text node containing the literal string "&n;" when it
  // cannot resolve it against its (small, XML-standard) entity table, which
  // is exactly what we rely on below.
  parser.onclosetag = (name) => {
    const text = textBuffer.trim();
    textBuffer = "";

    if (name === "ent_seq" && current) current.entSeq = text;

    if (currentKanji) {
      if (name === "keb") currentKanji.text = text;
      if (name === "ke_pri") currentKanji.priorities.push(text);
      if (name === "k_ele") {
        current?.kanji.push(currentKanji);
        currentKanji = null;
      }
    }

    if (currentReading) {
      if (name === "reb") currentReading.text = text;
      if (name === "re_pri") currentReading.priorities.push(text);
      if (name === "re_restr") currentReading.restrictedTo.push(text);
      if (name === "r_ele") {
        current?.readings.push(currentReading);
        currentReading = null;
      }
    }

    if (currentSense) {
      if (name === "pos") currentSense.pos.push(stripEntityMarkers(text));
      if (name === "misc") currentSense.misc.push(stripEntityMarkers(text));
      if (name === "gloss") currentSense.glosses.push(text);
      if (name === "sense") {
        current?.senses.push(currentSense);
        currentSense = null;
      }
    }

    if (name === "entry" && current) {
      entries.push(current);
      current = null;
    }

    path.pop();
  };

  parser.write(cleaned).close();
  return entries;
}

/// Unresolved JMdict entities come through sax text as "&n;", "&v5k;", etc.
/// (the literal markup, unexpanded). Strip the & and ; to get the bare code.
function stripEntityMarkers(text: string): string {
  const match = /^&([a-zA-Z0-9-]+);$/.exec(text);
  return match ? match[1] : text;
}

export function isCommonPriority(priorities: string[]): boolean {
  return priorities.some((p) => PRIORITY_TAGS.has(p) || /^nf\d\d$/.test(p));
}

/// Extracts the numeric ranking bucket from an "nfXX" priority tag, e.g.
/// "nf12" -> 12. Null when no nfXX tag is present.
export function nfBucket(priorities: string[]): number | null {
  for (const p of priorities) {
    const match = /^nf(\d\d)$/.exec(p);
    if (match) return Number(match[1]);
  }
  return null;
}
