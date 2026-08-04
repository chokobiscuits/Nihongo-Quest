import { prisma } from "@/lib/db";
import { SubjectType } from "@/generated/prisma/enums";
import { isSubjectUnlocked, type SubjectWithComponents } from "@/services/srs/unlock";
import { isKanaResolvedFor } from "@/services/srs/kana-gate";
import { isTypeUnlocked } from "@/services/srs/typeUnlock";
import { getCurriculumLevels, getGuruCounts, getTypeUnlockStatuses } from "@/server/queries/curriculum";
import type { LessonComponentSummary, LessonSubjectMeaning, LessonSubjectReading } from "@/server/queries/lessons";
import { sentenceWordBreakdown, tatoebaSentenceIdOf, grammarExamples, type GrammarExample } from "@/server/queries/sentenceWordBreakdown";

import { APP_USER_ID } from "@/lib/appUser";

// Ladder types have a curriculum level and are gated by unlock rules.
// Reading has no seeded rows yet (see dashboard.ts); Sentence and Grammar
// are seeded and laddered (seed phases 1-3 and grammar phase 1-2).
const LADDER_TYPES: SubjectType[] = [SubjectType.KANA, SubjectType.RADICAL, SubjectType.KANJI, SubjectType.VOCAB, SubjectType.SENTENCE, SubjectType.GRAMMAR];

export type SubjectListState = "burned" | "learning" | "not-started" | "locked";

export interface SubjectListItem {
  id: string;
  type: SubjectType;
  level: number | null;
  slug: string;
  characters: string | null;
  meaning: string | null;
  jlpt: number | null;
  state: SubjectListState;
  srsStage: number | null;
  /// Populated only for locked items — the components (radicals/kanji) that
  /// still need to reach Guru before this subject unlocks.
  lockedOn: { slug: string; characters: string | null; meaning: string | null }[];
}

export interface SubjectLevelGroup {
  level: number | null;
  items: SubjectListItem[];
}

export interface SubjectTypeSummary {
  type: SubjectType;
  seeded: boolean;
  /// Reached Guru+ (srsStage >= 5) — matches the dashboard's "learned" count.
  learned: number;
  total: number;
  /// Whether this type is open for lessons at all (type-unlock gate, see
  /// typeUnlock.ts). KANA and RADICAL are always true. Undefined behavior
  /// is never surfaced here — every seeded type gets a real value.
  unlocked: boolean;
  /// Human-readable unlock requirement (e.g. "Guru 10 radicals"), null for
  /// types with no Guru-count prerequisite (KANA, RADICAL) or once unlocked.
  requirement: string | null;
  have: number;
  need: number;
}

/// Overview counts for all six SubjectTypes, for the `/subjects` index.
/// Reading has no Subject rows, so it reports 0/0 with `seeded: false` — the
/// page renders that as a "Coming soon" placeholder.
export async function getSubjectTypeSummaries(userId: string = APP_USER_ID): Promise<SubjectTypeSummary[]> {
  const seededTypes: SubjectType[] = [SubjectType.KANA, SubjectType.RADICAL, SubjectType.KANJI, SubjectType.VOCAB, SubjectType.SENTENCE, SubjectType.GRAMMAR];

  const [totals, passedCounts, unlockStatuses] = await Promise.all([
    // level: not null — the laddered curriculum denominator, not the whole
    // seeded set (sentences in particular have thousands of off-ladder rows
    // sourced from Tatoeba that are never reachable as lessons/reviews).
    prisma.subject.groupBy({
      by: ["type"],
      where: { type: { in: seededTypes }, level: { not: null } },
      _count: true,
    }),
    prisma.userSubject.groupBy({
      by: ["subjectId"],
      where: { userId, passedAt: { not: null } },
      _count: true,
    }),
    getTypeUnlockStatuses(userId),
  ]);

  const passedSubjectIds = passedCounts.map((r) => r.subjectId);
  const passedByType = await bucketByType(passedSubjectIds);
  const totalByType = new Map<SubjectType, number>();
  for (const row of totals) totalByType.set(row.type, row._count);

  const allTypes = Object.values(SubjectType);
  return allTypes.map((type) => {
    const seeded = seededTypes.includes(type);
    const gated = type === SubjectType.KANJI || type === SubjectType.VOCAB || type === SubjectType.SENTENCE || type === SubjectType.GRAMMAR || type === SubjectType.READING;
    const status = gated ? unlockStatuses[type as "KANJI" | "VOCAB" | "SENTENCE" | "GRAMMAR" | "READING"] : null;
    return {
      type,
      seeded,
      learned: seeded ? (passedByType[type as unknown as "KANA" | "RADICAL" | "KANJI" | "VOCAB" | "SENTENCE" | "GRAMMAR"] ?? 0) : 0,
      total: seeded ? (totalByType.get(type) ?? 0) : 0,
      unlocked: status ? status.unlocked : true,
      requirement: status && !status.unlocked ? status.requirement : null,
      have: status?.have ?? 0,
      need: status?.need ?? 0,
    };
  });
}

