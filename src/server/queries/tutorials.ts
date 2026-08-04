import { prisma } from "@/lib/db";
import { SubjectType } from "@/generated/prisma/enums";
import { getOrCreateProfile } from "@/server/queries/profile";
import { GURU_STAGE, BURNED_STAGE } from "@/services/srs/stages";
import { isTriggered, type TutorialStats } from "@/services/tutorials/triggers";
import type { TutorialSubjectType, TutorialTrigger } from "@/services/tutorials/trigger-types";

import { APP_USER_ID } from "@/lib/appUser";

const LADDER_TYPES: TutorialSubjectType[] = [
  SubjectType.RADICAL,
  SubjectType.KANJI,
  SubjectType.VOCAB,
  SubjectType.SENTENCE,
] as TutorialSubjectType[];

export interface TutorialSummary {
  id: string;
  slug: string;
  order: number;
  titleEn: string;
  titleJa: string;
  required: boolean;
  estimatedMinutes: number;
  trigger: TutorialTrigger;
  completed: boolean;
}

export interface TutorialDetail extends TutorialSummary {
  body: string;
}

/// Builds the pure `TutorialStats` snapshot from live DB rows for `userId`.
/// The only DB-touching half of trigger evaluation — see
/// src/services/tutorials/triggers.ts for the pure predicate this feeds.
export async function computeTutorialStats(userId: string = APP_USER_ID): Promise<TutorialStats> {
  const profile = await getOrCreateProfile(userId);

  const zeroCounts = (): Record<TutorialSubjectType, number> => ({
    RADICAL: 0,
    KANJI: 0,
    VOCAB: 0,
    SENTENCE: 0,
  });

  const [subjectRows, completedCount, multiKanjiStarted] = await Promise.all([
    prisma.userSubject.findMany({
      where: { userId, subject: { type: { in: LADDER_TYPES } } },
      select: {
        startedAt: true,
        passedAt: true,
        srsStage: true,
        subject: { select: { type: true } },
      },
    }),
    prisma.tutorialCompletion.count({ where: { userId } }),
    hasMultiKanjiWordStarted(userId),
  ]);

  const startedByType = zeroCounts();
  const passedByType = zeroCounts();
  const burnedByType = zeroCounts();

  for (const row of subjectRows) {
    const type = row.subject.type as TutorialSubjectType;
    if (row.startedAt) startedByType[type] += 1;
    if (row.passedAt || row.srsStage >= GURU_STAGE) passedByType[type] += 1;
    if (row.srsStage >= BURNED_STAGE) burnedByType[type] += 1;
  }

  return {
    accountLevel: profile.accountLevel,
    startedByType,
    passedByType,
    burnedByType,
    hasMultiKanjiWordStarted: multiKanjiStarted,
    hasCompletedAnyTutorial: completedCount > 0,
  };
}

/// True if any started VOCAB subject is built from 2+ distinct KANJI
/// components — a "multi-kanji word" for the rendaku tutorial's trigger.
async function hasMultiKanjiWordStarted(userId: string): Promise<boolean> {
  const started = await prisma.userSubject.findMany({
    where: { userId, startedAt: { not: null }, subject: { type: SubjectType.VOCAB } },
    select: {
      subject: {
        select: {
          parentLinks: { where: { child: { type: SubjectType.KANJI } }, select: { childId: true } },
        },
      },
    },
    take: 500,
  });

  return started.some((row) => new Set(row.subject.parentLinks.map((l) => l.childId)).size >= 2);
}

function toSummary(row: {
  id: string;
  slug: string;
  order: number;
  titleEn: string;
  titleJa: string;
  required: boolean;
  estimatedMinutes: number;
  trigger: unknown;
  completions: { userId: string }[];
}): TutorialSummary {
  return {
    id: row.id,
    slug: row.slug,
    order: row.order,
    titleEn: row.titleEn,
    titleJa: row.titleJa,
    required: row.required,
    estimatedMinutes: row.estimatedMinutes,
    trigger: row.trigger as TutorialTrigger,
    completed: row.completions.length > 0,
  };
}

/// The next REQUIRED tutorial that is both currently triggered and not yet
/// completed by `userId`, ordered by `order` ascending — this is what gates
/// the lesson flow (see getLessonBatch). Null once none are pending.
export async function getNextRequiredTutorial(userId: string = APP_USER_ID): Promise<TutorialDetail | null> {
  const stats = await computeTutorialStats(userId);

  const candidates = await prisma.tutorial.findMany({
    where: { required: true },
    orderBy: { order: "asc" },
    include: { completions: { where: { userId } } },
  });

  for (const row of candidates) {
    if (row.completions.length > 0) continue;
    if (isTriggered(row.trigger as TutorialTrigger, stats)) {
      return { ...toSummary(row), body: row.body };
    }
  }
  return null;
}

/// Every OPTIONAL tutorial currently triggered and not yet completed —
/// surfaced as dismissible dashboard cards, never blocking.
export async function getTriggeredOptionalTutorials(userId: string = APP_USER_ID): Promise<TutorialSummary[]> {
  const stats = await computeTutorialStats(userId);

  const candidates = await prisma.tutorial.findMany({
    where: { required: false },
    orderBy: { order: "asc" },
    include: { completions: { where: { userId } } },
  });

  return candidates
    .filter((row) => row.completions.length === 0 && isTriggered(row.trigger as TutorialTrigger, stats))
    .map(toSummary);
}

/// Full library: every tutorial, in order, with completed state — readable
/// anytime regardless of trigger.
export async function getTutorialLibrary(userId: string = APP_USER_ID): Promise<TutorialSummary[]> {
  const rows = await prisma.tutorial.findMany({
    orderBy: { order: "asc" },
    include: { completions: { where: { userId } } },
  });
  return rows.map(toSummary);
}

export async function getTutorialBySlug(slug: string, userId: string = APP_USER_ID): Promise<TutorialDetail | null> {
  const row = await prisma.tutorial.findUnique({
    where: { slug },
    include: { completions: { where: { userId } } },
  });
  if (!row) return null;
  return { ...toSummary(row), body: row.body };
}

export async function acknowledgeTutorial(tutorialId: string, userId: string = APP_USER_ID): Promise<void> {
  await prisma.tutorialCompletion.upsert({
    where: { userId_tutorialId: { userId, tutorialId } },
    update: {},
    create: { userId, tutorialId, acknowledged: true },
  });
}

/// Marks every tutorial complete. `createMany` with `skipDuplicates` keeps
/// this idempotent, so re-running it is a no-op rather than an error.
/// Returns how many rows were newly created.
export async function acknowledgeAllTutorials(userId: string = APP_USER_ID): Promise<number> {
  const all = await prisma.tutorial.findMany({ select: { id: true } });
  const result = await prisma.tutorialCompletion.createMany({
    data: all.map((t) => ({ userId, tutorialId: t.id, acknowledged: true })),
    skipDuplicates: true,
  });
  return result.count;
}
