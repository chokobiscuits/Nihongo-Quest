import { prisma } from "@/lib/db";
import { SubjectType } from "@/generated/prisma/enums";
import { isSubjectUnlocked, type SubjectWithComponents } from "@/services/srs/unlock";
import { isKanaResolvedFor } from "@/services/srs/kana-gate";
import { isTypeUnlocked } from "@/services/srs/typeUnlock";
import { selectLessonBatch, type LessonCandidate, type LessonSubjectType } from "@/services/lessons/batch";
import { getOrCreateProfile } from "@/server/queries/profile";
import { getCurriculumLevels, getGuruCounts } from "@/server/queries/curriculum";
import { sentenceWordBreakdown, tatoebaSentenceIdOf, grammarExamples, type GrammarExample } from "@/server/queries/sentenceWordBreakdown";
import { getNextRequiredTutorial, type TutorialDetail } from "@/server/queries/tutorials";

// Lessons only ever schedule the 60-level curriculum ladder (level != null).
// Off-ladder subjects (jlpt/frequency reference material, and the ~5,900
// off-ladder sentences) are seeded but never surface as lessons.
const LADDER_TYPES: SubjectType[] = [SubjectType.KANA, SubjectType.RADICAL, SubjectType.KANJI, SubjectType.VOCAB, SubjectType.SENTENCE, SubjectType.GRAMMAR];

export interface LessonSubjectMeaning {
  meaning: string;
  primary: boolean;
}

export interface LessonSubjectReading {
  reading: string;
  primary: boolean;
  type?: string;
}

export interface LessonComponentSummary {
  id: string;
  type: LessonSubjectType;
  slug: string;
  characters: string | null;
  meaning: string | null;
  readingUsed: string | null;
  /// SENTENCE word breakdown only: whether this component edge gates the
  /// sentence's unlock (content word, laddered) vs. is shown for context
  /// only (function word, or off-ladder content word). Undefined for
  /// radical/kanji/vocab component edges, which are always gating.
  isGating?: boolean;
  /// SENTENCE word breakdown only: the word's surface form as it appears in
  /// the sentence (may be inflected, e.g. "出た" for the dictionary form
  /// "出る"), sourced from `Subject.metadata.tokens[].surface`.
  surface?: string;
}

export interface LessonSubject {
  id: string;
  type: LessonSubjectType;
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
  frequency: number | null;
  /// GRAMMAR only (also present on other seeded types): the JLPT N-level,
  /// shown alongside the pattern header.
  jlpt: number | null;
  furigana: { ruby: string; rt?: string }[] | null;
  furiganaFallback: boolean;
  /// The child subjects this subject is built from: a KANJI's radicals, or
  /// a VOCAB's kanji (with the reading used, when known). Empty for radicals.
  componentsOf: LessonComponentSummary[];
  /// The parent subjects this subject appears in: a RADICAL's kanji, or a
  /// KANJI's example vocab (capped, preferring common/low-frequency-rank
  /// entries). Empty for vocab.
  usedIn: LessonComponentSummary[];
  /// True count of parent subjects before capping (e.g. a radical may
  /// appear in hundreds of kanji even though `usedIn` is capped).
  usedInTotal: number;
  /// VOCAB only: parts of speech from `Subject.metadata.pos`.
  partsOfSpeech: string[];
  /// SENTENCE only: the source Tatoeba sentence id, for attribution.
  tatoebaSentenceId: string | null;
  /// GRAMMAR only: the "N/Na + です"-style formation note from metadata.
  formation: string | null;
  /// GRAMMAR only: up to 5 attached example sentences with furigana + gloss.
  /// Empty for the points that matched zero Tatoeba sentences.
  grammarExamples: GrammarExample[];
}