async function bucketByType(subjectIds: string[]) {
  const result: Record<"KANA" | "RADICAL" | "KANJI" | "VOCAB" | "SENTENCE" | "GRAMMAR", number> = {
    KANA: 0,
    RADICAL: 0,
    KANJI: 0,
    VOCAB: 0,
    SENTENCE: 0,
    GRAMMAR: 0,
  };
  if (subjectIds.length === 0) return result;

  const rows = await prisma.subject.findMany({
    where: { id: { in: subjectIds } },
    select: { type: true },
  });
  for (const row of rows) {
    if (row.type === SubjectType.KANA) result.KANA += 1;
    else if (row.type === SubjectType.RADICAL) result.RADICAL += 1;
    else if (row.type === SubjectType.KANJI) result.KANJI += 1;
    else if (row.type === SubjectType.VOCAB) result.VOCAB += 1;
    else if (row.type === SubjectType.SENTENCE) result.SENTENCE += 1;
    else if (row.type === SubjectType.GRAMMAR) result.GRAMMAR += 1;
  }
  return result;
}

export interface BrowseFilters {
  /// Filter by user state; "all" (default) applies no filter.
  state?: "all" | "learning" | "not-started" | "locked" | "burned";
  jlpt?: number;
  /// Matches characters, readings, and meanings (case-insensitive substring).
  search?: string;
}

export interface BrowseListResult {
  groups: SubjectLevelGroup[];
  /// Curriculum levels present in this type's ladder, for the collapsible
  /// group index — 1..60 for laddered content, empty for off-ladder-only.
  levels: number[];
  hasAdditional: boolean;
  userLevel: number;
}

