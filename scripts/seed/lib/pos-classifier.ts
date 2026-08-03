// Classifies a JMdict part-of-speech (pos) code as CONTENT or FUNCTION for
// sentence-gating purposes (see scripts/seed/lib/sentence-transform.ts and
// transform.ts's sentence selection). A sentence's unlock requirement and
// level placement depend only on its content words — nouns, verbs,
// adjectives, adverbs, numerals — never on particles, the copula,
// auxiliaries, conjunctions, pronouns, counters, or interjections, which
// appear in essentially every sentence regardless of vocabulary level.
//
// Code lists are the actual JMdict/EDICT pos entity set (see
// http://www.edrdg.org/jmwsgi/edhelp.py?svc=jmdict&sid=#kw_pos), narrowed to
// exactly what scripts/seed/lib/jmdict-parser.ts observes in the current raw
// dump. Named exported constants, not inline, so the split can be retuned
// without hunting through the transform.

/// Noun family: plain nouns, prefix/suffix nominal elements, numerals
/// (num is a content quantity, not a function word), and non-adjectival
/// pronoun-like content ("adj-no" attaches an existing noun via の). "exp"
/// (multi-word expression) is treated as content: JMdict tags whole idioms
/// and set phrases this way, and they carry meaning rather than pure
/// grammatical function.
export const CONTENT_POS_NOUN = ["n", "n-pref", "n-suf", "num", "exp"] as const;

/// Verb family: the godan/ichidan/kuru/suru conjugation classes plus their
/// transitivity/subtype tags (vi, vt, vk, vr, vs, vs-c, vs-i, vs-s). Real
/// verbs, not auxiliaries (aux-v is function — see CONTENT_POS below).
export const CONTENT_POS_VERB = [
  "v1",
  "v5b",
  "v5g",
  "v5k",
  "v5k-s",
  "v5m",
  "v5r",
  "v5r-i",
  "v5s",
  "v5t",
  "v5u",
  "v5u-s",
  "vi",
  "vk",
  "vr",
  "vs",
  "vs-c",
  "vs-i",
  "vs-s",
  "vt",
] as const;

/// Adjective family: i-adjectives (including the archaic/rare -ix/-ku
/// inflections), na-adjectives, prenominal-only adjectives (adj-f, adj-pn),
/// and the taru-adjective class (adj-t). Excludes adj-no (nominal, not
/// adjectival — filed under CONTENT_POS_NOUN's "n" role via the noun it
/// modifies) since adj-no words are ordinary nouns used attributively.
export const CONTENT_POS_ADJ = ["adj-i", "adj-ix", "adj-ku", "adj-na", "adj-f", "adj-pn", "adj-t"] as const;

/// Adverb family.
export const CONTENT_POS_ADV = ["adv", "adv-to"] as const;

/// Standalone affix-only entries not already covered by the n-pref/n-suf
/// noun-affix codes above — pref/suf without the n- prefix are the same kind
/// of meaning-bearing word part (e.g. 御- honorific prefix, -的 suffix).
export const CONTENT_POS_AFFIX = ["pref", "suf"] as const;

export const CONTENT_POS: readonly string[] = [
  ...CONTENT_POS_NOUN,
  ...CONTENT_POS_VERB,
  ...CONTENT_POS_ADJ,
  ...CONTENT_POS_ADV,
  ...CONTENT_POS_AFFIX,
];

/// Function/grammatical codes: particles, copula, auxiliaries (verbal and
/// adjectival), conjunctions, pronouns, counters, interjections. These
/// appear in nearly every sentence regardless of vocabulary level, so they
/// must never gate sentence eligibility or level placement — they still
/// render (with furigana) and still get a SubjectComponent edge for
/// highlighting, just a non-gating one.
export const FUNCTION_POS = ["prt", "cop", "aux", "aux-v", "aux-adj", "conj", "pn", "ctr", "int"] as const;

/// True if `pos` (a single JMdict pos code) is a content-word code per
/// CONTENT_POS above.
export function isContentPos(pos: string): boolean {
  return (CONTENT_POS as readonly string[]).includes(pos);
}

/// True if `pos` is a recognized function-word code per FUNCTION_POS above.
export function isFunctionPos(pos: string): boolean {
  return (FUNCTION_POS as readonly string[]).includes(pos);
}

/// Classifies a vocab entry's full pos code list (JMdict senses can carry
/// several) as "content" if ANY code is a content code — a word that's e.g.
/// both a noun and a suru-verb (vs) is content either way — and "function"
/// only when every code present is a recognized function code. An entry with
/// no pos codes at all, or whose codes are entirely unrecognized (neither
/// list), is conservatively treated as content: better to over-gate on an
/// unfamiliar code than to silently let an unclassified word skip gating.
export function classifyVocabPos(posCodes: string[]): "content" | "function" {
  if (posCodes.length === 0) return "content";
  if (posCodes.some((p) => isContentPos(p))) return "content";
  if (posCodes.every((p) => isFunctionPos(p))) return "function";
  return "content";
}
