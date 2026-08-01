# Content seeding pipeline

Seeds `Subject`, `SubjectComponent`, and `DataSource` (see
`prisma/schema.prisma`) from public dictionary/decomposition sources. Runs in
three phases so the transform phase (the part that actually needs testing and
retuning) can be developed and verified without a live database.

```
npm run seed:download    # network + filesystem only, writes data/raw/
npm run seed:transform   # pure, writes data/processed/*.jsonl
npm run seed:load        # thin Prisma upserts from data/processed/ into Postgres
```

`data/` is gitignored. Both `data/raw/` and `data/processed/` are fully
regenerable from source; nothing under `data/` should ever be hand-edited or
committed.

## Phases

**download.ts** fetches every source into `data/raw/`. Caches by sha256 in
`data/raw/.checksums.json` — a file already present with a recorded checksum
is not re-downloaded, so re-running after an interruption doesn't re-pull the
~13MB+ of gzip/zip. JmdictFurigana and KanjiVG ship as versioned GitHub
release assets, so those two are resolved via the GitHub Releases API rather
than a fixed URL.

**transform.ts** reads `data/raw/`, calls the pure parsers in `lib/`, joins
them, assigns curriculum levels, and writes:

- `data/processed/subjects.jsonl` — one `SubjectRecord` per row (see
  `lib/types.ts`). Uses a `tempId` (not a real Subject id) to link vocab to
  the kanji/radicals it depends on, since no database exists yet.
- `data/processed/components.jsonl` — `SubjectComponent` edges, keyed by the
  same `tempId`s.
- `data/processed/data-sources.jsonl` — the `DataSource` attribution rows.

Every parsing/joining decision is pushed into `lib/*.ts`, each with its own
unit tests under `lib/__tests__/`. `transform.ts` itself is orchestration
only: read raw files, call the pure functions, write JSONL.

**load.ts** reads the JSONL artifacts and upserts into Postgres via the same
Prisma client the app uses (`src/lib/db.ts`), so it needs `DATABASE_URL` set.
Subjects upsert on `slug` (unique in the schema); `SubjectComponent` upserts
on its compound `(parentId, childId)` key after resolving `tempId`s to real
ids via a `slug` lookup. `DataSource` has no natural unique key, so the load
replaces the whole seeded set in a transaction (safe: nothing else
foreign-keys into it). Batched at 500 rows per transaction. Safe to re-run —
running it twice produces the same rows, not duplicates.

## Sources and licenses

| Source | URL | License | Used for |
|---|---|---|---|
| KANJIDIC2 | `http://ftp.edrdg.org/pub/Nihongo/kanjidic2.xml.gz` | CC BY-SA 4.0 | Kanji meanings, on/kun readings, grade, stroke count, freq |
| JMdict_e | `http://ftp.edrdg.org/pub/Nihongo/JMdict_e.gz` | CC BY-SA 4.0 | Vocabulary |
| JmdictFurigana | GitHub release, `Doublevil/JmdictFurigana` | CC BY-SA 4.0 | Per-character furigana alignment |
| KanjiVG | GitHub release, `KanjiVG/kanjivg` (`*-main.zip`) | CC BY-SA 3.0 | Component decomposition with position |
| KRADFILE | `http://ftp.edrdg.org/pub/Nihongo/kradzip.zip` | CC BY-SA 4.0 | Flat kanji→component map, used as a coverage cross-check against KanjiVG |
| Kanji Alive | `kanjialive/kanji-data-media`, `language-data/japanese-radicals.csv` | CC BY 4.0 | 247 radicals with English meanings/romaji readings |
| davidluzgouveia/kanji-data | GitHub, `kanji.json` | MIT | Modern N5-N1 JLPT levels (`jlpt_new` field) |

Every source above gets a `DataSource` row via `lib/data-sources.ts`, which
powers the required `/about` attribution screen. `versionDate` records when
the pipeline last verified/downloaded the source, since several of these are
living documents without a single canonical release version in the file
itself.

Note on Kanji Alive: the repo has no dedicated radical-data JSON despite its
`data/` folder naming; the actual English-meaning table lives at
`language-data/japanese-radicals.csv`. `lib/kanji-alive-parser.ts` parses
that CSV directly (hand-rolled quote-aware split — the file has no embedded
newlines and only the `Meaning` column ever needs quoting).

## Parsing gotchas (verified against real source files, not just docs)

1. **KANJIDIC2's `<jlpt>` is the retired pre-2010 4-level scale, not N1-N5.**
   `lib/kanjidic-parser.ts` stores it as `jlptLegacy` only. `jlpt` is
   populated exclusively from `davidluzgouveia/kanji-data`'s `jlpt_new`
   field, never from KANJIDIC2.
