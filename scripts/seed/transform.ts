// Phase 2: reads data/raw/ (already downloaded by download.ts) and produces
// data/processed/{subjects,components,data-sources}.jsonl. Pure transform —
// no network, no database. Every parsing decision lives in scripts/seed/lib
// and is independently unit-tested there; this file is orchestration only
// (read raw files, call the pure parsers, join, assign levels, write JSONL).
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { gunzipSync } from "node:zlib";
import AdmZip from "adm-zip";

import { decodeEucJp } from "./lib/euc-jp";
import { parseKanjidic2 } from "./lib/kanjidic-parser";
import { parseJMdict, isCommonPriority, nfBucket, type JMdictEntry } from "./lib/jmdict-parser";
import { parseKradfile } from "./lib/kradfile-parser";
import { parseKanjiVg, type KanjiVgResult } from "./lib/kanjivg-parser";
import { parseJlptSource } from "./lib/jlpt-source";
import { parseKanjiAliveRadicals } from "./lib/kanji-alive-parser";
import { parseJmdictFuriganaJson } from "./lib/jmdict-furigana-parser";
import { buildFuriganaIndex, jmdictFormPairs, lookupFurigana } from "./lib/furigana-join";
import {
  assignGrammarLevels,
  assignLevels,
  assignSentenceLevels,
  type LevelInput,
  type SentenceLevelInput,
} from "./lib/level-heuristic";
import { baseSlug, dedupeSlug } from "./lib/slug";
import { DATA_SOURCES } from "./lib/data-sources";
import { ALL_KANA } from "./lib/kana";
import { assignKanaLevels } from "./lib/kana-level";
import { KANGXI_RADICALS } from "./lib/kangxi-radicals";
import { buildKangxiResolver, radicalSlugName } from "./lib/kangxi-resolver";
import { parseTatoebaSentences } from "./lib/tatoeba-sentences";
import { parseTatoebaIndices } from "./lib/tatoeba-indices";
import { parseTatoebaLinks } from "./lib/tatoeba-links";
import { locateTokens, spliceSentenceFurigana } from "./lib/sentence-transform";
import { classifyVocabPos } from "./lib/pos-classifier";
import { GRAMMAR_POINTS } from "./lib/grammar-points";
import { matchGrammarExamples } from "./lib/sentence-transform";
import type { ComponentRecord, FuriganaSegment, MeaningEntry, ReadingEntry, SubjectRecord } from "./lib/types";

const RAW_DIR = path.resolve(__dirname, "../../data/raw");
const OUT_DIR = path.resolve(__dirname, "../../data/processed");

// Vocab scope control: only common entries whose every kanji character is in
// the seeded kanji set, per the task's scope directive. This keeps the
// seeded vocab in the low thousands rather than JMdict's full ~200k.
const VOCAB_TARGET_MIN = 6000;
const VOCAB_TARGET_MAX = 40000;

// Sentence selection target. We do not seed all ~150k Tatoeba sentences —
// only good-example sentences whose every token resolves to a seeded VOCAB
// subject and that carry an English translation. This band is a target for
// reporting only (selection is a hard filter, not trimmed to fit); see the
// funnel logged at the end of main().
const SENTENCE_TARGET_MIN = 3000;
const SENTENCE_TARGET_MAX = 5000;

function readGz(filename: string): string {
  return gunzipSync(readFileSync(path.join(RAW_DIR, filename))).toString("utf-8");
}

function readZipEntry(zipFilename: string, entryName: string): Buffer {
  const zip = new AdmZip(path.join(RAW_DIR, zipFilename));
  const entry = zip.getEntry(entryName);
  if (!entry) throw new Error(`${entryName} not found inside ${zipFilename}`);
  return entry.getData();
}

function findRawFile(pattern: RegExp): string {
  const match = readdirSync(RAW_DIR).find((f) => pattern.test(f));
  if (!match) {
    throw new Error(`No file matching ${pattern} found in data/raw/. Run npm run seed:download first.`);
  }
  return match;
}

function writeJsonl<T>(filename: string, rows: T[]) {
  const dest = path.join(OUT_DIR, filename);
  writeFileSync(dest, rows.map((r) => JSON.stringify(r)).join("\n") + (rows.length ? "\n" : ""));
  console.log(`[write] ${filename}: ${rows.length} rows`);
}

