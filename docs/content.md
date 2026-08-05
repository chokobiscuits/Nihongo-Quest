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
| KANJI (ladder) | ~1,980 | Part of the 60-level curriculum |
| KANJI (total seeded) | 10,384 | Of KANJIDIC2's 13,108; the rest have no English meaning |
| VOCAB (ladder) | 5,225 | Below `VOCAB_PER_LEVEL * LEVEL_COUNT` (5,400) because levels 1-3 run reduced quotas: kanji-bearing vocab does not exist yet that early. See `VOCAB_EARLY_LEVEL_QUOTAS` |
| VOCAB (total seeded) | 10,000 | Common entries only, capped at 10,000 |
| SENTENCE (ladder) | 3,600 | 60 per level via `SENTENCE_PER_LEVEL`; see the sentence sizing section in `docs/roadmap.md` |
| SENTENCE (total seeded) | 7,705 | Seeded from Tatoeba; all have good-example markers and translations |
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

## JMdict headword vs. actual spelling

JMdict's headword for an entry is not always how the word is written in practice. Two separate mechanisms in `transform.ts` demote a kanji headword to its kana form, both inside `primaryEligibleKanjiForms`:

1. **Unprioritized kanji forms.** An entry whose only kanji spellings carry no priority tags is treated as kana-primary, so の does not surface as 乃.
2. **The `uk` sense tag** ("usually written using kana alone"), when *every* sense carries it. This covers everyday words JMdict files under rare kanji: どこ (何処), いくら (幾ら), こんにちは (今日は), すみません (済みません), はじめまして (初めまして), かばん (鞄), おいしい (美味しい). Roughly 1,129 seeded entries are affected.

Both matter for more than display. `Subject.characters` feeds the slug, the lesson card, the review prompt, and the kanji dependency graph, so a wrongly-kanji headword also gates the word behind kanji a learner should never need for it. Requiring all senses to be `uk`-tagged is deliberate: a word that is kanji-written in one sense and kana-usual in another keeps its kanji.

## KRADFILE quirk

KRADFILE substitutes lookalike kanji in its character references and never lists the radical form itself (氵 water, 艹 grass, 疒 sickness). `scripts/seed/lib/kangxi-resolver.ts` handles this by carrying variant forms. Examples:

- 汁 (juice kanji) is used for 水 (water radical) in KRADFILE indices.
- 艾 (medicinal herb) is used for 艹 (grass).
- 疔 (boil) is used for 疒 (sickness).

The resolver maps these back to their canonical Kangxi forms so the unlock graph treats them correctly. See `scripts/seed/lib/kangxi-radicals.ts` for the variant mapping.

## Beginner syllabus coverage

Audited against a standard beginner checklist (writing system, numbers, greetings, core verbs, everyday vocabulary, colors, weather, directions, shopping, restaurant, transport, question words, beginner kanji): **126 of 126 checkable items are on the ladder.** Every section is complete.

Getting there took three separate fixes, described below. The starting point was 70 of 126, with core verbs at 3 of 18 and greetings at 1 of 10.

### Why the gaps exist

KANJIDIC2 and JMdict rank by **written-corpus frequency**, which systematically under-ranks the spoken words a beginner meets first. Two distinct failures come out of that:

**Seeded but unladdered.** The word exists in the database and is browsable, but lost the frequency sort before the 5,400 vocab slots filled. This was the larger problem: the ladder originally carried 3 of 18 core verbs, with 行く, 来る, 食べる, 飲む, 見る, 聞く, 話す, 読む, and 書く all seeded, all flagged common, and none of them taught. Fixed with `VOCAB_PRIORITY_SLUGS` in `scripts/seed/lib/level-heuristic.ts`, a curated must-include list that sorts ahead of frequency ordering while still respecting kanji dependencies.

A related hole sat one layer down: 分 (KANJIDIC2 frequency rank 24) was off the **kanji** ladder entirely, because JLPT-tagged kanji fill all ~1,980 slots before the non-JLPT top-up loop runs. That blocked 分 ("minute") and 分かる ("to understand") from the vocab ladder, since vocab is never placed ahead of its own kanji. Fixed with `KANJI_PRIORITY_CHARACTERS`.

**Seeded under a spelling nobody uses.** This looked at first like "not seeded at all" and was the largest group. JMdict files こんにちは under 今日は, どこ under 何処, いくら under 幾ら, すみません under 済みません, はじめまして under 初めまして. The transform took the kanji headword, so these words existed in the database under spellings a Japanese reader essentially never meets, and were gated behind kanji they should never have needed.

JMdict already marks them: the `uk` sense tag, "usually written using kana alone." The flag was parsed and stored in `Subject.metadata` but never used. `primaryEligibleKanjiForms` in `transform.ts` now treats a kana-usual entry as kana-primary, the same demotion it already applied to entries whose only kanji forms are unprioritized (の's 乃). That flipped **1,129 vocab entries** to their real written form and removed the spurious kanji dependency.

The rule requires *every* sense to carry `uk`, not just one. Entries that are kanji-written in one sense and kana-usual in another keep their kanji form; demoting those would be wrong. Verified that ordinary kanji vocabulary (水, 山, 学校, 食べる) is unaffected.

**Structurally impossible to place early.** Level 1 has zero kanji-bearing vocab available, since no kanji has been taught yet, and level 2 has only 26. Running the full 90-per-level quota there forced the ladder to fill with kana-only filler: はらいさげ ("sale of unwanted government assets") and ぐるり ("surroundings") sat at level 1 while 水 (frequency rank 1) waited until level 6. Fixed by ramping the quota instead of demanding words that do not exist. See `VOCAB_EARLY_LEVEL_QUOTAS`.

### Curated-list integrity

Priority and blocklist entries are matched by slug, and slugs are *derived* from characters and reading, not authoritative. When the `uk` demotion renamed 美味しい to おいしい, the stale priority slug matched nothing and silently stopped working, with no error and no output. `transform.ts` now fails when any curated slug matches no seeded subject. Do not remove that check: these lists are hand-edited and this failure mode is invisible without it.

### Maintaining the priority lists

Both lists are curated corrections, not general mechanisms. A priority vocab entry only works if its kanji is itself laddered, since vocab is never placed ahead of its own kanji. Two words hit this and were resolved differently, which is a useful illustration of the options:

- **鞄 ("bag")** is tagged kana-usual, so the `uk` demotion made it `vocab-かばん-かばん` with no kanji dependency at all. Nothing further was needed.
- **誰 ("who")** is not kana-tagged, so its kanji had to go on the ladder. It sits at KANJIDIC2 frequency rank 1933, well outside the band `KANJI_PRIORITY_CHARACTERS` otherwise covers, and is listed there for an explicit curriculum reason: a beginner needs "who", and without the kanji the word cannot be taught at all.

After changing either list, run `npm run seed:transform`. It fails on any slug that matches no subject, but a slug can still be well-formed, real, and stay unladdered because its kanji is not on the ladder. Confirm every entry lands with a non-null level before loading.

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
