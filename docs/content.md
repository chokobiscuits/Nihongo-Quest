# Content: sources, licenses, and counts

## Sources and licenses

Every seeded content type and its source:

| Type | Source | License | URL |
|---|---|---|---|
| Radicals (214) | Hand-encoded Kangxi standard | Public domain | `scripts/seed/lib/kangxi-radicals.ts` |
| Kanji (10,384) | KANJIDIC2 | CC BY-SA 4.0 | `http://ftp.edrdg.org/pub/Nihongo/kanjidic2.xml.gz` |
| Vocab (10,000) | JMdict_e | CC BY-SA 4.0 | `http://ftp.edrdg.org/pub/Nihongo/JMdict_e.gz` |
| Furigana | JmdictFurigana | CC BY-SA 4.0 | GitHub `Doublevil/JmdictFurigana` (release assets) |
| Kanji decomposition | KRADFILE | CC BY-SA 4.0 | `http://ftp.edrdg.org/pub/Nihongo/kradzip.zip` |
| Kanji stroke data | KanjiVG | CC BY-SA 3.0 | GitHub `KanjiVG/kanjivg` (release assets) |
| JLPT levels | davidluzgouveia/kanji-data | MIT | GitHub `davidluzgouveia/kanji-data` |
| Sentences (7,705) | Tatoeba (jpn_sentences.tsv) | CC BY 2.0 FR | `https://downloads.tatoeba.org/exports/per_language/jpn/` |
| Sentence tokens | Tatoeba (indices / Tanaka Corpus) | CC BY 2.0 FR | `https://downloads.tatoeba.org/exports/jpn_indices.tar.bz2` |
| Grammar (107 points) | Hand-authored N5/N4/N3 | Public domain | `scripts/seed/lib/grammar-points.ts` |
| Kana (208 chars) | Hand-encoded gojuon/youon | Public domain | `scripts/seed/lib/kana.ts` |

The `/about` page lists every source with its license and required attribution text, backed by the `DataSource` table populated by the seed script.

## Current content counts

Last verified 2026-08-02 from real source files:

| Type | Count | Notes |
|---|---|---|
| KANA | 208 | 46 hiragana + 46 katakana basic + dakuten/handakuten variants (20+20) + youon combinations (36+36) |
| RADICAL | 214 | Kangxi set, every radical has a real English name |
| KANJI (ladder) | ~192 | Part of the 60-level curriculum |
| KANJI (total seeded) | 10,384 | Of KANJIDIC2's 13,108; the rest have no English meaning |
| VOCAB (ladder) | ~5,400 | Part of the 60-level curriculum |
| VOCAB (total seeded) | 10,000 | Common entries only, capped at 10,000 |
| SENTENCE | 7,705 | Seeded from Tatoeba; all have good-example markers and translations |
| GRAMMAR | 107 | Hand-authored: 38 N5, 34 N4, 35 N3 |

The "ladder" counts are approximate and depend on the current level assignments in `scripts/seed/lib/level-heuristic.ts`.

## CC BY-SA boundary

**Seeded content is redistributable.** The schema keeps user-authored content separate:

**User-authored fields** (never written by seed scripts, marked in `prisma/schema.prisma`):
- `Subject.meaningMnemonic`, `readingMnemonic`: mnemonic stories.
- `Subject.meaningHint`, `readingHint`: study hints.
- `Subject.acceptedMeanings`: synonym whitelist.
- `Tutorial.body`: tutorial markdown (when edited by the user).

**Seeded fields** (written by seed scripts, safe to redistribute):
- `Subject.characters`, `meanings`, `readings`, `jlpt`, `frequency`, `metadata`, `furigana`, etc.

A future export job can SELECT every column except the USER-AUTHORED block and redistribute the seeded library under CC BY-SA without ever bundling personal notes.

## Mnemonic sourcing

`Subject.mnemonicSource` tracks provenance:

- `null`: Never generated or edited.
- `"generated"`: Created by `scripts/mnemonics/generate.ts` (LLM). Safe to regenerate with `--regenerate`.
- `"authored"`: Hand-edited by the user through the mnemonic editor. Never regenerated, even with `--regenerate`.

No open, licensed mnemonic dataset exists for Japanese (WaniKani's are proprietary, Heisig's are copyrighted, Kanji Alive explicitly excludes mnemonics). The generation script produces starting-point mnemonics; users are expected to edit weak or wrong ones. See `scripts/mnemonics/README.md`.

## KRADFILE quirk

KRADFILE substitutes lookalike kanji in its character references and never lists the radical form itself (氵 water, 艹 grass, 疒 sickness). `scripts/seed/lib/kangxi-resolver.ts` handles this by carrying variant forms. Examples:

- 汁 (juice kanji) is used for 水 (water radical) in KRADFILE indices.
- 艾 (medicinal herb) is used for 艹 (grass).
- 疔 (boil) is used for 疒 (sickness).

The resolver maps these back to their canonical Kangxi forms so the unlock graph treats them correctly. See `scripts/seed/lib/kangxi-radicals.ts` for the variant mapping.

## Grammar: incomplete coverage

107 grammar points are seeded. 13 of them have zero auto-matched examples and are marked as such in the UI. These are rare N3 patterns (e.g. っぱなし, かねない, らしい in certain contexts) that don't appear in the Tatoeba corpus. Manual examples could be added, but the corpus-driven approach keeps it deterministic and audit-able.

See `scripts/seed/lib/sentence-transform.ts` for the grammar-sentence matching logic and `GRAMMAR_POINTS` in `scripts/seed/lib/grammar-points.ts` for every point's regex patterns.

## Seeding pipeline

See `scripts/seed/README.md` for the full pipeline:
1. **Download**: Fetch sources into `data/raw/`, cache by sha256.
2. **Transform**: Parse and join into `data/processed/*.jsonl` (subjects, components, data-sources).
3. **Load**: Upsert from JSONL into Postgres via Prisma.

`load` never overwrites user-authored fields; it upserts on `slug` for subjects (matching existing rows) and skips any field that the user has already edited.

Sentences and grammar are loaded the same way (safe to re-run) but are linked *after* vocab levels are finalized, so grammar can reference the sentence pool correctly.
