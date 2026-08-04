import { prisma } from "@/lib/db";
import { SubjectType } from "@/generated/prisma/enums";
import type { LessonSubjectMeaning, LessonSubjectReading } from "@/server/queries/lessons";
import { APP_USER_ID } from "@/lib/appUser";

export interface ReviewSubject {
  id: string; // UserSubject id
  subjectId: string;
  type: "KANA" | "RADICAL" | "KANJI" | "VOCAB" | "GRAMMAR" | "SENTENCE" | "READING";
  slug: string;
  characters: string | null;
  meanings: LessonSubjectMeaning[];
  readings: LessonSubjectReading[];
  acceptedMeanings: string[];
  meaningMnemonic: string | null;
  readingMnemonic: string | null;
  srsStage: number;
  dueAt: Date | null;
  lastPromotedAt: Date | null;
  furigana: { ruby: string; rt?: string }[] | null;
  furiganaFallback: boolean;
}

export interface ReviewDueCount {
  type: SubjectType;
  count: number;
}

export interface ReviewQueueResult {
  items: ReviewSubject[];
  dueCounts: ReviewDueCount[];
  /// Soonest dueAt among started, non-burned items that are NOT yet due, or
  /// null if there are none. Drives the "next review in 3h 20m" empty state
  /// when `items` is empty.
  nextDueAt: Date | null;
}

/// Filters for an unranked (practice) queue: which types and curriculum
/// levels to draw from. Empty/undefined means "no restriction on this axis".
export interface UnrankedQueueFilter {
  types?: SubjectType[];
  levels?: number[];
}

/// Fisher-Yates, in place on a caller-owned array.
function shuffle<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/// Column set every review queue selects. Kept in one place so the ranked
/// and unranked queries can't drift apart.
const REVIEW_SELECT = {
  id: true,
  srsStage: true,
  dueAt: true,
  lastPromotedAt: true,
  subject: {
    select: {
      id: true,
      type: true,
      slug: true,
      characters: true,
      meanings: true,
      readings: true,
      acceptedMeanings: true,
      meaningMnemonic: true,
      readingMnemonic: true,
      furigana: true,
      furiganaFallback: true,
    },
  },
} as const;

type ReviewRow = {
  id: string;
  srsStage: number;
  dueAt: Date | null;
  lastPromotedAt: Date | null;
  subject: {
    id: string;
    type: string;
    slug: string;
    characters: string | null;
    meanings: unknown;
    readings: unknown;
    acceptedMeanings: unknown;
    meaningMnemonic: string | null;
    readingMnemonic: string | null;
    furigana: unknown;
    furiganaFallback: boolean;
  };
};

function toReviewSubject(row: ReviewRow): ReviewSubject {
  return {
    id: row.id,
    subjectId: row.subject.id,
    type: row.subject.type as ReviewSubject["type"],
    slug: row.subject.slug,
    characters: row.subject.characters,
    meanings: row.subject.meanings as LessonSubjectMeaning[],
    readings: row.subject.readings as LessonSubjectReading[],
    acceptedMeanings: row.subject.acceptedMeanings as string[],
    meaningMnemonic: row.subject.meaningMnemonic,
    readingMnemonic: row.subject.readingMnemonic,
    srsStage: row.srsStage,
    dueAt: row.dueAt,
    lastPromotedAt: row.lastPromotedAt,
    furigana: row.subject.furigana as { ruby: string; rt?: string }[] | null,
    furiganaFallback: row.subject.furiganaFallback,
  };
}