/// Fetches one curriculum level's (or the "Additional"/off-ladder group's)
/// subjects, with the user's SRS state resolved per item. Kept level-scoped
/// so the browse page never loads more than ~1-2k rows in memory for a page
/// (kanji has 10k+ rows total; vocab has 10k+).
///
/// Pass `level: null` for the off-ladder "Additional" group.
export async function getSubjectsForLevel(
  type: SubjectType,
  level: number | null,
  filters: BrowseFilters = {},
  userId: string = APP_USER_ID,
): Promise<SubjectListItem[]> {
  const [curriculumLevels, guruCounts, kanaResolved] = await Promise.all([
    getCurriculumLevels(userId),
    getGuruCounts(userId),
    type === SubjectType.RADICAL ? isKanaResolvedFor(userId) : Promise.resolve(true),
  ]);
  const typeLevel = curriculumLevels[type];
  const typeGateOpen = isTypeUnlocked(type, guruCounts);

  const where: Record<string, unknown> = { type, level };
  if (filters.jlpt !== undefined) where.jlpt = filters.jlpt;
  const q = filters.search?.trim();
  if (q) {
    // `meanings`/`readings` are JSON arrays of { meaning|reading, primary }
    // objects — Prisma's JSON filters can't substring-match inside array
    // elements, so those two legs go through a raw `::text` cast search
    // instead. Combined with the id set from the plain-column legs below.
    const jsonMatches = await prisma.$queryRaw<{ id: string }[]>`
      SELECT id FROM "Subject"
      WHERE type = ${type}::"SubjectType"
        AND level IS NOT DISTINCT FROM ${level}
        AND (meanings::text ILIKE ${"%" + q + "%"} OR readings::text ILIKE ${"%" + q + "%"})
    `;
    where.OR = [
      { characters: { contains: q, mode: "insensitive" } },
      { slug: { contains: q, mode: "insensitive" } },
      { id: { in: jsonMatches.map((r) => r.id) } },
    ];
  }

  const subjects = await prisma.subject.findMany({
    where,
    orderBy: [{ frequency: "asc" }, { slug: "asc" }],
    select: {
      id: true,
      type: true,
      level: true,
      slug: true,
      characters: true,
      meanings: true,
      jlpt: true,
      parentLinks: {
        select: {
          isGating: true,
          child: { select: { id: true, slug: true, characters: true, meanings: true } },
        },
      },
    },
  });

  if (subjects.length === 0) return [];

  const subjectIds = subjects.map((s) => s.id);
  const componentChildIds = Array.from(
    new Set(subjects.flatMap((s) => s.parentLinks.map((l) => l.child.id))),
  );

  const [userSubjects, componentStages] = await Promise.all([
    prisma.userSubject.findMany({
      where: { userId, subjectId: { in: subjectIds } },
      select: { subjectId: true, srsStage: true },
    }),
    fetchComponentStages(userId, componentChildIds),
  ]);

  const stageBySubject = new Map<string, number>();
  for (const row of userSubjects) stageBySubject.set(row.subjectId, row.srsStage);

  const items: SubjectListItem[] = subjects.map((s) => {
    const srsStage = stageBySubject.get(s.id) ?? null;
    let state: SubjectListState;
    let lockedOn: SubjectListItem["lockedOn"] = [];

    if (srsStage !== null && srsStage >= 9) {
      state = "burned";
    } else if (srsStage !== null && srsStage >= 1) {
      state = "learning";
    } else if (type === SubjectType.KANA) {
      // Kana unlocks purely on its own curriculum level, same as radicals
      // below (minus the kana gate, which obviously doesn't apply to kana
      // itself).
      state = (s.level ?? 0) <= typeLevel ? "not-started" : "locked";
    } else if (type === SubjectType.RADICAL) {
      // Radicals unlock on their own curriculum level, gated additionally
      // by kanaResolved (every kana passed or skipped) — see
      // src/services/srs/unlock.ts.
      state = (s.level ?? 0) <= typeLevel && kanaResolved ? "not-started" : "locked";
    } else {
      const subjectForUnlock: SubjectWithComponents = {
        id: s.id,
        type: s.type,
        level: s.level ?? 0,
        components: s.parentLinks.map((l) => ({
          childId: l.child.id,
          srsStage: componentStages.get(l.child.id) ?? null,
          isGating: l.isGating,
        })),
      };
      // Not-started requires both the per-item component/level gate AND the
      // type-unlock gate (Guru counts on the prerequisite type) — either one
      // failing means "locked" from this list's point of view.
      const unlocked = typeGateOpen && isSubjectUnlocked(subjectForUnlock, typeLevel);
      state = unlocked ? "not-started" : "locked";
      if (!unlocked) {
        lockedOn = s.parentLinks
          .filter((l) => l.isGating && (componentStages.get(l.child.id) ?? 0) < 5)
          .map((l) => ({
            slug: l.child.slug,
            characters: l.child.characters,
            meaning: firstMeaning(l.child.meanings),
          }));
      }
    }

    return {
      id: s.id,
      type: s.type,
      level: s.level,
      slug: s.slug,
      characters: s.characters,
      meaning: firstMeaning(s.meanings),
      jlpt: s.jlpt,
      state,
      srsStage,
      lockedOn,
    };
  });

  if (filters.state && filters.state !== "all") {
    return items.filter((i) => i.state === filters.state);
  }
  return items;
}

/// The distinct curriculum levels seeded for `type` (1-60 subset), plus
/// whether any off-ladder ("Additional", level = null) rows exist. Cheap:
/// GROUP BY level only, no row payload.
export async function getSubjectLevelIndex(
  type: SubjectType,
): Promise<{
  levels: number[];
  hasAdditional: boolean;
  /// Per-level totals, keyed by level (and "additional" for level = null).
  /// The browse list renders collapsed groups as header-only rows, so it
  /// needs the count without fetching any of the rows.
  counts: Record<string, number>;
}> {
  const rows = await prisma.subject.groupBy({
    by: ["level"],
    where: { type },
    _count: true,
  });

  const levels = rows
    .map((r) => r.level)
    .filter((l): l is number => l !== null)
    .sort((a, b) => a - b);
  const hasAdditional = rows.some((r) => r.level === null);

  const counts: Record<string, number> = {};
  for (const r of rows) {
    counts[r.level === null ? "additional" : String(r.level)] = r._count;
  }

  return { levels, hasAdditional, counts };
}