2. **KRADFILE is EUC-JP encoded.** `lib/euc-jp.ts` decodes explicitly via
   `iconv-lite`; the ZIP entry's raw bytes must never be treated as UTF-8.
3. **JMdict uses XML entities for POS/misc values** (`&n;`, `&v5k;`,
   `&adj-i;`). `lib/jmdict-parser.ts` strips the DOCTYPE's internal `<!ENTITY
   ...>` subset before parsing, so `sax` cannot resolve them; it errors on
   each unresolved entity (`onerror` swallows it and calls `parser.resume()`)
   and emits the literal `&code;` text instead, which we strip down to the
   bare short code. Verified against a live parse of the ~218k-entry
   JMdict_e file.
4. **Streaming XML parsing throughout** — `sax` for both KANJIDIC2 and
   JMdict, never a DOM load. Confirmed parse time on the real files: ~500ms
   for KANJIDIC2 (13,108 characters), ~5.4s for JMdict_e (218,244 entries).
5. **KANJIDIC2 kun readings carry okurigana markers** (`た.べる`).
   `lib/okurigana.ts` keeps both the raw form (display) and the dot-stripped
   clean form (matching).
6. **JmdictFurigana has no ent_seq.** `lib/furigana-join.ts` joins on the
   `(text, reading)` pair. The JMdict side is built as kanji forms × reading
   forms, restricted by `re_restr` where present (`jmdictFormPairs`) — not a
   blind cross product.
7. **JmdictFurigana misses ~0.4% of the seeded (common, in-vocabulary-set)
   entries** in this run (see Results below) — far better than the ~24%
   headline miss rate for JMdict as a whole, because the vocab scope filter
   already restricts to common words, which JmdictFurigana covers well. Every
   miss gets `furiganaFallback = true` and a single whole-word ruby span
   (`lookupFurigana`) — the pipeline never attempts its own character-level
   alignment.
8. **JmdictFurigana's release asset ships with a UTF-8 BOM** that breaks a
   naive `JSON.parse`; `lib/jmdict-furigana-parser.ts` strips it first.
9. **KanjiVG's per-kanji SVG root is the first `<g kvg:element>`** inside an
   outer, attribute-less `<g id="kvg:StrokePaths_...">` wrapper; only its
   *direct* child `<g>` elements become taught `SubjectComponent` rows (per
   the schema's flat parent/child edge) — deeper nesting is KanjiVG's
   internal stroke-group decomposition, not a second layer of components.
   Filenames are the kanji's Unicode codepoint in lowercase hex, zero-padded
   to 5 digits (`04f11.svg` = U+4F11 = 休).

## Mapping to schema

- **Radicals** (`Subject.type = RADICAL`): every distinct component
  character KanjiVG uses as a *direct child* of some kanji. Left-joined
  against Kanji Alive's CSV on the literal character for an English meaning
  and romaji reading; radicals with no Kanji Alive match fall back to the
  bare character as a placeholder meaning (still `authored: false`,
  `meaningMnemonic: null` — the user authors real mnemonics by hand later,
  per the schema's authored/seeded split).
- **Kanji** (`KANJI`): from KANJIDIC2, English-only meanings (`m_lang`
  absent). `jlpt` from kanji-data, `jlptLegacy` from KANJIDIC2's own
  `<jlpt>`. Kanji with zero English meanings are skipped (nothing to seed a
  meaning-quiz subject with).
- **Vocab** (`VOCAB`): from JMdict_e, filtered to common entries (see Scope
  below). `metadata.entSeq` retains the JMdict entry id. `metadata.isCommon`
  and `metadata.nfRank` come from `ke_pri`/`re_pri` (`news1|ichi1|spec1|
  spec2|gai1` for the boolean flag, the `nfXX` bucket as an int for ranking).
  `metadata.uk` flags any sense whose `misc` contains `uk`.
- **`SubjectComponent`**: KanjiVG's nested `<g>` tree for radical→kanji
  edges (`position`, `isRadical` from `kvg:position`/`kvg:radical`).
  Vocab→kanji edges are derived from the furigana segment array, not a naive
  character scan — `readingUsed` is set to the segment's own reading, so 生
  is taught as せい in 学生 and なま in 生物 as genuinely distinct facts.
- **`furigana`** on VOCAB subjects is the JmdictFurigana segment array
  verbatim, ready for `<ruby>` rendering via `src/services/furigana/render.ts`.
- **`DataSource`**: one row per table above, see `lib/data-sources.ts`.
- All USER-AUTHORED fields (`meaningMnemonic`, `readingMnemonic`,
  `meaningHint`, `readingHint`, `acceptedMeanings`) are left at their schema
  defaults (`null`/`[]`) and `authored` stays `false` for every seeded row.

## Level heuristic (`lib/level-heuristic.ts`)

Curriculum `level` (1–60) is a design decision, not sourced data, and lives
as a single pure, retunable function. Not every seeded subject is on the
ladder — `level` is nullable, and most kanji/vocab stay `null` (seeded,
searchable, linkable, but outside the 60-level curriculum):

1. **Selection** (`selectLadderSet`): picks ~2,000 kanji for the ladder,
   preferring JLPT-banded kanji (N5 first, then frequency within a band),
   topping up with non-JLPT kanji only when their frequency rank beats
   `NON_JLPT_FREQUENCY_CEILING`. Pulls in every radical any selected kanji
   transitively depends on. Picks vocab (up to `VOCAB_LADDER_TARGET`) whose
   kanji dependencies are all already selected, common vocab first.
2. **Topological sort** on the dependency graph restricted to the selected
   set (Kahn's algorithm): radicals before the kanji that use them, kanji
   before the vocab that uses them. Ties within a wave break by JLPT band,
   then frequency, then grade, then `tempId`.
3. **Quota-fill placement** (`assignLevels`): walks the ordered list and
   places each item at the earliest level that is at or after all of its
   dependencies' levels and still has quota room for its type
   (`KANJI_PER_LEVEL`, `VOCAB_PER_LEVEL`, tapering `RADICAL_QUOTA_*`).
   Dependency order constrains placement; quotas decide it.

To retune: adjust the exported `*_QUOTA` / `*_TARGET` / `*_CEILING`
constants at the top of the file. All pure, all covered by
`lib/__tests__/level-heuristic.test.ts`.

## Vocab scope control

Per the task, vocab is filtered — not the full ~218k JMdict_e entries — to
entries that are **common** (`news1|ichi1|spec1|spec2|gai1` on any kanji or
reading form, or any `nfXX` bucket) **and** whose every kanji form consists
entirely of characters in the seeded kanji set. If the filtered candidate set
exceeds the 10,000 target ceiling, it's trimmed by ascending `nfXX` rank
(most frequent first); entries without an `nfXX` bucket sort last within the
cap but are never preferentially dropped over less-common `nfXX`-ranked ones.

## Results (last verified transform run, real source files, 2026-08-01)

- **Radicals**: 1,418 (KanjiVG's full direct-child component inventory, not
  a curated ~250-item traditional radical list — the schema's mapping spec
  explicitly asks for KanjiVG's component inventory, with `isRadical`
  distinguishing traditionally-recognized radicals from other components)
- **Kanji**: 10,384 (of KANJIDIC2's 13,108 total characters; the rest have no
  English `<meaning>` entry and are skipped)
- **Vocab**: 10,000 (candidate pool before the cap: 29,895 common,
  fully-in-set entries; target band was 6,000–10,000, capped at the ceiling)
- **Furigana coverage**: 9,956 / 10,000 seeded vocab (99.6%) resolved via
  JmdictFurigana's own per-character segments; 44 fell back to a synthesized
  whole-word ruby span (`furiganaFallback = true`)
- **KanjiVG decomposition coverage**: 6,413 / 10,384 seeded kanji (61.8%)
  have a KanjiVG entry at all — KanjiVG's release covers ~6,700 characters
  total, well short of KANJIDIC2's full character set, so a large share of
  seeded kanji (mostly rarer/non-Jōyō characters) have no
  `SubjectComponent` decomposition edges
- **KRADFILE cross-check**: 5,789 kanji have at least one component in
  KRADFILE's flat map that KanjiVG's *direct-child* decomposition does not
  surface. This is a real, expected gap, not a bug — the two projects
  decompose differently (KRADFILE is flatter and closer to traditional
  radical lists; KanjiVG's direct children are its own nested stroke-group
  structure, which for complex kanji sits a level "deeper" than KRADFILE's
  single-level list). KanjiVG stays the `SubjectComponent` source of truth
  per the task's mapping spec; this number is reported so a future
  radical-inventory pass has an honest starting point rather than silently
  under-seeding some compositions.

Sentences and grammar subjects are out of scope for this task and are not
seeded.

## Testing

```
npm run test        # unit tests for every parser (scripts/seed/lib/__tests__)
npm run typecheck
```

Every parser in `lib/` is tested against small inline fixtures, plus the two
CSV/JSON-shaped ones (`kanji-alive-parser`, `jmdict-furigana-parser`,
`jlpt-source`) against realistic shapes taken from the live source files.
`transform.ts` and `load.ts` themselves are orchestration and are exercised
by actually running the pipeline against real downloaded data, not unit
tests — there is nothing left to test in them once the pure `lib/` functions
they call are covered.
