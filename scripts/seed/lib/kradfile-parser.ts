// KRADFILE: flat kanji -> component (radical) map. One line per kanji:
//   漢 : AAA BBB CCC
// Comment lines start with '#'. The file ships EUC-JP encoded — callers must
// decode with decodeEucJp() before passing text in here; this module only
// deals with already-decoded strings so it stays trivially testable.
export interface KradfileEntry {
  kanji: string;
  components: string[];
}

export function parseKradfile(text: string): KradfileEntry[] {
  const entries: KradfileEntry[] = [];

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;

    const sepIndex = line.indexOf(":");
    if (sepIndex === -1) continue;

    const kanji = line.slice(0, sepIndex).trim();
    const components = line
      .slice(sepIndex + 1)
      .trim()
      .split(/\s+/)
      .filter(Boolean);

    if (kanji) entries.push({ kanji, components });
  }

  return entries;
}
