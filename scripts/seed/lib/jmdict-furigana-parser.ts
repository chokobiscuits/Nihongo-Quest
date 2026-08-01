// JmdictFurigana.json is a flat JSON array of { text, reading, furigana }
// rows (no ent_seq, see furigana-join.ts for the join strategy). The release
// asset ships with a UTF-8 BOM, which JSON.parse rejects outright, so it
// must be stripped first.
import type { JmdictFuriganaRow } from "./furigana-join";

export function parseJmdictFuriganaJson(text: string): JmdictFuriganaRow[] {
  const withoutBom = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  const parsed = JSON.parse(withoutBom) as JmdictFuriganaRow[];
  return parsed;
}