/// Distinct JLPT levels seeded for `type`, for the filter dropdown. Cheap:
/// GROUP BY only.
export async function getJlptOptions(type: SubjectType): Promise<number[]> {
  const rows = await prisma.subject.groupBy({
    by: ["jlpt"],
    where: { type, jlpt: { not: null } },
    _count: true,
  });
  return rows
    .map((r) => r.jlpt)
    .filter((n): n is number => n !== null)
    .sort((a, b) => a - b);
}

async function fetchComponentStages(userId: string, childIds: string[]): Promise<Map<string, number | null>> {
  if (childIds.length === 0) return new Map();

  const rows = await prisma.userSubject.findMany({
    where: { userId, subjectId: { in: childIds } },
    select: { subjectId: true, srsStage: true },
  });

  const map = new Map<string, number | null>();
  for (const id of childIds) map.set(id, null);
  for (const row of rows) map.set(row.subjectId, row.srsStage);
  return map;
}

function firstMeaning(meanings: unknown): string | null {
  const list = meanings as LessonSubjectMeaning[] | null | undefined;
  if (!list || list.length === 0) return null;
  return (list.find((m) => m.primary) ?? list[0]).meaning;
}

// ---------------------------------------------------------------- Detail page

export interface SubjectDetail {
  id: string;
  type: SubjectType;
  level: number | null;
  slug: string;
  characters: string | null;
  meanings: LessonSubjectMeaning[];
  readings: LessonSubjectReading[];
  meaningMnemonic: string | null;
  readingMnemonic: string | null;
  meaningHint: string | null;
  readingHint: string | null;
  acceptedMeanings: string[];
  authored: boolean;
  jlpt: number | null;
  frequency: number | null;
  furigana: { ruby: string; rt?: string }[] | null;
  furiganaFallback: boolean;
  partsOfSpeech: string[];
  componentsOf: LessonComponentSummary[];
  usedIn: LessonComponentSummary[];
  usedInTotal: number;
  /// SENTENCE only: the source Tatoeba sentence id, for attribution linking
  /// to https://tatoeba.org/en/sentences/show/<id>.
  tatoebaSentenceId: string | null;
  /// GRAMMAR only: the "N/Na + です"-style formation note from metadata —
  /// the most useful field to show while a point still has no authored
  /// explanation.
  formation: string | null;
  /// GRAMMAR only: up to 5 attached example sentences (isGating: false),
  /// each with furigana and an English gloss. Empty for the 13 points that
  /// matched zero Tatoeba sentences.
  grammarExamples: GrammarExample[];
  /// Null when the user has no UserSubject row for this item yet (unlocked
  /// but not started, or still locked).
  srs: {
    stage: number;
    dueAt: Date | null;
    passedAt: Date | null;
    burnedAt: Date | null;
    meaningCorrect: number;
    meaningIncorrect: number;
    readingCorrect: number;
    readingIncorrect: number;
    masteryLevel: number;
    masteryXp: number;
  } | null;
}

