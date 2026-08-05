"use server";

import { prisma } from "@/lib/db";
import { getOrCreateProfile } from "@/server/queries/profile";
import { LESSON_STAGE, intervalForStage } from "@/services/srs/stages";
import { xpForLesson, streakMultiplier, levelFromTotalXp } from "@/services/xp/curve";
import { masteryXpForAnswer, masteryLevelFromXp } from "@/services/xp/mastery";
import { parseTier, type Rank } from "@/services/rank/tiers";
import { applyDailyActivity, dayInTimezone } from "@/services/xp/streak";
import { isSubjectUnlocked } from "@/services/srs/unlock";
import { getCurriculumLevels } from "@/server/queries/curriculum";
import { SubjectType } from "@/generated/prisma/enums";
import { revalidatePath } from "next/cache";

import { APP_USER_ID } from "@/lib/appUser";

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
  // Lessons award XP but never LP: they have no failure mode, so any LP
  // award could only ratchet rank upward and would make rank a measure of
  // time served rather than performance. Rank is reported unchanged so the
  // summary can still display it.
  const rank: Rank = { tier: parseTier(profile.rank), division: profile.rankDivision };

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
        currentStreak: streak.currentStreak,
        longestStreak: streak.longestStreak,
        lastActiveDay: streak.lastActiveDay,
      },
    });

    return { sessionId: session.id };
  });

  // Unlocks are gated on the KANJI curriculum level, not the XP-derived
  // account level — see the note in commitReviewSession's
  // curriculumLevelForUnlocks.
  const curriculumLevels = await getCurriculumLevels(userId);
  const newlyUnlockedSubjectIds = await findNewlyUnlockedSubjects(
    userId,
    curriculumLevels[SubjectType.KANJI],
    subjectIds,
  );

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
    previousRank: rank,
    newRank: rank,
    rankPromoted: false,
    newlyUnlockedSubjectIds,
  };
}

/// Surfaces subjects that are unlocked but not yet started, so the lesson
/// summary can report "N new items unlocked".
///
/// Lessons only ever set stage 1, so nothing reaches Guru here and no
/// component gate opens as a direct result of this commit. What this catches
/// is content already unlocked by *earlier* review sessions that the user
/// hasn't started yet — gated on the KANJI curriculum level, which is the
/// level that actually governs access.
async function findNewlyUnlockedSubjects(
  userId: string,
  unlockLevel: number,
  justTaughtIds: string[],
): Promise<string[]> {
  const candidates = await prisma.subject.findMany({
    where: {
      type: { in: [SubjectType.RADICAL, SubjectType.KANJI, SubjectType.VOCAB] },
      level: { not: null, lte: unlockLevel },
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
        unlockLevel,
      ),
    )
    .map((c) => c.id);
}
