// jpn_indices (from jpn_indices.tar.bz2, single entry inside the tarball):
// Tanaka Corpus-format word index, one line per sentence:
//   sentence_id \t meaning_id \t token token token ...
// Tokens are space-separated. Each token is a headword with optional parts:
//   彼(かれ)[01]{彼の}~
//   - headword            always present; joins to JMdict by kanji or kana
//   - (reading)           optional disambiguating reading
//   - [NN]                optional JMdict sense number
//   - {surface}            optional inflected surface form as it appears
//   - trailing ~           optional "good example sentence" marker
// All parts after the headword are optional and can appear in any
// combination. This is the fiddly one: malformed tokens are skipped rather
// than throwing, but the skip count is returned so callers can see how much
// of the corpus didn't parse instead of it being silently swallowed.
export interface TatoebaIndexToken {
  headword: string;
  reading?: string;
  senseIndex?: number;
  surface?: string;
  isGoodExample: boolean;
}

export interface TatoebaIndexLine {
  sentenceId: string;
  meaningId: string;
  tokens: TatoebaIndexToken[];
}

export interface TatoebaIndexParseResult {
  lines: TatoebaIndexLine[];
  skippedTokens: number;
}

// headword, then any interleaving of (reading) / [NN] / {surface}, then an
// optional trailing ~. Every group after the headword is optional.
const TOKEN_RE = /^(?<headword>[^\s(){}[\]~]+)(?<rest>(?:\([^)]*\)|\[[^\]]*\]|\{[^}]*\})*)(?<marker>~?)$/;
const READING_RE = /\(([^)]*)\)/;
const SENSE_RE = /\[([^\]]*)\]/;
const SURFACE_RE = /\{([^}]*)\}/;

function parseToken(raw: string): TatoebaIndexToken | null {
  const match = TOKEN_RE.exec(raw);
  if (!match?.groups) return null;

  const { headword, rest, marker } = match.groups;
  if (!headword) return null;

  const reading = READING_RE.exec(rest)?.[1];
  const senseRaw = SENSE_RE.exec(rest)?.[1];
  const surface = SURFACE_RE.exec(rest)?.[1];

  let senseIndex: number | undefined;
  if (senseRaw !== undefined) {
    const parsed = Number.parseInt(senseRaw, 10);
    if (Number.isNaN(parsed)) return null;
    senseIndex = parsed;
  }

  return {
    headword,
    ...(reading !== undefined && reading !== "" ? { reading } : {}),
    ...(senseIndex !== undefined ? { senseIndex } : {}),
    ...(surface !== undefined && surface !== "" ? { surface } : {}),
    isGoodExample: marker === "~",
  };
}

export function parseTatoebaIndices(text: string): TatoebaIndexParseResult {
  const lines: TatoebaIndexLine[] = [];
  let skippedTokens = 0;

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;

    const fields = line.split("\t");
    if (fields.length < 3) continue;

    const [sentenceId, meaningId, tokenField] = fields;
    if (!sentenceId || !meaningId) continue;

    const tokens: TatoebaIndexToken[] = [];
    for (const rawToken of tokenField.split(/\s+/)) {
      if (!rawToken) continue;
      const token = parseToken(rawToken);
      if (token) {
        tokens.push(token);
      } else {
        skippedTokens += 1;
      }
    }

    lines.push({ sentenceId, meaningId, tokens });
  }

  return { lines, skippedTokens };
}
