import { prisma } from "@/lib/db";
import { SubjectType } from "@/generated/prisma/enums";
import type { LessonSubjectMeaning, LessonSubjectReading } from "@/server/queries/lessons";

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
}

/// Fetches the reviewable queue for `userId`: every UserSubject that has
/// been started and is between Apprentice I and Enlightened (stage 1-8;
/// stage 9 is Burned and leaves the queue for good). No due-date filter —
/// `dueAt` is a priority weight (ORDER BY, ascending, overdue-first), never
/// a WHERE-clause lock. The user can review as much as they want, whenever.
import { APP_USER_ID } from "@/lib/appUser";

export async function getReviewQueue(userId: string = APP_USER_ID): Promise<ReviewQueueResult> {
  const rows = await prisma.userSubject.findMany({
    where: {
      userId,
      startedAt: { not: null },
      srsStage: { gte: 1, lte: 8 },
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

  const items: ReviewSubject[] = rows.map((row) => ({
    id: row.id,
    subjectId: row.subject.id,
    type: row.subject.type as ReviewSubject["type"],
    slug: row.subject.slug,
    characters: row.subject.characters,
    meanings: row.subject.meanings as unknown as LessonSubjectMeaning[],
    readings: row.subject.readings as unknown as LessonSubjectReading[],
    acceptedMeanings: row.subject.acceptedMeanings as string[],
    meaningMnemonic: row.subject.meaningMnemonic,
    readingMnemonic: row.subject.readingMnemonic,
    srsStage: row.srsStage,
    dueAt: row.dueAt,
    lastPromotedAt: row.lastPromotedAt,
    furigana: row.subject.furigana as { ruby: string; rt?: string }[] | null,
    furiganaFallback: row.subject.furiganaFallback,
  }));

  const countsByType = new Map<SubjectType, number>();
  for (const row of rows) {
    const t = row.subject.type;
    countsByType.set(t, (countsByType.get(t) ?? 0) + 1);
  }
  const dueCounts: ReviewDueCount[] = Array.from(countsByType.entries()).map(([type, count]) => ({
    type,
    count,
  }));

  return { items, dueCounts };
}
