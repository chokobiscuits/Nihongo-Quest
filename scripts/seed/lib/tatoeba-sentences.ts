// jpn_sentences.tsv (from jpn_sentences.tsv.bz2): one line per sentence,
//   id \t lang \t text
// Tab-separated, but `text` can itself contain quote characters (and in
// principle any non-tab character) — this must NOT go through a CSV reader
// that treats quotes specially. Split on tab only.
export interface TatoebaSentence {
  id: string;
  lang: string;
  text: string;
}

export function parseTatoebaSentences(text: string): TatoebaSentence[] {
  const sentences: TatoebaSentence[] = [];

  for (const rawLine of text.split(/\r?\n/)) {
    if (!rawLine) continue;

    const fields = rawLine.split("\t");
    if (fields.length < 3) continue;

    const [id, lang, ...rest] = fields;
    if (!id || !lang) continue;

    // A sentence's text is everything after the second tab — if the text
    // itself somehow contained a literal tab, rejoining with "\t" preserves
    // it verbatim rather than truncating at the first extra field.
    sentences.push({ id, lang, text: rest.join("\t") });
  }

  return sentences;
}
