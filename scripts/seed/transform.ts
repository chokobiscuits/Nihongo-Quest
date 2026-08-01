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
import { assignLevels, type LevelInput } from "./lib/level-heuristic";
import { baseSlug, dedupeSlug } from "./lib/slug";
import { DATA_SOURCES } from "./lib/data-sources";
import type { ComponentRecord, MeaningEntry, ReadingEntry, SubjectRecord } from "./lib/types";

const RAW_DIR = path.resolve(__dirname, "../../data/raw");
const OUT_DIR = path.resolve(__dirname, "../../data/processed");

// Vocab scope control: only common entries whose every kanji character is in
// the seeded kanji set, per the task's scope directive. This keeps the
// seeded vocab in the low thousands rather than JMdict's full ~200k.
const VOCAB_TARGET_MIN = 6000;
const VOCAB_TARGET_MAX = 10000;

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
  const kanjiAliveCsv = readFileSync(path.join(RAW_DIR, "kanjialive-radicals.csv"), "utf-8");
  const kanjiAliveRadicals = parseKanjiAliveRadicals(kanjiAliveCsv);
  const kanjiAliveByChar = new Map(kanjiAliveRadicals.map((r) => [r.radical, r]));

  // ---------------------------------------------------------------------
  // Build RADICAL subjects from KanjiVG's component inventory: every
  // distinct component character KanjiVG uses as a direct child of some
  // kanji becomes a candidate radical, left-joined against Kanji Alive for
  // English names.
  // ---------------------------------------------------------------------
  const radicalChars = new Set<string>();
  for (const kvg of kanjivgByLiteral.values()) {
    for (const c of kvg.components) radicalChars.add(c.element);
  }

  const subjects: SubjectRecord[] = [];
  const components: ComponentRecord[] = [];
  const usedSlugs = new Set<string>();
  const levelInputs: LevelInput[] = [];

  const radicalTempIdByChar = new Map<string, string>();
  for (const char of radicalChars) {
    const tempId = `radical-${char}`;
    radicalTempIdByChar.set(char, tempId);
    const aliveMatch = kanjiAliveByChar.get(char);
    const meanings: MeaningEntry[] = aliveMatch
      ? [{ meaning: capitalize(aliveMatch.meaning.split(",")[0].trim()), primary: true }]
      : [{ meaning: char, primary: true }]; // fallback: no authored name yet, literal as placeholder
    const readings: ReadingEntry[] = aliveMatch && aliveMatch.readingRomaji
      ? [{ reading: aliveMatch.readingRomaji, primary: true, type: "romaji" }]
      : [];

    subjects.push({
      tempId,
      type: "RADICAL",
      level: 0, // placeholder, overwritten by assignLevels below
      slug: dedupeSlug(baseSlug("radical", char), usedSlugs),
      characters: char,
      meanings,
      readings,
      jlpt: null,
      jlptLegacy: null,
      frequency: null,
      metadata: { source: "kanjivg+kanjialive", hasKanjiAliveMatch: Boolean(aliveMatch) },
      furigana: null,
      furiganaFallback: false,
    });

    levelInputs.push({
      tempId,
      type: "RADICAL",
      grade: null,
      frequency: null,
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

    // KRADFILE cross-check: report kanji where KRADFILE lists components
    // KanjiVG's direct-child decomposition did not surface (coverage gap,
    // not auto-fixed — KanjiVG remains the SubjectComponent source of truth
    // per the task's mapping spec).
    const kradComponents = kradByKanji.get(kanji.literal) ?? [];
    const kvgComponentChars = new Set((kvg?.components ?? []).map((c) => c.element));
    const missingFromKvg = kradComponents.filter((c) => !kvgComponentChars.has(c) && c !== kanji.literal);
    if (missingFromKvg.length > 0) {
      coverage.kradfileCoverageGaps.push(`${kanji.literal}: KRADFILE has ${missingFromKvg.join("")} not in KanjiVG`);
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

    const dependsOn: string[] = [];
    if (kvg) {
      for (const comp of kvg.components) {
        const compTempId = radicalTempIdByChar.get(comp.element);
        if (!compTempId) continue;
        dependsOn.push(compTempId);
        components.push({
          parentTempId: tempId,
          childTempId: compTempId,
          position: comp.position,
          isRadical: comp.isRadical,
          readingUsed: null,
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

  function entryKanjiAllSeeded(entry: JMdictEntry): boolean {
    if (entry.kanji.length === 0) return true; // kana-only vocab has no kanji dependency
    // Every kanji form must consist entirely of seeded kanji characters
    // (non-kanji characters in a form, e.g. okurigana kana, are ignored).
    return entry.kanji.every((k) =>
      [...k.text].every((ch) => !isKanjiChar(ch) || seededKanjiChars.has(ch)),
    );
  }

  const candidateVocab = jmdictEntries.filter((e) => entryIsCommon(e) && entryKanjiAllSeeded(e));

  // If the common+in-vocabulary-set filter overshoots the target band, trim
  // by nfXX rank (lower nfXX = more frequent) then by entry order, keeping
  // the most common entries first; entries without an nfXX bucket sort last
  // but still ahead of being dropped, since isCommonPriority already
  // guarantees some priority signal exists.
  candidateVocab.sort((a, b) => {
    const rankA = bestNfBucket(a);
    const rankB = bestNfBucket(b);
    return (rankA ?? 999) - (rankB ?? 999);
  });
  const selectedVocab =
    candidateVocab.length > VOCAB_TARGET_MAX ? candidateVocab.slice(0, VOCAB_TARGET_MAX) : candidateVocab;

  for (const entry of selectedVocab) {
    const primaryKanji = entry.kanji[0]?.text ?? null;
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
    const primaryPair = pairs.find((p) => p.text === characters) ?? pairs[0];
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
    });
  }

  // ---------------------------------------------------------------------
  // Level assignment
  // ---------------------------------------------------------------------
  const levels = assignLevels(levelInputs);
  for (const subject of subjects) {
    subject.level = levels.get(subject.tempId) ?? null;
  }

  // ---------------------------------------------------------------------
  // Write artifacts
  // ---------------------------------------------------------------------
  writeJsonl("subjects.jsonl", subjects);
  writeJsonl("components.jsonl", components);
  writeJsonl("data-sources.jsonl", DATA_SOURCES);

  const radicalCount = subjects.filter((s) => s.type === "RADICAL").length;
  const kanjiCount = subjects.filter((s) => s.type === "KANJI").length;
  const vocabCount = subjects.filter((s) => s.type === "VOCAB").length;

  console.log("\n--- Transform summary ---");
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
  for (const type of ["RADICAL", "KANJI", "VOCAB"] as const) {
    const laddered = subjects.filter((s) => s.type === type && s.level !== null);
    const unladdered = subjects.filter((s) => s.type === type && s.level === null);
    console.log(`${type}: ${laddered.length} laddered, ${unladdered.length} null`);
  }
  const byLevel = new Map<number, Record<string, number>>();
  for (const s of subjects) {
    if (s.level === null) continue;
    const row = byLevel.get(s.level) ?? { RADICAL: 0, KANJI: 0, VOCAB: 0 };
    row[s.type] += 1;
    byLevel.set(s.level, row);
  }
  for (let level = 1; level <= 60; level += 1) {
    const row = byLevel.get(level) ?? { RADICAL: 0, KANJI: 0, VOCAB: 0 };
    console.log(`  L${level}: radical=${row.RADICAL} kanji=${row.KANJI} vocab=${row.VOCAB}`);
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

function capitalize(s: string): string {
  return s.length ? s[0].toUpperCase() + s.slice(1) : s;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