/// Candidate subject shape pulled for the unlock check: every ladder subject
/// at or below the user's level that has no UserSubject row yet, or has one
/// that has never been started (still a lesson, not a review item).
async function fetchUnstartedLadderSubjects(userId: string, curriculumLevels: Record<SubjectType, number>) {
  // Per-type level ceiling: a KANJI candidate must be at or below
  // curriculumLevels.KANJI, a VOCAB candidate at or below
  // curriculumLevels.VOCAB, etc. — not the old single shared accountLevel.
  const typeLevelClauses = LADDER_TYPES.map((type) => ({
    type,
    level: { not: null, lte: curriculumLevels[type] },
  }));

  return prisma.subject.findMany({
    where: {
      OR: typeLevelClauses,
      AND: {
        OR: [
          { userSubject: { none: { userId } } },
          { userSubject: { some: { userId, startedAt: null } } },
        ],
      },
    },
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
      frequency: true,
      jlpt: true,
      furigana: true,
      furiganaFallback: true,
      metadata: true,
      // `parentLinks`: rows where this subject is the parent, i.e. the
      // component pieces it's built from (a kanji's radicals, a vocab's
      // kanji). Follow `.child` to get those pieces.
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
      // `childLinks`: rows where this subject is the child, i.e. the
      // larger subjects it appears in (a radical's kanji, a kanji's
      // example vocab). Follow `.parent` to get those.
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
}

/// SRS stage lookup for the child subjects of every candidate (radicals
/// inside candidate kanji, kanji inside candidate vocab), needed to evaluate
/// `isSubjectUnlocked`. Fetched in one pass keyed by child subject id.
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

function vocabIsCommon(metadata: unknown): boolean {
  const meta = metadata as { isCommon?: boolean } | null | undefined;
  return Boolean(meta?.isCommon);
}

function partsOfSpeechOf(metadata: unknown): string[] {
  const meta = metadata as { pos?: string[] } | null | undefined;
  return meta?.pos ?? [];
}

function formationOf(metadata: unknown): string | null {
  const meta = metadata as { formation?: string } | null | undefined;
  return meta?.formation ?? null;
}

/// Returns the next lesson batch for `userId`: unlocked, not-yet-started
/// ladder subjects, ordered radical -> kanji -> vocab, by level, then
/// frequency, truncated to `UserProfile.settings.lessonBatchSize` (default
/// 5). Creates the user's profile on first access if missing.
import { APP_USER_ID } from "@/lib/appUser";

export type LessonBatchResult =
  | { kind: "tutorial"; tutorial: TutorialDetail }
  | { kind: "lessons"; batch: LessonSubject[] };

/// Wraps `getLessonBatch`: if a REQUIRED tutorial is currently triggered and
/// has no TutorialCompletion for this user, returns it instead of lesson
/// items — one at a time, ordered by `Tutorial.order` ascending (see
/// getNextRequiredTutorial). Optional triggered tutorials never block here;
/// they surface as dismissible dashboard cards instead.
export async function getLessonBatchOrTutorial(
  userId: string = APP_USER_ID,
  onlyType?: SubjectType,
): Promise<LessonBatchResult> {
  const tutorial = await getNextRequiredTutorial(userId);
  if (tutorial) return { kind: "tutorial", tutorial };
  return { kind: "lessons", batch: await getLessonBatch(userId, onlyType) };
}

/// `onlyType` narrows the batch to a single subject type, backing
/// `/lessons?type=kana` so a user can choose what to study rather than
/// accepting whatever the algorithm picks. It is applied *after* every
/// unlock rule, so it can only ever narrow what was already legitimately
/// available — it can never surface a locked or out-of-level item.
export async function getLessonBatch(
  userId: string = APP_USER_ID,
  onlyType?: SubjectType,
): Promise<LessonSubject[]> {
  const profile = await getOrCreateProfile(userId);
  const settings = profile.settings as { lessonBatchSize?: number } | null;
  const batchSize = settings?.lessonBatchSize ?? undefined;

  // Per-type curriculum level replaces the old shared accountLevel for
  // curriculum position — accountLevel keeps driving XP/rank only (see
  // src/services/xp/rank.ts and profile reads elsewhere). Type-unlock (Guru
  // counts on a prerequisite type) is a separate, additional gate: a locked
  // type contributes no lesson items even if some of its subjects would
  // otherwise be at or below its own curriculum level.
  const [curriculumLevels, guruCounts] = await Promise.all([
    getCurriculumLevels(userId),
    getGuruCounts(userId),
  ]);

  const candidates = await fetchUnstartedLadderSubjects(userId, curriculumLevels);
  if (candidates.length === 0) return [];

  const childIds = Array.from(
    new Set(candidates.flatMap((c) => c.parentLinks.map((link) => link.child.id))),
  );
  const [stageByChild, kanaResolved] = await Promise.all([
    fetchComponentStages(userId, childIds),
    isKanaResolvedFor(userId),
  ]);

  const unlocked = candidates.filter((c) => {
    if (!isTypeUnlocked(c.type, guruCounts)) return false;

    const subject: SubjectWithComponents = {
      id: c.id,
      type: c.type,
      level: c.level!,
      components: c.parentLinks.map((link) => ({
        childId: link.child.id,
        srsStage: stageByChild.get(link.child.id) ?? null,
        isGating: link.isGating,
      })),
    };
    return isSubjectUnlocked(subject, curriculumLevels[c.type], kanaResolved);
  });

  const scoped = onlyType ? unlocked.filter((c) => c.type === onlyType) : unlocked;

  const asLessonCandidates: (LessonCandidate & { source: (typeof scoped)[number] })[] = scoped.map((c) => ({
    id: c.id,
    type: c.type as LessonSubjectType,
    level: c.level,
    frequency: c.frequency,
    source: c,
  }));

  const batch = selectLessonBatch(asLessonCandidates, batchSize);

  return batch.map(({ source }) => ({
    id: source.id,
    type: source.type as LessonSubjectType,
    level: source.level,
    slug: source.slug,
    characters: source.characters,
    meanings: source.meanings as unknown as LessonSubjectMeaning[],
    readings: source.readings as unknown as LessonSubjectReading[],
    meaningMnemonic: source.meaningMnemonic,
    readingMnemonic: source.readingMnemonic,
    meaningHint: source.meaningHint,
    readingHint: source.readingHint,
    acceptedMeanings: source.acceptedMeanings as string[],
    authored: source.authored,
    frequency: source.frequency,
    jlpt: source.jlpt,
    furigana: source.furigana as { ruby: string; rt?: string }[] | null,
    furiganaFallback: source.furiganaFallback,
    componentsOf:
      source.type === "SENTENCE"
        ? sentenceWordBreakdown(source.metadata, source.parentLinks)
        : source.type === "GRAMMAR"
          ? []
          : source.parentLinks.map((link) => ({
              id: link.child.id,
              type: link.child.type as LessonSubjectType,
              slug: link.child.slug,
              characters: link.child.characters,
              meaning: firstMeaning(link.child.meanings),
              readingUsed: link.readingUsed,
            })),
    usedIn: rankUsedIn(source.type, source.childLinks),
    usedInTotal: source.childLinks.length,
    partsOfSpeech: source.type === "VOCAB" ? partsOfSpeechOf(source.metadata) : [],
    tatoebaSentenceId: source.type === "SENTENCE" ? tatoebaSentenceIdOf(source.metadata) : null,
    formation: source.type === "GRAMMAR" ? formationOf(source.metadata) : null,
    grammarExamples: source.type === "GRAMMAR" ? grammarExamples(source.parentLinks) : [],
  }));
}

/// `usedIn` ordering/capping: RADICAL -> kanji it appears in, capped at the
/// 20 most frequent (lowest `frequency` rank first, nulls last). KANJI ->
/// example vocab, capped at 4, common words and low (better) frequency-rank
/// words sorted first.
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
    type: link.parent.type as LessonSubjectType,
    slug: link.parent.slug,
    characters: link.parent.characters,
    meaning: firstMeaning(link.parent.meanings),
    readingUsed: link.readingUsed,
    isCommon: vocabIsCommon(link.parent.metadata),
    frequency: link.parent.frequency,
  }));

  if (subjectType !== SubjectType.KANJI) {
    const byFrequency = [...summaries].sort((a, b) => {
      const aFreq = a.frequency ?? Number.POSITIVE_INFINITY;
      const bFreq = b.frequency ?? Number.POSITIVE_INFINITY;
      return aFreq - bFreq;
    });
    return byFrequency.slice(0, 20).map(({ id, type, slug, characters, meaning, readingUsed }) => ({
      id,
      type,
      slug,
      characters,
      meaning,
      readingUsed,
    }));
  }

  const sorted = [...summaries].sort((a, b) => {
    if (a.isCommon !== b.isCommon) return a.isCommon ? -1 : 1;
    const aFreq = a.frequency ?? Number.POSITIVE_INFINITY;
    const bFreq = b.frequency ?? Number.POSITIVE_INFINITY;
    return aFreq - bFreq;
  });

  return sorted.slice(0, 4).map(({ id, type, slug, characters, meaning, readingUsed }) => ({
    id,
    type,
    slug,
    characters,
    meaning,
    readingUsed,
  }));
}