/// Fetches the RANKED review queue for `userId`: every UserSubject that has
/// been started, is between Apprentice I and Enlightened (stage 1-8; stage 9
/// is Burned and leaves the queue for good), AND is actually due
/// (`dueAt <= now`).
///
/// The due-date filter is what makes a ranked session finite and
/// completable. Without it the queue is every item the user has ever
/// started, which at a few hundred items means every session dumps the whole
/// collection out and the queue can never empty. Practicing items that
/// aren't due yet is a real want, but it belongs in the unranked queue
/// below, where it earns no XP and cannot touch SRS state.
///
/// Items with a null `dueAt` are treated as due: only Burned items (excluded
/// by the stage filter) legitimately have no due date, so a null here is a
/// data anomaly that should surface rather than silently vanish.
/// The returned `items` are shuffled so a session doesn't present the same
/// order every time; `dueCounts` is unaffected.
export async function getReviewQueue(userId: string = APP_USER_ID, now: Date = new Date()): Promise<ReviewQueueResult> {
  const rows = await prisma.userSubject.findMany({
    where: {
      userId,
      startedAt: { not: null },
      srsStage: { gte: 1, lte: 8 },
      OR: [{ dueAt: { lte: now } }, { dueAt: null }],
    },
    orderBy: { dueAt: "asc" },
    select: {
      id: true,
      srsStage: true,
      dueAt: true,
      lastPromotedAt: true,
      subject: {
        select: {
          id: true,
          type: true,
          slug: true,
          characters: true,
          meanings: true,
          readings: true,
          acceptedMeanings: true,
          meaningMnemonic: true,
          readingMnemonic: true,
          furigana: true,
          furiganaFallback: true,
        },
      },
    },
  });

  const items: ReviewSubject[] = shuffle(rows.map(toReviewSubject));

  const countsByType = new Map<SubjectType, number>();
  for (const row of rows) {
    const t = row.subject.type;
    countsByType.set(t, (countsByType.get(t) ?? 0) + 1);
  }
  const dueCounts: ReviewDueCount[] = Array.from(countsByType.entries()).map(([type, count]) => ({
    type,
    count,
  }));

  // Only looked up when the queue is empty — that's the sole place the UI
  // shows it, and it saves a query on every populated dashboard load.
  let nextDueAt: Date | null = null;
  if (rows.length === 0) {
    const soonest = await prisma.userSubject.findFirst({
      where: { userId, startedAt: { not: null }, srsStage: { gte: 1, lte: 8 }, dueAt: { gt: now } },
      orderBy: { dueAt: "asc" },
      select: { dueAt: true },
    });
    nextDueAt = soonest?.dueAt ?? null;
  }

  return { items, dueCounts, nextDueAt };
}

/// Fetches an UNRANKED (practice) queue: any started, non-burned item the
/// user picks, regardless of due date, optionally narrowed to certain
/// subject types and curriculum levels.
///
/// Unranked sessions are pure practice — see commitUnrankedReviewSession in
/// src/server/actions/reviews.ts, which logs answers but awards no XP or
/// mastery and leaves SRS stage and dueAt untouched. That's what makes it
/// safe to drill a weak item repeatedly without either farming XP or risking
/// a demotion.
///
/// Unlike the ranked queue this deliberately INCLUDES Burned items (stage
/// 9). Burned means "known well enough to leave the SRS", not "unavailable":
/// skipped kana are burned outright, so excluding them would make the single
/// most likely thing to want casual drilling on the one thing unreachable.
/// Nothing here can change an item's stage, so including Burned costs
/// nothing.
export async function getUnrankedReviewQueue(
  userId: string = APP_USER_ID,
  filter: UnrankedQueueFilter = {},
): Promise<ReviewSubject[]> {
  const rows = await prisma.userSubject.findMany({
    where: {
      userId,
      startedAt: { not: null },
      srsStage: { gte: 1 },
      subject: {
        ...(filter.types?.length ? { type: { in: filter.types } } : {}),
        ...(filter.levels?.length ? { level: { in: filter.levels } } : {}),
      },
    },
    orderBy: { dueAt: "asc" },
    select: REVIEW_SELECT,
  });

  return shuffle(rows.map(toReviewSubject));
}

export interface UnrankedOption {
  type: SubjectType;
  levels: number[];
  count: number;
}

/// The pickable axes for an unranked session: which types the user has
/// started anything in, and which curriculum levels within each. Drives the
/// subject/level pickers on the unranked page so the UI can only offer
/// combinations that actually have items behind them.
///
/// Matches getUnrankedReviewQueue's stage filter exactly, Burned included —
/// if the two drifted apart the picker would offer counts the session
/// couldn't deliver, or hide items the session would happily serve.
export async function getUnrankedOptions(userId: string = APP_USER_ID): Promise<UnrankedOption[]> {
  const rows = await prisma.userSubject.findMany({
    where: { userId, startedAt: { not: null }, srsStage: { gte: 1 } },
    select: { subject: { select: { type: true, level: true } } },
  });

  const byType = new Map<SubjectType, { levels: Set<number>; count: number }>();
  for (const row of rows) {
    const t = row.subject.type;
    const entry = byType.get(t) ?? { levels: new Set<number>(), count: 0 };
    entry.count += 1;
    if (row.subject.level !== null) entry.levels.add(row.subject.level);
    byType.set(t, entry);
  }

  return Array.from(byType.entries())
    .map(([type, { levels, count }]) => ({
      type,
      levels: Array.from(levels).sort((a, b) => a - b),
      count,
    }))
    .sort((a, b) => a.type.localeCompare(b.type));
}