/// Full detail for one subject by slug, including the user's SRS state.
/// Mirrors `getLessonBatch`'s component-split shape so the detail page can
/// reuse the same presentation as the teach card.
export async function getSubjectDetail(
  slug: string,
  userId: string = APP_USER_ID,
): Promise<SubjectDetail | null> {
  const subject = await prisma.subject.findUnique({
    where: { slug },
    select: {
      id: true,
      type: true,
      level: true,
      slug: true,
      characters: true,
      meanings: true,
      readings: true,
      meaningMnemonic: true,
      readingMnemonic: true,
      meaningHint: true,
      readingHint: true,
      acceptedMeanings: true,
      authored: true,
      jlpt: true,
      frequency: true,
      furigana: true,
      furiganaFallback: true,
      metadata: true,
      parentLinks: {
        select: {
          readingUsed: true,
          isGating: true,
          child: {
            select: {
              id: true,
              slug: true,
              characters: true,
              meanings: true,
              readings: true,
              type: true,
              furigana: true,
              furiganaFallback: true,
            },
          },
        },
      },
      childLinks: {
        select: {
          readingUsed: true,
          parent: {
            select: {
              id: true,
              slug: true,
              characters: true,
              meanings: true,
              type: true,
              frequency: true,
              metadata: true,
            },
          },
        },
      },
    },
  });

  if (!subject) return null;

  const userSubject = await prisma.userSubject.findUnique({
    where: { userId_subjectId: { userId, subjectId: subject.id } },
    select: {
      srsStage: true,
      dueAt: true,
      passedAt: true,
      burnedAt: true,
      meaningCorrect: true,
      meaningIncorrect: true,
      readingCorrect: true,
      readingIncorrect: true,
      masteryLevel: true,
      masteryXp: true,
    },
  });

  return {
    id: subject.id,
    type: subject.type,
    level: subject.level,
    slug: subject.slug,
    characters: subject.characters,
    meanings: subject.meanings as unknown as LessonSubjectMeaning[],
    readings: subject.readings as unknown as LessonSubjectReading[],
    meaningMnemonic: subject.meaningMnemonic,
    readingMnemonic: subject.readingMnemonic,
    meaningHint: subject.meaningHint,
    readingHint: subject.readingHint,
    acceptedMeanings: subject.acceptedMeanings as string[],
    authored: subject.authored,
    jlpt: subject.jlpt,
    frequency: subject.frequency,
    furigana: subject.furigana as { ruby: string; rt?: string }[] | null,
    furiganaFallback: subject.furiganaFallback,
    partsOfSpeech: subject.type === SubjectType.VOCAB ? partsOfSpeechOf(subject.metadata) : [],
    componentsOf:
      subject.type === SubjectType.SENTENCE
        ? sentenceWordBreakdown(subject.metadata, subject.parentLinks)
        : subject.type === SubjectType.GRAMMAR
          ? []
          : subject.parentLinks.map((link) => ({
              id: link.child.id,
              type: link.child.type as LessonComponentSummary["type"],
              slug: link.child.slug,
              characters: link.child.characters,
              meaning: firstMeaning(link.child.meanings),
              readingUsed: link.readingUsed,
            })),
    usedIn: rankUsedIn(subject.type, subject.childLinks).slice(0, 20),
    usedInTotal: subject.childLinks.length,
    tatoebaSentenceId: subject.type === SubjectType.SENTENCE ? tatoebaSentenceIdOf(subject.metadata) : null,
    formation: subject.type === SubjectType.GRAMMAR ? formationOf(subject.metadata) : null,
    grammarExamples: subject.type === SubjectType.GRAMMAR ? grammarExamples(subject.parentLinks) : [],
    srs: userSubject
      ? {
          stage: userSubject.srsStage,
          dueAt: userSubject.dueAt,
          passedAt: userSubject.passedAt,
          burnedAt: userSubject.burnedAt,
          meaningCorrect: userSubject.meaningCorrect,
          meaningIncorrect: userSubject.meaningIncorrect,
          readingCorrect: userSubject.readingCorrect,
          readingIncorrect: userSubject.readingIncorrect,
          masteryLevel: userSubject.masteryLevel,
          masteryXp: userSubject.masteryXp,
        }
      : null,
  };
}

function partsOfSpeechOf(metadata: unknown): string[] {
  const meta = metadata as { pos?: string[] } | null | undefined;
  return meta?.pos ?? [];
}

function formationOf(metadata: unknown): string | null {
  const meta = metadata as { formation?: string } | null | undefined;
  return meta?.formation ?? null;
}

function vocabIsCommon(metadata: unknown): boolean {
  const meta = metadata as { isCommon?: boolean } | null | undefined;
  return Boolean(meta?.isCommon);
}


/// Same ordering rule as `getLessonBatch`'s `rankUsedIn`: radicals -> kanji
/// by frequency, kanji -> common/low-frequency vocab first.
function rankUsedIn(
  subjectType: SubjectType,
  childLinks: {
    readingUsed: string | null;
    parent: {
      id: string;
      slug: string;
      characters: string | null;
      meanings: unknown;
      type: SubjectType;
      frequency: number | null;
      metadata: unknown;
    };
  }[],
): LessonComponentSummary[] {
  const summaries = childLinks.map((link) => ({
    id: link.parent.id,
    type: link.parent.type as LessonComponentSummary["type"],
    slug: link.parent.slug,
    characters: link.parent.characters,
    meaning: firstMeaning(link.parent.meanings),
    readingUsed: link.readingUsed,
    isCommon: vocabIsCommon(link.parent.metadata),
    frequency: link.parent.frequency,
  }));

  if (subjectType !== SubjectType.KANJI) {
    return [...summaries]
      .sort((a, b) => (a.frequency ?? Infinity) - (b.frequency ?? Infinity))
      .map(({ id, type, slug, characters, meaning, readingUsed }) => ({ id, type, slug, characters, meaning, readingUsed }));
  }

  return [...summaries]
    .sort((a, b) => {
      if (a.isCommon !== b.isCommon) return a.isCommon ? -1 : 1;
      return (a.frequency ?? Infinity) - (b.frequency ?? Infinity);
    })
    .map(({ id, type, slug, characters, meaning, readingUsed }) => ({ id, type, slug, characters, meaning, readingUsed }));
}

