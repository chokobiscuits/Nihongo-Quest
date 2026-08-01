// KRADFILE/RADKFILE ship as EUC-JP, not UTF-8. Decode explicitly before any
// text processing — treating the raw bytes as UTF-8 silently mangles kanji.
import iconv from "iconv-lite";

export function decodeEucJp(buffer: Buffer): string {
  return iconv.decode(buffer, "EUC-JP");
}
