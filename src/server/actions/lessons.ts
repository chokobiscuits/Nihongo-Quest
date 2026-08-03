"use server";

import { prisma } from "@/lib/db";
import { getOrCreateProfile } from "@/server/queries/profile";
import { LESSON_STAGE, intervalForStage } from "@/services/srs/stages";
import { xpForLesson, streakMultiplier, levelFromTotalXp } from "@/services/xp/curve";
import { masteryXpForAnswer, masteryLevelFromXp } from "@/services/xp/mastery";
import { rankForLevel } from "@/services/xp/rank";
import { applyDailyActivity, dayInTimezone } from "@/services/xp/streak";
import { nextUserLevel, isSubjectUnlocked } from "@/services/srs/unlock";
import { SubjectType } from "@/generated/prisma/enums";
import { revalidatePath } from "next/cache";

const APP_USER_ID = process.env.APP_USER_ID ?? "local-user";

export interface LessonQuizAnswerRecord {
  subjectId: string;
  questionType: "MEANING" | "READING";
  /// Number of wrong sub-answers before the item was finally answered
  /// correctly within the lesson (re-queue attempts). Lessons always end
  /// each item correct, so this is purely a friction/logging signal.
  incorrectCount: number;
}

export interface CommitLessonSessionInput {
  /// Every subject taught in this batch, one entry per item.
  subjectIds: string[];
  /// One record per question answered correctly during the quiz phase
  /// (radicals: MEANING only; kanji/vocab: MEANING and READING).
  answers: LessonQuizAnswerRecord[];
}

export interface CommitLessonSessionResult {
  sessionId: string;
  xpAwarded: number;
  totalXp: string; // BigInt serialized as a string for client transport
  previousLevel: number;
  newLevel: number;
  leveledUp: boolean;
  previousRank: { tier: string; division: number | null };
  newRank: { tier: string; division: number | null };
  rankPromoted: boolean;
  newlyUnlockedSubjectIds: string[];
}

/// Commits a completed lesson session in one transaction: creates
/// UserSubject rows at Apprentice I for every taught item, logs each
/// question answered, records the Session/XpEvent/DailyActivity rows, and
/// updates the profile's XP/level/rank/streak. Nothing is written until the
/// whole batch is done — an abandoned session leaves no trace.
export async function commitLessonSession(
  input: CommitLessonSessionInput,
  userId: string = APP_USER_ID,
): Promise<CommitLessonSessionResult> {
  const { subjectIds, answers } = input;
  const now = new Date();

  const profile = await getOrCreateProfile(userId);
  // Day boundary observed in the profile's own timezone (default
  // Asia/Tokyo), not UTC — see dayInTimezone's doc comment.
  const today = dayInTimezone(now, profile.timezone);

  const dueAt = (() => {
    const interval = intervalForStage(1);
    return interval === null ? null : new Date(now.getTime() + interval);
  })();

  // XP: learning a new item is a flat award per item taught, not per
  // question answered — a lesson item always ends up known regardless of how
  // many sub-answers it took, so XP is keyed to the item, not the answer log.
  const answerXp = subjectIds.length * xpForLesson();
  const multiplier = streakMultiplier(profile.currentStreak);
  const xpAwarded = Math.round(answerXp * multiplier);

  const previousTotalXp = Number(profile.totalXp);
  const newTotalXp = previousTotalXp + xpAwarded;
  const previousLevel = profile.accountLevel;
  const newLevel = levelFromTotalXp(newTotalXp);
  const previousRank = rankForLevel(previousLevel);
  const newRank = rankForLevel(newLevel);

  const streak = applyDailyActivity({
    currentStreak: profile.currentStreak,
    longestStreak: profile.longestStreak,
    lastActiveDay: profile.lastActiveDay,
    today,
  });

  const result = await prisma.$transaction(async (tx) => {
    const session = await tx.session.create({
      data: {
        userId,
        kind: "LESSON",
        scope: { subjectIds },
        startedAt: now,
        completedAt: now,
        totalItems: subjectIds.length,
        correctItems: subjectIds.length,
        scorePct: 100,
        xpAwarded,
      },
    });

    for (const subjectId of subjectIds) {
      const userSubject = await tx.userSubject.upsert({
        where: { userId_subjectId: { userId, subjectId } },
        update: {
          startedAt: now,
          srsStage: 1,
          dueAt,
          passedAt: null,
          lastPromotedAt: now,
        },
        create: {
          userId,
          subjectId,
          unlockedAt: now,
          startedAt: now,
          srsStage: 1,
          dueAt,
          lastPromotedAt: now,
        },
      });

      const itemAnswers = answers.filter((a) => a.subjectId === subjectId);
      for (const answer of itemAnswers) {
        await tx.reviewLog.create({
          data: {
            userSubjectId: userSubject.id,
            sessionId: session.id,
            questionType: answer.questionType,
            incorrectCount: answer.incorrectCount,
            startedStage: LESSON_STAGE,
            endedStage: 1,
            answeredAt: now,
          },
        });

        // Lesson items land at stage 1 (Apprentice I) once taught, so
        // mastery XP is weighted the same as a stage-1 review answer.
        const masteryXp = masteryXpForAnswer(1);
        const correctField = answer.questionType === "MEANING" ? "meaningCorrect" : "readingCorrect";
        await tx.userSubject.update({
          where: { id: userSubject.id },
          data: {
            [correctField]: { increment: 1 },
            masteryXp: { increment: masteryXp },
            masteryLevel: masteryLevelFromXp(userSubject.masteryXp + masteryXp),
          },
        });
      }
    }

    if (xpAwarded !== 0) {
      await tx.xpEvent.create({
        data: { userId, amount: xpAwarded, reason: "lesson", sessionId: session.id },
      });
    }

    await tx.dailyActivity.upsert({
      where: { userId_day: { userId, day: today } },
      update: { lessonCount: { increment: subjectIds.length }, xpEarned: { increment: xpAwarded } },
      create: { userId, day: today, lessonCount: subjectIds.length, xpEarned: xpAwarded },
    });

    await tx.userProfile.update({
      where: { userId },
      data: {
        totalXp: BigInt(newTotalXp),
        accountLevel: newLevel,
        rank: newRank.tier,
        rankDivision: newRank.division,
        currentStreak: streak.currentStreak,
        longestStreak: streak.longestStreak,
        lastActiveDay: streak.lastActiveDay,
      },
    });

    return { sessionId: session.id };
  });

  const newlyUnlockedSubjectIds = await findNewlyUnlockedSubjects(userId, newLevel, subjectIds);

  try {
    revalidatePath("/lessons");
    revalidatePath("/reviews");
  } catch {
    // revalidatePath requires an active Next.js request scope; a no-op
    // outside one (e.g. scripts, tests) is fine — the transaction above is
    // what actually matters.
  }

  return {
    sessionId: result.sessionId,
    xpAwarded,
    totalXp: String(newTotalXp),
    previousLevel,
    newLevel,
    leveledUp: newLevel > previousLevel,
    previousRank,
    newRank,
    rankPromoted: newRank.tier !== previousRank.tier || newRank.division !== previousRank.division,
    newlyUnlockedSubjectIds,
  };
}