// ------------------------------------------------------------- Kana browse

export interface KanaRowGroup {
  /// Gojuon row key (Subject.metadata.row) — see scripts/seed/lib/kana.ts.
  row: string;
  items: SubjectListItem[];
}

export interface KanaScriptGroup {
  script: "hiragana" | "katakana";
  rows: KanaRowGroup[];
}

/// Row display order within a script — plain gojuon rows first (a/ka/sa/...
/// through n), then voiced (dakuten/handakuten) rows, then youon rows. Any
/// row not listed here (shouldn't happen with the fixed kana set) sorts last
/// alphabetically as a safety net rather than being dropped.
const ROW_ORDER = [
  "a", "ka", "sa", "ta", "na", "ha", "ma", "ya", "ra", "wa", "n",
  "ga", "za", "da", "ba", "pa",
  "kya", "sha", "cha", "nya", "hya", "mya", "rya", "gya", "ja", "bya", "pya",
];

/// All KANA subjects with the user's SRS state, grouped by script (hiragana
/// before katakana) then by gojuon row in ROW_ORDER — the task's "grouped by
/// script and row rather than an opaque level number" browse requirement.
/// Kana unlocks purely on level and has no components, so this reuses the
/// same locked/burned/learning/not-started state derivation as
/// getSubjectsForLevel's KANA branch, just without the level-group
/// structure.
export async function getKanaBrowseGroups(userId: string = APP_USER_ID): Promise<KanaScriptGroup[]> {
  const curriculumLevels = await getCurriculumLevels(userId);
  const kanaLevel = curriculumLevels[SubjectType.KANA];

  const subjects = await prisma.subject.findMany({
    where: { type: SubjectType.KANA },
    select: { id: true, type: true, level: true, slug: true, characters: true, meanings: true, jlpt: true, metadata: true },
  });

  const userSubjects = await prisma.userSubject.findMany({
    where: { userId, subjectId: { in: subjects.map((s) => s.id) } },
    select: { subjectId: true, srsStage: true },
  });
  const stageBySubject = new Map(userSubjects.map((r) => [r.subjectId, r.srsStage]));

  const items: (SubjectListItem & { script: string; row: string })[] = subjects.map((s) => {
    const meta = s.metadata as { script?: string; row?: string };
    const srsStage = stageBySubject.get(s.id) ?? null;
    let state: SubjectListState;
    if (srsStage !== null && srsStage >= 9) state = "burned";
    else if (srsStage !== null && srsStage >= 1) state = "learning";
    else state = (s.level ?? 0) <= kanaLevel ? "not-started" : "locked";

    return {
      id: s.id,
      type: s.type,
      level: s.level,
      slug: s.slug,
      characters: s.characters,
      meaning: firstMeaning(s.meanings),
      jlpt: s.jlpt,
      state,
      srsStage,
      lockedOn: [],
      script: meta.script ?? "hiragana",
      row: meta.row ?? "a",
    };
  });

  const scripts: KanaScriptGroup["script"][] = ["hiragana", "katakana"];
  return scripts.map((script) => {
    const scriptItems = items.filter((i) => i.script === script);
    const rowsPresent = [...new Set(scriptItems.map((i) => i.row))];
    rowsPresent.sort((a, b) => {
      const ai = ROW_ORDER.indexOf(a);
      const bi = ROW_ORDER.indexOf(b);
      if (ai === -1 && bi === -1) return a.localeCompare(b);
      if (ai === -1) return 1;
      if (bi === -1) return -1;
      return ai - bi;
    });
    return {
      script,
      rows: rowsPresent.map((row) => ({
        row,
        items: scriptItems.filter((i) => i.row === row),
      })),
    };
  });
}

export { LADDER_TYPES };
