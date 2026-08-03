import { prisma } from "@/lib/db";
import { SubjectType } from "@/generated/prisma/enums";
import { isSubjectUnlocked, type SubjectWithComponents } from "@/services/srs/unlock";
import { selectLessonBatch, type LessonCandidate, type LessonSubjectType } from "@/services/lessons/batch";
import { getOrCreateProfile } from "@/server/queries/profile";

// Lessons only ever schedule the 60-level curriculum ladder (level != null).
// Off-ladder subjects (jlpt/frequency reference material) are seeded but
// never surface as lessons.
const LADDER_TYPES: SubjectType[] = [SubjectType.RADICAL, SubjectType.KANJI, SubjectType.VOCAB];

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
}

/// Candidate subject shape pulled for the unlock check: every ladder subject
/// at or below the user's level that has no UserSubject row yet, or has one
/// that has never been started (still a lesson, not a review item).
async function fetchUnstartedLadderSubjects(userId: string, userLevel: number) {
  return prisma.subject.findMany({
    where: {
      type: { in: LADDER_TYPES },
      level: { not: null, lte: userLevel },
      OR: [
        { userSubject: { none: { userId } } },
        { userSubject: { some: { userId, startedAt: null } } },
      ],
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
            select: { id: true, slug: true, characters: true, meanings: true, type: true },
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

/// Returns the next lesson batch for `userId`: unlocked, not-yet-started
/// ladder subjects, ordered radical -> kanji -> vocab, by level, then
/// frequency, truncated to `UserProfile.settings.lessonBatchSize` (default
/// 5). Creates the user's profile on first access if missing.
const APP_USER_ID = process.env.APP_USER_ID ?? "local-user";

export async function getLessonBatch(userId: string = APP_USER_ID): Promise<LessonSubject[]> {
  const profile = await getOrCreateProfile(userId);
  const settings = profile.settings as { lessonBatchSize?: number } | null;
  const batchSize = settings?.lessonBatchSize ?? undefined;

  const candidates = await fetchUnstartedLadderSubjects(userId, profile.accountLevel);
  if (candidates.length === 0) return [];

  const childIds = Array.from(
    new Set(candidates.flatMap((c) => c.parentLinks.map((link) => link.child.id))),
  );
  const stageByChild = await fetchComponentStages(userId, childIds);

  const unlocked = candidates.filter((c) => {
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
    return isSubjectUnlocked(subject, profile.accountLevel);
  });

  const asLessonCandidates: (LessonCandidate & { source: (typeof unlocked)[number] })[] = unlocked.map((c) => ({
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
    furigana: source.furigana as { ruby: string; rt?: string }[] | null,
    furiganaFallback: source.furiganaFallback,
    componentsOf: source.parentLinks.map((link) => ({
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
