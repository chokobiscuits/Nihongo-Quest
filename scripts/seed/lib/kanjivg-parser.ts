// Parses a single KanjiVG SVG file's nested <g> tree into an ordered,
// positioned component list for one kanji.
//
// KanjiVG marks structural groups with kvg:* attributes:
//   kvg:element   the character/component this <g> represents (may repeat
//                 nested, e.g. a kanji containing itself as a sub-component)
//   kvg:original  present when kvg:element is a variant glyph form; the
//                 attribute holds the canonical/original character
//   kvg:position  left/right/top/bottom/kamae/nyo/tare, etc. (per KanjiVG's
//                 documented position codes) — absent on many groups
//   kvg:radical   "general"/"jis"/"nelson" when this element is flagged as
//                 the traditional radical of the kanji; used to set
//                 SubjectComponent.isRadical
//   kvg:phon      marks a phonetic component; not modeled separately here,
//                 folded into isRadical=false with no special treatment
//
// We only emit *direct* elements — top-level <g kvg:element> children — as
// components of the root kanji, matching the schema's flat parent/child
// SubjectComponent edge (deeper nesting is KanjiVG's internal stroke-group
// decomposition, not a second layer of taught components).
import sax from "sax";

export interface KanjiVgComponent {
  element: string;
  /// Canonical character when `element` is a variant glyph form.
  original: string | null;
  position: string | null;
  isRadical: boolean;
}

export interface KanjiVgResult {
  /// The root kanji literal, read from the outermost <g kvg:element>.
  literal: string;
  strokeCount: number;
  components: KanjiVgComponent[];
}


export function parseKanjiVg(svg: string): KanjiVgResult | null {
  const parser = sax.parser(true, { trim: false, lowercase: false, xmlns: false });

  let literal: string | null = null;
  let strokeCount = 0;
  const components: KanjiVgComponent[] = [];
  let depth = 0;
  let rootGroupDepth: number | null = null;

  parser.onopentag = (node) => {
    if (node.name === "path" && node.attributes["kvg:type"] !== undefined) {
      strokeCount += 1;
    }

    if (node.name === "g") {
      depth += 1;
      const element = attr(node.attributes, "kvg:element");

      if (rootGroupDepth === null && element) {
        // First <g kvg:element> we see is the root kanji itself.
        rootGroupDepth = depth;
        literal = element;
        return;
      }

      // Direct children of the root group become taught components.
      if (rootGroupDepth !== null && depth === rootGroupDepth + 1 && element) {
        components.push({
          element,
          original: attr(node.attributes, "kvg:original"),
          position: attr(node.attributes, "kvg:position"),
          isRadical: attr(node.attributes, "kvg:radical") !== null,
        });
      }
    }
  };

  parser.onclosetag = (name) => {
    if (name === "g") depth -= 1;
  };

  parser.write(svg).close();

  if (!literal) return null;
  return { literal, strokeCount, components };
}

function attr(attributes: Record<string, string | { value: string }>, name: string): string | null {
  const value = attributes[name];
  if (value === undefined) return null;
  return typeof value === "string" ? value : value.value;
}
