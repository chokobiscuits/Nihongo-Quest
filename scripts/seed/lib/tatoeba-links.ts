// jpn-eng_links.tsv (from jpn-eng_links.tsv.bz2): a simple id-pair TSV
// linking a Japanese sentence id to an English sentence id it is a
// translation of:
//   jpn_sentence_id \t eng_sentence_id
// One Japanese sentence can link to multiple English sentences (and vice
// versa via other language pairs, though this export is jpn-eng only).
export interface TatoebaLink {
  sourceId: string;
  targetId: string;
}

export function parseTatoebaLinks(text: string): TatoebaLink[] {
  const links: TatoebaLink[] = [];

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;

    const fields = line.split("\t");
    if (fields.length < 2) continue;

    const [sourceId, targetId] = fields;
    if (!sourceId || !targetId) continue;

    links.push({ sourceId, targetId });
  }

  return links;
}
