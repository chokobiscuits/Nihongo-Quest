// Backs the DataSource table that powers the required /about attribution
// screen. One row per upstream dataset. versionDate is the date we last
// verified/downloaded the source, not necessarily its own release date,
// since several of these (KANJIDIC2, JMdict, KRADFILE) are living documents
// without a single canonical version string in the file itself.
import type { DataSourceRecord } from "./types";

export const DATA_SOURCES: DataSourceRecord[] = [
  {
    name: "KANJIDIC2",
    url: "http://ftp.edrdg.org/pub/Nihongo/kanjidic2.xml.gz",
    license: "CC BY-SA 4.0",
    versionDate: "2026-08-01",
    attribution:
      "KANJIDIC2, property of the Electronic Dictionary Research and Development Group (https://www.edrdg.org/), used under CC BY-SA 4.0.",
  },
  {
    name: "JMdict_e",
    url: "http://ftp.edrdg.org/pub/Nihongo/JMdict_e.gz",
    license: "CC BY-SA 4.0",
    versionDate: "2026-08-01",
    attribution:
      "JMdict, property of the Electronic Dictionary Research and Development Group (https://www.edrdg.org/), used under CC BY-SA 4.0.",
  },
  {
    name: "JmdictFurigana",
    url: "https://github.com/Doublevil/JmdictFurigana/releases",
    license: "CC BY-SA 4.0",
    versionDate: "2026-08-01",
    attribution: "JmdictFurigana by Doublevil (https://github.com/Doublevil/JmdictFurigana), used under CC BY-SA 4.0.",
  },
  {
    name: "KanjiVG",
    url: "https://github.com/KanjiVG/kanjivg/releases",
    license: "CC BY-SA 3.0",
    versionDate: "2026-08-01",
    attribution: "KanjiVG by Ulrich Apel (https://kanjivg.tagaini.net/), used under CC BY-SA 3.0.",
  },
  {
    name: "KRADFILE",
    url: "http://ftp.edrdg.org/pub/Nihongo/kradzip.zip",
    license: "CC BY-SA 4.0",
    versionDate: "2026-08-01",
    attribution:
      "KRADFILE, property of the Electronic Dictionary Research and Development Group (https://www.edrdg.org/), used under CC BY-SA 4.0.",
  },
  {
    name: "Kanji Alive",
    url: "https://github.com/kanjialive/kanji-data-media",
    license: "CC BY 4.0",
    versionDate: "2026-08-01",
    attribution: "Kanji Alive data by the Kanji Alive project (https://kanjialive.com/), used under CC BY 4.0.",
  },
  {
    name: "davidluzgouveia/kanji-data",
    url: "https://github.com/davidluzgouveia/kanji-data",
    license: "MIT",
    versionDate: "2026-08-01",
    attribution: "kanji-data JLPT level mapping by David Luz Gouveia (https://github.com/davidluzgouveia/kanji-data).",
  },
  {
    name: "Tatoeba",
    url: "https://tatoeba.org/",
    license: "CC BY 2.0 FR",
    versionDate: "2026-08-02",
    attribution:
      "Example sentences from the Tatoeba Project (https://tatoeba.org/), contributed by its community and used under CC BY 2.0 FR. Individual sentences are attributed to their original authors on tatoeba.org.",
  },
];