/// After committing, some subjects may have just become unlocked: either
/// because a just-Guru'd... no — lessons only ever set stage 1, so no
/// component reaches Guru here. What *can* change is the user's account
/// level (via `nextUserLevel` off newly-Guru'd kanji from earlier review
/// sessions this call doesn't touch) — so this only surfaces newly-unlocked
/// level-N radicals/kanji when the account level itself moved up in this
/// commit. Cheap best-effort: only runs the check when `newLevel` changed.
async function findNewlyUnlockedSubjects(
  userId: string,
  newLevel: number,
  justTaughtIds: string[],
): Promise<string[]> {
  const candidates = await prisma.subject.findMany({
    where: {
      type: { in: [SubjectType.RADICAL, SubjectType.KANJI, SubjectType.VOCAB] },
      level: { not: null, lte: newLevel },
      id: { notIn: justTaughtIds },
      OR: [{ userSubject: { none: { userId } } }, { userSubject: { some: { userId, startedAt: null } } }],
    },
    select: {
      id: true,
      type: true,
      level: true,
      childLinks: { select: { isGating: true, child: { select: { id: true } } } },
    },
    take: 200,
  });

  if (candidates.length === 0) return [];

  const childIds = Array.from(new Set(candidates.flatMap((c) => c.childLinks.map((l) => l.child.id))));
  const stages = childIds.length
    ? await prisma.userSubject.findMany({
        where: { userId, subjectId: { in: childIds } },
        select: { subjectId: true, srsStage: true },
      })
    : [];
  const stageMap = new Map(stages.map((s) => [s.subjectId, s.srsStage]));

  return candidates
    .filter((c) =>
      isSubjectUnlocked(
        {
          id: c.id,
          type: c.type,
          level: c.level!,
          components: c.childLinks.map((l) => ({
            childId: l.child.id,
            srsStage: stageMap.get(l.child.id) ?? null,
            isGating: l.isGating,
          })),
        },
        newLevel,
      ),
    )
    .map((c) => c.id);
}

// Re-exported for callers that need to recompute the account level after a
// batch of review sessions (out of scope here, kept for parity/tests).
export { nextUserLevel };