interface CoverageStats {
  furiganaHits: number;
  furiganaMisses: number;
  kanjiWithKvg: number;
  kanjiWithoutKvg: number;
  kradfileCoverageGaps: string[];
}

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });

  // ---------------------------------------------------------------- Kanji
  const kanjidicXml = readGz("kanjidic2.xml.gz");
  const kanjiRecords = parseKanjidic2(kanjidicXml);

  const jlptRows = parseJlptSource(readFileSync(path.join(RAW_DIR, "kanji-data.json"), "utf-8"));
  const jlptByKanji = new Map(jlptRows.map((r) => [r.kanji, r.jlpt]));

  // ------------------------------------------------------------- KanjiVG
  // The download script names the asset kanjivg-<date>-main.zip; find it by
  // suffix rather than hardcoding the date.
  const kanjivgZipName = findRawFile(/^kanjivg-.*-main\.zip$/i);
  const kanjivgZip = new AdmZip(path.join(RAW_DIR, kanjivgZipName));
  const kanjivgByLiteral = new Map<string, KanjiVgResult>();
  for (const entry of kanjivgZip.getEntries()) {
    if (!entry.entryName.endsWith(".svg")) continue;
    // Skip variant glyph forms (filenames with a "-" suffix, e.g.
    // 04e00-Kaisho.svg): we only want the standard decomposition per kanji.
    const base = path.basename(entry.entryName, ".svg");
    if (base.includes("-")) continue;
    const parsed = parseKanjiVg(entry.getData().toString("utf-8"));
    if (parsed) kanjivgByLiteral.set(parsed.literal, parsed);
  }

  // ------------------------------------------------------------ KRADFILE
  const kradBuffer = readZipEntry("kradzip.zip", "kradfile");
  const kradRows = parseKradfile(decodeEucJp(kradBuffer));
  const kradByKanji = new Map(kradRows.map((r) => [r.kanji, r.components]));

  // -------------------------------------------------------- Kanji Alive
  // No longer used to source radical names (see kangxi-radicals.ts for why:
  // Kanji Alive's CSV mixes canonical and variant-position rows under a row
  // index that is not the Kangxi radical number). Left parsed only so the
  // parser/fixture stays exercised; not joined into subjects below.
  const kanjiAliveCsv = readFileSync(path.join(RAW_DIR, "kanjialive-radicals.csv"), "utf-8");
  parseKanjiAliveRadicals(kanjiAliveCsv);

  // ---------------------------------------------------------------------
  // Build RADICAL subjects from the fixed 214 Kangxi radicals (see
  // scripts/seed/lib/kangxi-radicals.ts). Unlike KanjiVG's 1,418 arbitrary
  // component chars, every one of these has an authoritative English name,
  // a stroke count, and a stable number — no dictionary join required, no
  // fallback-to-glyph possible.
  // ---------------------------------------------------------------------
  const kangxiResolver = buildKangxiResolver();

  const subjects: SubjectRecord[] = [];
  const components: ComponentRecord[] = [];
  const usedSlugs = new Set<string>();
  const levelInputs: LevelInput[] = [];

  // ---------------------------------------------------------------------
  // KANA subjects: the fixed 208-character hiragana/katakana set (see
  // scripts/seed/lib/kana.ts), placed on its own pre-curriculum level ladder
  // (kana-level.ts) entirely separate from assignLevels below — kana has no
  // dependency graph and sits strictly before radicals (see
  // src/services/srs/unlock.ts's kana gate). Meaning-only: the romaji is
  // stored in `meanings` (not `readings`) so it grades through the same
  // meaning-question path as every other type, per the task's grading
  // design — see src/services/answer/grade.ts's isKanaRomaji handling.
  // ---------------------------------------------------------------------
  const kanaPlacements = assignKanaLevels(ALL_KANA);
  for (const { kana, level } of kanaPlacements) {
    const tempId = `kana-${kana.script}-${kana.romaji}`;
    subjects.push({
      tempId,
      type: "KANA",
      level,
      slug: dedupeSlug(`kana-${kana.script}-${kana.romaji}`, usedSlugs),
      characters: kana.character,
      meanings: [{ meaning: kana.romaji, primary: true }],
      readings: [],
      jlpt: null,
      jlptLegacy: null,
      frequency: null,
      metadata: { script: kana.script, row: kana.row, column: kana.column },
      furigana: null,
      furiganaFallback: false,
    });
  }

  const radicalTempIdByNumber = new Map<number, string>();
  for (const radical of KANGXI_RADICALS) {
    const tempId = `radical-${radical.number}`;
    radicalTempIdByNumber.set(radical.number, tempId);

    const meanings: MeaningEntry[] = [{ meaning: capitalize(radical.name), primary: true }];
    const readings: ReadingEntry[] = [{ reading: radical.romaji, primary: true, type: "romaji" }];

    subjects.push({
      tempId,
      type: "RADICAL",
      level: 0, // placeholder, overwritten by assignLevels below
      slug: dedupeSlug(`radical-${radical.number}-${radicalSlugName(radical)}`, usedSlugs),
      characters: radical.character,
      meanings,
      readings,
      jlpt: null,
      jlptLegacy: null,
      frequency: null,
      metadata: {
        source: "kangxi-214",
        number: radical.number,
        strokeCount: radical.strokes,
        variants: radical.variants,
      },
      furigana: null,
      furiganaFallback: false,
    });

    levelInputs.push({
      tempId,
      type: "RADICAL",
      grade: null,
      // Radicals have no JLPT band or dictionary frequency of their own, so
      // curriculumCompare would otherwise fall back to tempId string
      // comparison ("radical-100-..." sorts before "radical-9-..."),
      // scrambling the natural Kangxi ordering. Use the radical's Kangxi
      // number as its frequency-equivalent tiebreak: lower number = more
      // fundamental/simpler radical = earlier in the curriculum. This
      // matters once identity radicals must land before their kanji —
      // without it, low-numbered radicals needed by level-1 kanji could
      // lose the level-1 radical quota to arbitrarily higher-numbered ones.
      frequency: radical.number,
      jlpt: null,
      isCommon: false,
      dependsOn: [],
    });
  }

  // ---------------------------------------------------------------------
  // KANJI subjects
  // ---------------------------------------------------------------------
  const kanjiTempIdByLiteral = new Map<string, string>();
  const coverage: CoverageStats = {
    furiganaHits: 0,
    furiganaMisses: 0,
    kanjiWithKvg: 0,
    kanjiWithoutKvg: 0,
    kradfileCoverageGaps: [],
  };

  for (const kanji of kanjiRecords) {
    // Skip kanji KANJIDIC2 has no meanings for (rare, mostly obscure
    // variant forms) — nothing to seed as a meaning-quiz subject.
    if (kanji.meanings.length === 0) continue;

    const tempId = `kanji-${kanji.literal}`;
    kanjiTempIdByLiteral.set(kanji.literal, tempId);

    const meanings: MeaningEntry[] = kanji.meanings.map((m, i) => ({ meaning: m, primary: i === 0 }));
    const readings: ReadingEntry[] = [
      ...kanji.onyomi.map((r, i) => ({ reading: r, primary: i === 0, type: "onyomi" })),
      ...kanji.kunyomi.map((r, i) => ({ reading: r.clean, primary: i === 0, type: "kunyomi" })),
    ];

    const kvg = kanjivgByLiteral.get(kanji.literal);
    if (kvg) coverage.kanjiWithKvg += 1;
    else coverage.kanjiWithoutKvg += 1;

    // KRADFILE cross-check: report KRADFILE components that don't resolve to
    // any Kangxi radical (either not a real component of this kanji's own
    // decomposition, or a sub-Kangxi visual fragment) — informational only,
    // those components are dropped from the unlock graph below.
    const kradComponents = kradByKanji.get(kanji.literal) ?? [];
    const unresolvedKrad = kradComponents.filter(
      (c) => c !== kanji.literal && !kangxiResolver.has(c),
    );
    if (unresolvedKrad.length > 0) {
      coverage.kradfileCoverageGaps.push(
        `${kanji.literal}: KRADFILE component(s) ${unresolvedKrad.join("")} do not resolve to a Kangxi radical`,
      );
    }

    subjects.push({
      tempId,
      type: "KANJI",
      level: 0,
      slug: dedupeSlug(baseSlug("kanji", kanji.literal), usedSlugs),
      characters: kanji.literal,
      meanings,
      readings,
      jlpt: jlptByKanji.get(kanji.literal) ?? null,
      jlptLegacy: kanji.jlptLegacy,
      frequency: kanji.frequency,
      metadata: {
        strokeCount: kanji.strokeCount,
        nanori: kanji.nanori,
        kunyomiRaw: kanji.kunyomi.map((k) => k.raw),
      },
      furigana: null,
      furiganaFallback: false,
    });

    // KRADFILE is the SubjectComponent source of truth for radicals (see
    // scripts/seed/README.md): it maps kanji to recognizable visual parts
    // rather than KanjiVG's arbitrary stroke-group decomposition. Each
    // component resolves through kangxiResolver to its canonical Kangxi
    // radical (e.g. 氵 -> 水); components that aren't Kangxi radicals or
    // variants of one (KRADFILE decomposes more finely than 214 radicals)
    // are dropped from the unlock graph rather than becoming unnamed
    // radicals. The kanji's own literal is excluded (KRADFILE lists it
    // when the kanji is itself a radical).
    // Every kanji-to-radical component edge is a STRICT prerequisite: a
    // radical must be learnable (Guru-able) before its kanji unlocks, so it
    // must sit at a level strictly less than the kanji's, never tied. (Two
    // radicals under the same kanji, or a radical and an unrelated kanji,
    // may still share a level — only a direct component edge is strict.)
    const dependsOn: string[] = [];
    const strictDependsOn: string[] = [];
    const seenRadicalNumbers = new Set<number>();
    for (const comp of kradComponents) {
      if (comp === kanji.literal) continue;
      const radical = kangxiResolver.get(comp);
      if (!radical || seenRadicalNumbers.has(radical.number)) continue;
      seenRadicalNumbers.add(radical.number);
      const compTempId = radicalTempIdByNumber.get(radical.number);
      if (!compTempId) continue;
      dependsOn.push(compTempId);
      strictDependsOn.push(compTempId);
      components.push({
        parentTempId: tempId,
        childTempId: compTempId,
        position: null,
        isRadical: comp === radical.character,
        readingUsed: null,
        isGating: true,
      });
    }

    // Identity radical link: if this kanji's own character IS a Kangxi
    // radical (e.g. 一, 人, 十, 日, 月, 大, 生 — the simplest, highest-
    // frequency kanji, which KRADFILE never decomposes into anything since
    // there's nothing smaller to decompose into), wire the radical form as
    // an explicit prerequisite. Without this, levels 1-2 (dominated by
    // these radical-kanji) end up with zero SubjectComponent rows and
    // unlock vacuously — see task write-up. This mirrors WaniKani's
    // treatment of e.g. the "one" radical preceding the 一 kanji.
    const identityRadical = kangxiResolver.get(kanji.literal);
    if (identityRadical && !seenRadicalNumbers.has(identityRadical.number)) {
      const compTempId = radicalTempIdByNumber.get(identityRadical.number);
      if (compTempId) {
        seenRadicalNumbers.add(identityRadical.number);
        dependsOn.push(compTempId);
        strictDependsOn.push(compTempId);
        components.push({
          parentTempId: tempId,
          childTempId: compTempId,
          position: null,
          isRadical: true,
          readingUsed: null,
          isGating: true,
        });
      }
    }

    levelInputs.push({
      tempId,
      type: "KANJI",
      grade: kanji.grade,
      frequency: kanji.frequency,
      jlpt: jlptByKanji.get(kanji.literal) ?? null,
      isCommon: false,
      dependsOn,
      strictDependsOn,
    });
  }

  // ---------------------------------------------------------------------
  // VOCAB subjects, scoped to common entries whose kanji are all in the
  // seeded kanji set.
  // ---------------------------------------------------------------------
  const jmdictXml = readGz("JMdict_e.gz");
  const jmdictEntries = parseJMdict(jmdictXml);

  const furiganaRows = parseJmdictFuriganaJson(readFileSync(path.join(RAW_DIR, "JmdictFurigana.json"), "utf-8"));
  const furiganaIndex = buildFuriganaIndex(furiganaRows);

  const seededKanjiChars = new Set(kanjiTempIdByLiteral.keys());

  function entryIsCommon(entry: JMdictEntry): boolean {
    return (
      entry.kanji.some((k) => isCommonPriority(k.priorities)) ||
      entry.readings.some((r) => isCommonPriority(r.priorities))
    );
  }

  // Kanji forms with zero priority tags (no ke_pri at all) are JMdict's rare/
  // search-only variant spellings (e.g. の's 乃/之 — real but essentially
  // never written), not forms this pipeline should treat as "the" kanji form
  // of the entry. Restricting to prioritized forms keeps particles like の
  // correctly recognized as kana-primary instead of being excluded entirely
  // because an obscure variant kanji isn't in the seeded kanji set.
  function primaryEligibleKanjiForms(entry: JMdictEntry): JMdictEntry["kanji"] {
    const prioritized = entry.kanji.filter((k) => k.priorities.length > 0);
    return prioritized.length > 0 ? prioritized : entry.kanji.length > 0 ? [] : entry.kanji;
  }

  function entryKanjiAllSeeded(entry: JMdictEntry): boolean {
    const forms = primaryEligibleKanjiForms(entry);
    if (forms.length === 0) return true; // kana-only (or only-unprioritized-kanji) vocab has no kanji dependency
    // Every kanji form must consist entirely of seeded kanji characters
    // (non-kanji characters in a form, e.g. okurigana kana, are ignored).
    return forms.every((k) => [...k.text].every((ch) => !isKanjiChar(ch) || seededKanjiChars.has(ch)));
  }

  const candidateVocab = jmdictEntries.filter((e) => entryIsCommon(e) && entryKanjiAllSeeded(e));

  // If the common+in-vocabulary-set filter overshoots the target band, trim
  // by nfXX rank (lower nfXX = more frequent) then by entry order, keeping
  // the most common entries first; entries without an nfXX bucket sort last
  // but still ahead of being dropped, since isCommonPriority already
  // guarantees some priority signal exists.
  //
  // EXCEPTION: entries tagged spec1/spec2 — JMdict's own "the frequency
  // list doesn't cover this, but it's obviously essential" marker, which is
  // exactly the (small, ~dozens-of-entries) bucket the core particles は/
  // の/を/が/で/と/か and copulas だ/です live in — never carry an nfXX
  // sub-rank, so the plain `?? 999` fallback below sorted them dead last
  // among ~20k nf-ranked nouns and dropped them from the 10k cap entirely.
  // That in turn made whole-sentence resolution (phase 2's sentence
  // transform, which requires every token in a candidate sentence to
  // resolve to seeded vocab) nearly impossible, since virtually every
  // sentence uses a particle. Boosting the full news1/ichi1/gai1-tagged-
  // but-unranked population (~7.5k entries, not just spec1/spec2) was
  // tried and reverted: it starves the nf-ranked tier's own top of common
  // nouns/verbs (見る, 来る, 良い...) enough to crater furigana coverage and
  // net *fewer* resolvable sentences, not more — most nfXX-ranked entries
  // are themselves also news1/ichi1-tagged, so a blanket tag boost mostly
  // just reorders ties rather than rescuing anything. spec1/spec2 is kept
  // narrow and targeted at true grammar words specifically.
  candidateVocab.sort((a, b) => {
    const specA = hasSpecPriority(a);
    const specB = hasSpecPriority(b);
    if (specA !== specB) return specA ? -1 : 1;
    const rankA = bestNfBucket(a);
    const rankB = bestNfBucket(b);
    return (rankA ?? 999) - (rankB ?? 999);
  });
  const selectedVocab =
    candidateVocab.length > VOCAB_TARGET_MAX ? candidateVocab.slice(0, VOCAB_TARGET_MAX) : candidateVocab;

  for (const entry of selectedVocab) {
    // Prefer a prioritized (actually-common-in-writing) kanji form, same
    // eligibility rule as entryKanjiAllSeeded above, so an entry whose only
    // kanji forms are rare/search-only spellings (ke_pri-less, e.g. の's 乃)
    // is treated as kana-primary rather than surfacing that obscure form as
    // "the" characters for the subject.
    const eligibleKanji = primaryEligibleKanjiForms(entry);
    const primaryKanji = eligibleKanji[0]?.text ?? null;
    const primaryReading = entry.readings[0]?.text ?? entry.kanji[0]?.text ?? "";
    const characters = primaryKanji ?? primaryReading;
    const tempId = `vocab-${entry.entSeq}`;

    const meanings: MeaningEntry[] = [];
    for (const sense of entry.senses) {
      sense.glosses.forEach((g, i) => meanings.push({ meaning: g, primary: meanings.length === 0 && i === 0 }));
    }

    const readings: ReadingEntry[] = entry.readings.map((r, i) => ({
      reading: r.text,
      primary: i === 0,
      type: "kana",
    }));

    const pairs = jmdictFormPairs(entry);
    // Only fall back to an arbitrary pair when `characters` itself is a
    // kanji form some pair actually names — for a kana-primary entry (no
    // prioritized kanji form, characters === primaryReading, e.g. の), the
    // remaining pairs all belong to demoted/unprioritized kanji spellings
    // (乃, 之) and would produce a wrong ruby if used, so skip straight to
    // the synthesized whole-word fallback instead of pairs[0].
    const primaryPair = pairs.find((p) => p.text === characters);
    const { furigana, fallback } = primaryPair
      ? lookupFurigana(furiganaIndex, primaryPair.text, primaryPair.reading)
      : { furigana: [{ ruby: characters, rt: primaryReading }], fallback: true };

    if (fallback) coverage.furiganaMisses += 1;
    else coverage.furiganaHits += 1;

    const isCommon = entryIsCommon(entry);
    const nfRank = bestNfBucket(entry);
    const hasUk = entry.senses.some((s) => s.misc.includes("uk"));
    const pos = [...new Set(entry.senses.flatMap((s) => s.pos))];

    subjects.push({
      tempId,
      type: "VOCAB",
      level: 0,
      slug: dedupeSlug(baseSlug("vocab", `${characters}-${primaryReading}`), usedSlugs),
      characters,
      meanings,
      readings,
      jlpt: null,
      jlptLegacy: null,
      frequency: nfRank,
      metadata: { entSeq: entry.entSeq, isCommon, nfRank, uk: hasUk, pos },
      furigana,
      furiganaFallback: fallback,
    });

    // vocab -> kanji links, derived from the furigana segment array so
    // readingUsed reflects the reading actually in play for this word
    // (e.g. 生 as せい in 学生 vs なま in 生物), not a naive character scan.
    const dependsOn: string[] = [];
    const seenKanjiInWord = new Set<string>();
    for (const segment of furigana) {
      for (const ch of segment.ruby) {
        if (!isKanjiChar(ch)) continue;
        const kanjiTempId = kanjiTempIdByLiteral.get(ch);
        if (!kanjiTempId || seenKanjiInWord.has(ch)) continue;
        seenKanjiInWord.add(ch);
        dependsOn.push(kanjiTempId);
        components.push({
          parentTempId: tempId,
          childTempId: kanjiTempId,
          position: null,
          isRadical: false,
          readingUsed: segment.rt ?? null,
          isGating: true,
        });
      }
    }

    levelInputs.push({
      tempId,
      type: "VOCAB",
      grade: null,
      frequency: nfRank,
      jlpt: null,
      isCommon,
      dependsOn,
      strictDependsOn: dependsOn,
    });
  }

  // ---------------------------------------------------------------------
  // Level assignment (radicals, kanji, vocab)
  // ---------------------------------------------------------------------
  const levels = assignLevels(levelInputs);
  for (const subject of subjects) {
    // KANA already has its own final level from assignKanaLevels above —
    // it never appears in levelInputs (kana has no dependency graph), so
    // levels.get would incorrectly null it out here.
    if (subject.type === "KANA") continue;
    subject.level = levels.get(subject.tempId) ?? null;
  }

  // ---------------------------------------------------------------------
  // SENTENCE subjects, built from Tatoeba (see scripts/seed/lib/tatoeba-*).
  // ---------------------------------------------------------------------
  const sentenceFunnel = {
    totalIndexed: 0,
    goodExample: 0,
    hasTranslation: 0,
    allTokensResolved: 0,
    selected: 0,
  };

  // Full-JMdict (not just seeded vocab) headword -> pos-code lookup, used
  // only to classify a Tatoeba index token as content or function when it
  // fails to resolve to a seeded VOCAB subject (see the sentence loop
  // below). An unresolved token still has a real JMdict entry almost
  // always — it's simply not in our ~10k-entry seeded scope — and that
  // entry's own pos tags are enough to tell "this was a particle" from
  // "this was an off-ladder noun" without needing the word to be seeded.
  const posByHeadword = new Map<string, string[]>();
  for (const entry of jmdictEntries) {
    const pos = [...new Set(entry.senses.flatMap((s) => s.pos))];
    if (pos.length === 0) continue;
    for (const k of entry.kanji) {
      const existing = posByHeadword.get(k.text);
      posByHeadword.set(k.text, existing ? [...new Set([...existing, ...pos])] : pos);
    }
    for (const r of entry.readings) {
      const existing = posByHeadword.get(r.text);
      posByHeadword.set(r.text, existing ? [...new Set([...existing, ...pos])] : pos);
    }
  }

  // Vocab lookup: headword or reading -> candidate vocab tempIds, so a
  // token's `headword` (kanji or kana form) and optional disambiguating
  // `reading` can resolve to the specific seeded VOCAB subject it names.
  const vocabByCharacters = new Map<string, string[]>(); // kanji-form characters -> tempIds
  const vocabByKanaCharacters = new Map<string, string[]>(); // kana-only vocab's characters -> tempIds
  const vocabSubjectByTempId = new Map<string, SubjectRecord>();
  for (const s of subjects) {
    if (s.type !== "VOCAB") continue;
    vocabSubjectByTempId.set(s.tempId, s);
    if (!s.characters) continue;
    // A vocab's `characters` is its primary kanji form when it has one,
    // otherwise its primary kana reading (see the VOCAB-building loop
    // above). Route headword matches accordingly: kanji-form vocab is
    // matched by its kanji characters, kana-only vocab (particles, kana-
    // only common words) by its own kana form — never by a kanji-form
    // vocab's *reading*, which collides constantly across homophones (e.g.
    // 野 and 三 both read さん/の for different words; matching a bare kana
    // index token like の or さん against those would silently mis-resolve
    // a particle to an unrelated content word).
    const hasKanji = [...s.characters].some(isKanjiChar);
    const index = hasKanji ? vocabByCharacters : vocabByKanaCharacters;
    const list = index.get(s.characters) ?? [];
    list.push(s.tempId);
    index.set(s.characters, list);
  }

  /// Resolves one index token to a single seeded VOCAB tempId, or null if it
  /// doesn't resolve. Matches the token's `headword` against a kanji-form
  /// vocab's `characters` (optionally narrowed by `reading` when the
  /// headword is ambiguous across multiple seeded entries sharing that
  /// kanji form, e.g. 生物 read as either せいぶつ or なまもの), falling back
  /// to a kana-only vocab whose own characters equal the headword. Never
  /// matches a kana headword against a kanji-form vocab's reading — see the
  /// comment on vocabByKanaCharacters above for why that produces wrong
  /// matches.
  function resolveToken(token: { headword: string; reading?: string }): string | null {
    const byChars = vocabByCharacters.get(token.headword);
    if (byChars && byChars.length > 0) {
      if (byChars.length === 1) return byChars[0];
      if (token.reading) {
        const disambiguated = byChars.find((tempId) =>
          vocabSubjectByTempId.get(tempId)!.readings.some((r) => r.reading === token.reading),
        );
        if (disambiguated) return disambiguated;
      }
      return byChars[0];
    }
    const byKana = vocabByKanaCharacters.get(token.headword);
    if (byKana && byKana.length > 0) return byKana[0];
    // The index's headword is sometimes a rare/archaic kanji spelling
    // (為る, 此の, 彼, ...) that our seeded vocab set never surfaces as
    // `characters` (see primaryEligibleKanjiForms above — an unprioritized
    // kanji form never becomes a vocab's primary characters), while the
    // token's own disambiguating `reading` names the modern/common kana
    // form directly (為る(する) -> する). Try the reading itself as a kana
    // headword before giving up.
    if (token.reading) {
      const byReadingAsKana = vocabByKanaCharacters.get(token.reading);
      if (byReadingAsKana && byReadingAsKana.length > 0) return byReadingAsKana[0];
    }
    return null;
  }

  // ---------------------------------------------------- Tatoeba raw parse
  const jpnSentenceRows = parseTatoebaSentences(readFileSync(path.join(RAW_DIR, "jpn_sentences.tsv"), "utf-8"));
  const engSentenceRows = parseTatoebaSentences(readFileSync(path.join(RAW_DIR, "eng_sentences.tsv"), "utf-8"));
  const links = parseTatoebaLinks(readFileSync(path.join(RAW_DIR, "jpn-eng_links.tsv"), "utf-8"));
  const { lines: indexLines } = parseTatoebaIndices(readFileSync(path.join(RAW_DIR, "jpn_indices"), "utf-8"));

  const jpnTextById = new Map(jpnSentenceRows.map((s) => [s.id, s.text]));
  const engTextById = new Map(engSentenceRows.map((s) => [s.id, s.text]));
  const engTranslationsByJpnId = new Map<string, string[]>();
  for (const link of links) {
    const engText = engTextById.get(link.targetId);
    if (!engText) continue;
    const list = engTranslationsByJpnId.get(link.sourceId) ?? [];
    list.push(engText);
    engTranslationsByJpnId.set(link.sourceId, list);
  }

  // A sentence can have multiple index lines (one per meaning id); a
  // sentence counts as a "good example" if ANY of its index lines carries
  // the ~ marker on any token, and its token set for resolution purposes is
  // the union of tokens across its own index lines.
  const indexLinesBySentenceId = new Map<string, typeof indexLines>();
  for (const line of indexLines) {
    const list = indexLinesBySentenceId.get(line.sentenceId) ?? [];
    list.push(line);
    indexLinesBySentenceId.set(line.sentenceId, list);
  }
  sentenceFunnel.totalIndexed = indexLinesBySentenceId.size;

  interface SentenceCandidate {
    tempId: string;
    sentenceId: string;
    characters: string;
    meanings: MeaningEntry[];
    resolvedTokens: {
      surface: string;
      start: number;
      end: number;
      vocabTempId: string;
      isContent: boolean;
    }[];
    furiganaFallback: boolean;
    isGoodExample: boolean;
  }

  const sentenceCandidates: SentenceCandidate[] = [];
  const usedSentenceSlugs = new Set<string>();
  // Diagnostics only: how many content words a good-example+translated
  // sentence is missing (unresolved to seeded vocab), bucketed 0-6+, over
  // every candidate that reaches the content-resolution check (i.e. has at
  // least one content word at all).
  const missingContentHistogram = new Map<number, number>();

  // Content-word gating (see scripts/seed/lib/pos-classifier.ts): a
  // sentence's unlock requirement and level placement depend only on its
  // CONTENT vocab (nouns, verbs, adjectives, adverbs). Function words
  // (particles, copula, auxiliaries, conjunctions, pronouns, counters,
  // interjections) may appear unresolved or off-ladder without disqualifying
  // the sentence — they still render with furigana as context, they just
  // don't gate. A token that fails to locate/resolve at all is only fatal
  // when it would have been a content word; an unresolved function-word
  // token still breaks the substring cursor (see locateTokens), so it's
  // dropped from resolvedTokens and rendered as a plain gap by
  // spliceSentenceFurigana instead of aborting the sentence.
  for (const [sentenceId, lines] of indexLinesBySentenceId) {
    const characters = jpnTextById.get(sentenceId);
    if (!characters) continue;

    // Use the first index line's tokens (the common case is exactly one
    // line per sentence id; where multiple meaning ids exist, later lines
    // are alternate word-sense annotations of the same text — the first is
    // representative for token/offset purposes).
    const primaryLine = lines[0];
    const isGoodExample = lines.some((l) => l.tokens.some((t) => t.isGoodExample));
    if (!isGoodExample) continue;
    sentenceFunnel.goodExample += 1;

    const translations = engTranslationsByJpnId.get(sentenceId);
    if (!translations || translations.length === 0) continue;
    sentenceFunnel.hasTranslation += 1;

    const located = locateTokens(characters, primaryLine.tokens);
    const resolvedTokens: SentenceCandidate["resolvedTokens"] = [];
    let contentTokenCount = 0;
    let allContentResolved = true;
    for (let i = 0; i < primaryLine.tokens.length; i += 1) {
      const loc = located[i];
      const token = primaryLine.tokens[i];
      if (!loc) continue; // can't locate in the sentence text at all — dropped, not gating

      const vocabTempId = resolveToken(token);
      if (vocabTempId) {
        const vocabSubject = vocabSubjectByTempId.get(vocabTempId)!;
        const pos = Array.isArray(vocabSubject.metadata.pos) ? (vocabSubject.metadata.pos as string[]) : [];
        const isContent = classifyVocabPos(pos) === "content";
        if (isContent) contentTokenCount += 1;
        resolvedTokens.push({ surface: loc.text, start: loc.start, end: loc.end, vocabTempId, isContent });
        continue;
      }

      // Token didn't resolve to a seeded VOCAB subject. Classify it against
      // the FULL JMdict pos set (not just seeded scope) so a content word
      // that's simply outside our ~10k-entry vocab cap correctly fails
      // eligibility, while a function word that's outside the cap for the
      // same reason does not — see posByHeadword above.
      const pos = posByHeadword.get(token.headword) ?? (token.reading ? posByHeadword.get(token.reading) : undefined);
      const isContent = classifyVocabPos(pos ?? []) === "content";
      if (isContent) {
        contentTokenCount += 1;
        allContentResolved = false; // a content token that never resolved to seeded vocab
      }
      // Unresolved function-word tokens are simply dropped — no
      // resolvedTokens entry, no SubjectComponent edge, no gating impact.
    }
    if (contentTokenCount === 0) continue; // nothing to gate on: not a useful example sentence
    const resolvedContentCount = resolvedTokens.filter((t) => t.isContent).length;
    const missingContentCount = contentTokenCount - resolvedContentCount;
    missingContentHistogram.set(
      Math.min(missingContentCount, 6),
      (missingContentHistogram.get(Math.min(missingContentCount, 6)) ?? 0) + 1,
    );
    if (!allContentResolved) continue;
    sentenceFunnel.allTokensResolved += 1;

    const meanings: MeaningEntry[] = translations.map((t, i) => ({ meaning: t, primary: i === 0 }));

    sentenceCandidates.push({
      tempId: `sentence-${sentenceId}`,
      sentenceId,
      characters,
      meanings,
      resolvedTokens,
      furiganaFallback: false,
      isGoodExample,
    });
  }
  sentenceFunnel.selected = sentenceCandidates.length;

  // Build SENTENCE subjects + SubjectComponent edges for every candidate
  // (level assignment happens after, once vocab levels are known).
  const sentenceLevelInputs: SentenceLevelInput[] = [];
  for (const candidate of sentenceCandidates) {
    const spliced: FuriganaSegment[] = spliceSentenceFurigana(
      candidate.characters,
      candidate.resolvedTokens.map((t) => ({
        start: t.start,
        end: t.end,
        furigana: vocabSubjectByTempId.get(t.vocabTempId)!.furigana ?? [
          { ruby: t.surface, rt: undefined },
        ],
      })),
    );

    // Emit a SubjectComponent edge for every resolved vocab, content and
    // function alike, so the UI can highlight/link every word in the
    // sentence — but only content-word edges that are ALSO laddered (level
    // !== null) are gating (see isGating's doc comment on ComponentRecord).
    // A content word seeded but off-ladder (never taught, no way to Guru it)
    // would otherwise be a permanent lock on the sentence, so it is treated
    // like a function word for gating purposes: still linked/highlighted,
    // just not required to unlock. isContent is deduped per vocabTempId by
    // OR: if a headword resolves to a content sense anywhere in the
    // sentence, its edge is content (subject to the laddered check above).
    // `levels` (vocab tempId -> assigned level) is already fully populated
    // by assignLevels before this sentence loop runs, so this reads final
    // levels, not a pre-assignment view.
    const isContentByVocabTempId = new Map<string, boolean>();
    for (const t of candidate.resolvedTokens) {
      isContentByVocabTempId.set(t.vocabTempId, (isContentByVocabTempId.get(t.vocabTempId) ?? false) || t.isContent);
    }
    const dedupedVocabTempIds = [...isContentByVocabTempId.keys()];
    const contentVocabTempIds = dedupedVocabTempIds.filter((id) => isContentByVocabTempId.get(id));
    for (const vocabTempId of dedupedVocabTempIds) {
      const isContent = isContentByVocabTempId.get(vocabTempId) ?? false;
      const isLaddered = levels.get(vocabTempId) !== null && levels.get(vocabTempId) !== undefined;
      components.push({
        parentTempId: candidate.tempId,
        childTempId: vocabTempId,
        position: null,
        isRadical: false,
        readingUsed: null,
        isGating: isContent && isLaddered,
      });
    }

    subjects.push({
      tempId: candidate.tempId,
      type: "SENTENCE",
      level: 0, // placeholder, overwritten below once vocab levels are known
      slug: dedupeSlug(baseSlug("sentence", candidate.sentenceId), usedSentenceSlugs),
      characters: candidate.characters,
      meanings: candidate.meanings,
      readings: [],
      jlpt: null,
      jlptLegacy: null,
      frequency: null,
      metadata: {
        tatoebaSentenceId: candidate.sentenceId,
        isGoodExample: candidate.isGoodExample,
        tokens: candidate.resolvedTokens.map((t) => ({
          surface: t.surface,
          start: t.start,
          end: t.end,
          vocabTempId: t.vocabTempId,
          isContent: t.isContent,
        })),
      },
      furigana: spliced,
      furiganaFallback: false,
    });

    // Level eligibility depends only on CONTENT vocab: assignSentenceLevels
    // gates on whichever of these are LADDERED (level !== null) — a
    // sentence's level must be strictly greater than the max level among
    // its laddered content vocab, while off-ladder content vocab (seeded
    // but outside the ~5,400-item curriculum ladder) is simply skipped, not
    // treated as blocking (see SentenceLevelInput's doc comment in
    // level-heuristic.ts). Function words are excluded here entirely — they
    // still get a rendering edge above, but must never block or delay a
    // sentence's unlock/level.
    sentenceLevelInputs.push({ tempId: candidate.tempId, vocabTempIds: contentVocabTempIds });
  }

  // Per-level quota cap: if selection overshoots the target band, still seed
  // every selected sentence (the filter is a hard quality bar, not trimmed
  // to fit) — SENTENCE_TARGET_MAX is a reporting target, not a cap. Level
  // assignment's own per-level quota (SENTENCE_PER_LEVEL) is what keeps any
  // one level from being swamped; sentences beyond a level's quota simply
  // roll to the next eligible level or fall off the ladder's tail as null.
  const sentenceLevels = assignSentenceLevels(sentenceLevelInputs, levels);
  for (const subject of subjects) {
    if (subject.type !== "SENTENCE") continue;
    subject.level = sentenceLevels.get(subject.tempId) ?? null;
  }

  // ---------------------------------------------------------------------
  // GRAMMAR subjects, matched against the SENTENCE pool just built above.
  // See scripts/seed/lib/grammar-points.ts for the hand-authored point list
  // and scripts/seed/lib/sentence-transform.ts's matchGrammarExamples for
  // the pure selection logic (up to 5 examples, laddered-then-shorter
  // preferred). Every GRAMMAR -> SENTENCE edge is isGating: false — grammar
  // must not be locked behind knowing specific example sentences (see the
  // task write-up on the 1,781-unreachable-sentences bug this must avoid
  // repeating in the opposite direction).
  // ---------------------------------------------------------------------
  const grammarCandidates = subjects.filter((s) => s.type === "SENTENCE").map((s) => ({
    tempId: s.tempId,
    characters: s.characters!,
    isLaddered: s.level !== null,
  }));

  const grammarMatchCounts = new Map<string, number>();
  const grammarUsedSlugs = new Set<string>();
  const grammarLevelInputs: LevelInput[] = [];

  for (const point of GRAMMAR_POINTS) {
    const tempId = `grammar-${point.slug}`;
    // Raw match count (before the 5-example cap) drives the reporting below
    // ("how many sentences actually match", not "how many got attached") —
    // over-matching regexes should be visible even once capped at 5 edges.
    const rawMatchCount = grammarCandidates.filter((c) => point.matchPatterns.some((re) => re.test(c.characters))).length;
    const examples = matchGrammarExamples(point.matchPatterns, grammarCandidates);
    grammarMatchCounts.set(point.slug, rawMatchCount);

    subjects.push({
      tempId,
      type: "GRAMMAR",
      level: 0, // placeholder, overwritten below
      slug: dedupeSlug(`grammar-${point.slug}`, grammarUsedSlugs),
      characters: point.pattern,
      meanings: [{ meaning: point.titleEn, primary: true }],
      readings: [],
      jlpt: point.jlpt,
      jlptLegacy: null,
      frequency: null,
      metadata: {
        jlpt: point.jlpt,
        formation: point.formation,
        exampleCount: examples.length,
        relatedSlugs: point.relatedSlugs,
      },
      furigana: null,
      furiganaFallback: false,
    });

    for (const example of examples) {
      components.push({
        parentTempId: tempId,
        childTempId: example.tempId,
        position: null,
        isRadical: false,
        readingUsed: null,
        isGating: false,
      });
    }

    // Grammar has no strict structural dependency on vocab/kanji (deliberate
    // — see the task write-up), so it carries no dependsOn/strictDependsOn
    // edges; assignLevels places it purely by curriculumCompare order
    // (JLPT band, i.e. N5 first) within its own type's quota.
    grammarLevelInputs.push({
      tempId,
      type: "GRAMMAR",
      grade: null,
      frequency: null,
      jlpt: point.jlpt,
      isCommon: false,
      dependsOn: [],
    });
  }

  const grammarLevels = assignGrammarLevels(grammarLevelInputs);
  for (const subject of subjects) {
    if (subject.type !== "GRAMMAR") continue;
    subject.level = grammarLevels.get(subject.tempId) ?? null;
  }

  // ---------------------------------------------------------------------
  // Write artifacts
  // ---------------------------------------------------------------------
  writeJsonl("subjects.jsonl", subjects);
  writeJsonl("components.jsonl", components);
  writeJsonl("data-sources.jsonl", DATA_SOURCES);

  const kanaCount = subjects.filter((s) => s.type === "KANA").length;
  const radicalCount = subjects.filter((s) => s.type === "RADICAL").length;
  const kanjiCount = subjects.filter((s) => s.type === "KANJI").length;
  const vocabCount = subjects.filter((s) => s.type === "VOCAB").length;
  const sentenceCount = subjects.filter((s) => s.type === "SENTENCE").length;

  console.log("\n--- Transform summary ---");
  console.log(`Kana: ${kanaCount}`);
  console.log(`Radicals: ${radicalCount}`);
  console.log(`Kanji: ${kanjiCount}`);
  console.log(`Vocab: ${vocabCount} (target ${VOCAB_TARGET_MIN}-${VOCAB_TARGET_MAX})`);
  console.log(`Vocab candidates before cap: ${candidateVocab.length}`);
  console.log(
    `Furigana coverage: ${coverage.furiganaHits} hits / ${coverage.furiganaHits + coverage.furiganaMisses} total (${(
      (100 * coverage.furiganaHits) /
      Math.max(1, coverage.furiganaHits + coverage.furiganaMisses)
    ).toFixed(1)}%)`,
  );
  console.log(`Kanji with KanjiVG decomposition: ${coverage.kanjiWithKvg} / ${kanjiCount}`);
  console.log(`KRADFILE coverage gaps (components KanjiVG's direct children miss): ${coverage.kradfileCoverageGaps.length}`);
  if (coverage.kradfileCoverageGaps.length > 0) {
    console.log("Sample gaps:", coverage.kradfileCoverageGaps.slice(0, 10));
  }

  console.log("\n--- Level distribution ---");
  for (const type of ["RADICAL", "KANJI", "VOCAB", "SENTENCE", "GRAMMAR"] as const) {
    const laddered = subjects.filter((s) => s.type === type && s.level !== null);
    const unladdered = subjects.filter((s) => s.type === type && s.level === null);
    console.log(`${type}: ${laddered.length} laddered, ${unladdered.length} null`);
  }
  const byLevel = new Map<number, Record<string, number>>();
  for (const s of subjects) {
    if (s.level === null) continue;
    const row = byLevel.get(s.level) ?? { RADICAL: 0, KANJI: 0, VOCAB: 0, SENTENCE: 0, GRAMMAR: 0 };
    row[s.type] += 1;
    byLevel.set(s.level, row);
  }
  for (let level = 1; level <= 60; level += 1) {
    const row = byLevel.get(level) ?? { RADICAL: 0, KANJI: 0, VOCAB: 0, SENTENCE: 0, GRAMMAR: 0 };
    console.log(
      `  L${level}: radical=${row.RADICAL} kanji=${row.KANJI} vocab=${row.VOCAB} sentence=${row.SENTENCE} grammar=${row.GRAMMAR}`,
    );
  }

  // ----------------------------------------------------------- Sentences
  console.log("\n--- Sentence summary ---");
  console.log(`Sentences seeded: ${sentenceCount} (target ${SENTENCE_TARGET_MIN}-${SENTENCE_TARGET_MAX})`);
  console.log("Selection funnel:");
  console.log(`  Distinct sentences with an index line: ${sentenceFunnel.totalIndexed}`);
  console.log(`  ...flagged good-example (~): ${sentenceFunnel.goodExample}`);
  console.log(`  ...with an English translation: ${sentenceFunnel.hasTranslation}`);
  console.log(`  ...every CONTENT token located+resolved to seeded vocab: ${sentenceFunnel.allTokensResolved}`);
  console.log(`  Selected: ${sentenceFunnel.selected}`);

  console.log(
    `Selected sentences resolve 100% of their CONTENT tokens by construction (function-word tokens — particles, copula, auxiliaries, conjunctions, pronouns, counters, interjections — are excluded from this gate; see scripts/seed/lib/pos-classifier.ts): ${sentenceFunnel.allTokensResolved}/${sentenceFunnel.hasTranslation} good-example+translated sentences had every content token resolve.`,
  );

  const sentenceSubjects = subjects.filter((s) => s.type === "SENTENCE");
  const fullyResolvedCount = sentenceSubjects.filter((s) => !s.furiganaFallback).length;
  const fallbackCount = sentenceSubjects.filter((s) => s.furiganaFallback).length;
  console.log(
    `Furigana coverage: ${fullyResolvedCount} sentences fully resolved, ${fallbackCount} furiganaFallback=true`,
  );

  // ------------------------------------------------------------- Grammar
  console.log("\n--- Grammar summary ---");
  console.log(`Grammar points emitted: ${GRAMMAR_POINTS.length}`);
  const grammarByJlpt = new Map<number, number>();
  for (const point of GRAMMAR_POINTS) grammarByJlpt.set(point.jlpt, (grammarByJlpt.get(point.jlpt) ?? 0) + 1);
  console.log(
    `JLPT distribution: N5=${grammarByJlpt.get(5) ?? 0} N4=${grammarByJlpt.get(4) ?? 0} N3=${grammarByJlpt.get(3) ?? 0}`,
  );

  const fiveExamples = [...grammarMatchCounts.entries()].filter(([, n]) => n >= 5);
  const partialExamples = [...grammarMatchCounts.entries()].filter(([, n]) => n >= 1 && n <= 4);
  const zeroExamples = [...grammarMatchCounts.entries()].filter(([, n]) => n === 0);
  console.log(`Points with >=5 matching sentences (5 examples attached): ${fiveExamples.length}`);
  console.log(`Points with 1-4 matching sentences: ${partialExamples.length}`);
  console.log(`Points with 0 matching sentences: ${zeroExamples.length}`);
  if (zeroExamples.length > 0) {
    console.log("Zero-match points:", zeroExamples.map(([slug]) => slug).join(", "));
  }

  const topMatching = [...grammarMatchCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);
  console.log("Top 10 highest-matching points:");
  for (const [slug, count] of topMatching) {
    console.log(`  ${slug}: ${count}`);
  }

  // Strict invariant check: every SENTENCE's level must be strictly greater
  // than the max level of every CONTENT vocab it contains (function-word
  // vocab is excluded from gating entirely, per the content/function POS
  // split — see sentenceLevelInputs above).
  let invariantViolations = 0;
  for (const s of sentenceSubjects) {
    if (s.level === null) continue;
    const tokens = s.metadata.tokens as { vocabTempId: string; isContent: boolean }[];
    for (const t of tokens) {
      if (!t.isContent) continue;
      const vocabLevel = levels.get(t.vocabTempId);
      if (typeof vocabLevel === "number" && !(s.level > vocabLevel)) {
        invariantViolations += 1;
      }
    }
  }
  console.log(`Strict level invariant violations (sentence level > max CONTENT vocab level): ${invariantViolations}`);

  // Content-word distribution diagnostics, per the task's reporting
  // requirement: how many content words per candidate sentence, and how
  // many candidate (good-example + translated) sentences fail selection on
  // exactly N missing/unladdered content words.
  console.log("\n--- Content-word diagnostics ---");
  const contentCounts = sentenceCandidates.map(
    (c) => c.resolvedTokens.filter((t) => t.isContent).length,
  );
  if (contentCounts.length > 0) {
    const sorted = [...contentCounts].sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)];
    console.log(`Median content words per selected sentence: ${median}`);
  }
  console.log("Missing-content-word histogram (over all good-example+translated candidates with >=1 content word):");
  for (let n = 0; n <= 6; n += 1) {
    const label = n === 6 ? "6+" : String(n);
    console.log(`  ${label} missing: ${missingContentHistogram.get(n) ?? 0}`);
  }

  console.log("\n--- Sample sentence records ---");
  for (const s of sentenceSubjects.slice(0, 5)) {
    console.log(JSON.stringify(s, null, 2));
  }
}

function isKanjiChar(ch: string): boolean {
  const cp = ch.codePointAt(0)!;
  return (cp >= 0x4e00 && cp <= 0x9fff) || (cp >= 0x3400 && cp <= 0x4dbf);
}

function bestNfBucket(entry: JMdictEntry): number | null {
  const buckets = [
    ...entry.kanji.map((k) => nfBucket(k.priorities)),
    ...entry.readings.map((r) => nfBucket(r.priorities)),
  ].filter((b): b is number => b !== null);
  return buckets.length ? Math.min(...buckets) : null;
}

/// True if any kanji or reading form carries JMdict's spec1/spec2 priority
/// tag — see the sort comment above candidateVocab.sort for why this narrow
/// tag (not the full news1/ichi1/gai1 set) is boosted ahead of nf rank.
function hasSpecPriority(entry: JMdictEntry): boolean {
  return (
    entry.kanji.some((k) => k.priorities.includes("spec1") || k.priorities.includes("spec2")) ||
    entry.readings.some((r) => r.priorities.includes("spec1") || r.priorities.includes("spec2"))
  );
}

function capitalize(s: string): string {
  return s.length ? s[0].toUpperCase() + s.slice(1) : s;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
