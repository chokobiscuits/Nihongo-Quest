"use server";

import { prisma } from "@/lib/db";
import { getOrCreateProfile } from "@/server/queries/profile";
import { GURU_STAGE, BURNED_STAGE } from "@/services/srs/stages";
import { computeTransition } from "@/services/srs/transition";
import { xpForCorrectAnswer, xpForIncorrectAnswer, scaleXpForProductivity, streakMultiplier, levelFromTotalXp } from "@/services/xp/curve";
import { masteryXpForAnswer, masteryLevelFromXp } from "@/services/xp/mastery";
import { resolveSession, outranks, type RankState } from "@/services/rank/lp";
import { parseTier } from "@/services/rank/tiers";
import { applyDailyActivity, dayInTimezone } from "@/services/xp/streak";
import { isSubjectUnlocked } from "@/services/srs/unlock";
import { getCurriculumLevels } from "@/server/queries/curriculum";
import { SubjectType } from "@/generated/prisma/enums";
import { revalidatePath } from "next/cache";

import { APP_USER_ID } from "@/lib/appUser";

export interface ReviewAnswerRecord {
  /// UserSubject id, not subject id — reviews always operate on an existing
  /// UserSubject row.
  userSubjectId: string;
  questionType: "MEANING" | "READING";
  correct: boolean;
  /// Number of wrong sub-answers before this question was finally resolved
  /// within the session (re-queue attempts). Feeds the demotion formula only
  /// when the *item* itself is ultimately marked incorrect for this pass —
  /// see commitReviewSession for how per-item incorrectCount is derived.
  incorrectCount: number;
}

export interface CommitReviewSessionInput {
  /// One record per question resolved (correctly) during the review, plus
  /// one final incorrect record if the item was ever missed. Every
  /// userSubjectId here must have all its required kinds represented among
  /// correct=true records — that's what "resolved" means.
  answers: ReviewAnswerRecord[];
}

export interface ReviewItemOutcome {
  userSubjectId: string;
  subjectId: string;
  startedStage: number;
  endedStage: number;
  promoted: boolean;
  reachedGuru: boolean;
  reachedBurned: boolean;
}

export interface CommitReviewSessionResult {
  sessionId: string;
  xpAwarded: number;
  totalXp: string; // BigInt serialized as a string for client transport
  previousLevel: number;
  newLevel: number;
  leveledUp: boolean;
  previousRank: { tier: string; division: number | null };
  newRank: { tier: string; division: number | null };
  rankPromoted: boolean;
  rankDemoted: boolean;
  /// LP gained (positive) or lost (negative) this session. Zero for sessions
  /// too small to be ranked, or exactly at the neutral accuracy.
  lpDelta: number;
  lpAfter: number;
  /// Set when an over-achievement multiplier applied.
  lpBonus: "s-rank" | "perfect" | null;
  newlyUnlockedSubjectIds: string[];
  itemOutcomes: ReviewItemOutcome[];
  itemsReviewed: number;
  /// Percentage of individual questions answered correctly.
  accuracyPct: number;
  /// Items answered cleanly (never missed at any point in the session).
  /// Counted per item rather than per question, which is what a user means
  /// by "got it right".
  itemsCorrect: number;
}

/// Commits a completed review session in one transaction. Mirrors
/// commitLessonSession's shape: nothing is written until the whole session is
/// done, so an abandoned session leaves no trace. Every question answered —
/// correct or (final) incorrect — is logged; an item's SRS transition is
/// computed once, from its net incorrectCount for the whole item across
/// however many sub-answers it took to finally clear both kinds.
export async function commitReviewSession(
  input: CommitReviewSessionInput,
  userId: string = APP_USER_ID,
): Promise<CommitReviewSessionResult> {
  const { answers } = input;
  const now = new Date();

  const userSubjectIds = Array.from(new Set(answers.map((a) => a.userSubjectId)));
  if (userSubjectIds.length === 0) {
    throw new Error("commitReviewSession called with no answers");
  }

  const profile = await getOrCreateProfile(userId);
  // Day boundary observed in the profile's own timezone (default
  // Asia/Tokyo), not UTC — see dayInTimezone's doc comment.
  const today = dayInTimezone(now, profile.timezone);

  const userSubjects = await prisma.userSubject.findMany({
    where: { id: { in: userSubjectIds }, userId },
    select: {
      id: true,
      subjectId: true,
      srsStage: true,
      lastPromotedAt: true,
      masteryXp: true,
      passedAt: true,
      burnedAt: true,
    },
  });
  const bySubjectRow = new Map(userSubjects.map((u) => [u.id, u]));

  // Per-item net incorrectCount: the max incorrectCount recorded across that
  // item's answers (each question's incorrectCount already accumulates every
  // wrong sub-answer for that question within the session), and whether the
  // item was ever marked incorrect at all (drives the transition's
  // correct/incorrect branch).
  const itemIncorrect = new Map<string, number>();
  const itemEverWrong = new Map<string, boolean>();
  for (const a of answers) {
    itemIncorrect.set(a.userSubjectId, Math.max(itemIncorrect.get(a.userSubjectId) ?? 0, a.incorrectCount));
    if (!a.correct) itemEverWrong.set(a.userSubjectId, true);
  }

  const transitions = new Map<string, ReturnType<typeof computeTransition>>();
  for (const userSubjectId of userSubjectIds) {
    const row = bySubjectRow.get(userSubjectId);
    if (!row) continue;
    const incorrectCount = itemIncorrect.get(userSubjectId) ?? 0;
    const correct = !itemEverWrong.get(userSubjectId);
    transitions.set(
      userSubjectId,
      computeTransition({
        stage: row.srsStage,
        correct,
        incorrectCount,
        now,
        lastPromotedAt: row.lastPromotedAt,
      }),
    );
  }

  // XP: one award per logged answer (correct or incorrect), scaled by the
  // stage the item was *at* when that answer was given, then scaled again by
  // whether the review actually moved the item. An item whose promotion the
  // 4-hour cooldown blocked pays a token amount: the queue never filters by
  // dueAt, so without this the same items could be re-reviewed back-to-back
  // at full XP indefinitely.
  const answerXp = answers.reduce((sum, a) => {
    const row = bySubjectRow.get(a.userSubjectId);
    const stage = row?.srsStage ?? 1;
    if (!a.correct) return sum + xpForIncorrectAnswer();
    const productive = transitions.get(a.userSubjectId)?.promoted ?? true;
    return sum + scaleXpForProductivity(xpForCorrectAnswer(stage), productive);
  }, 0);
  const multiplier = streakMultiplier(profile.currentStreak);
  const xpAwarded = Math.round(answerXp * multiplier);

  const previousTotalXp = Number(profile.totalXp);
  const newTotalXp = previousTotalXp + xpAwarded;
  const previousLevel = profile.accountLevel;
  const newLevel = levelFromTotalXp(newTotalXp);

  const streak = applyDailyActivity({
    currentStreak: profile.currentStreak,
    longestStreak: profile.longestStreak,
    lastActiveDay: profile.lastActiveDay,
    today,
  });

  const correctAnswers = answers.filter((a) => a.correct).length;
  const accuracyPct = answers.length === 0 ? 100 : Math.round((correctAnswers / answers.length) * 100);
  const itemsCorrect = userSubjectIds.filter((id) => !itemEverWrong.get(id)).length;

  // LP moves on how well the session went, independently of XP. Accuracy is
  // measured per *item* (clean pass, never missed) rather than per question:
  // that is what "got it right" means to a user, and an item you missed once
  // then recovered is not a clean pass.
  const rankBefore: RankState = {
    tier: parseTier(profile.rank),
    division: profile.rankDivision,
    lp: profile.lp,
  };
  const lpOutcome = resolveSession(rankBefore, {
    itemsCorrect,
    itemsTotal: userSubjectIds.length,
  });
  const rankAfter = lpOutcome.after;
  const peakBefore: RankState = {
    tier: parseTier(profile.peakRank),
    division: profile.peakRankDivision,
    lp: 0,
  };
  const newPeak = outranks(rankAfter, peakBefore) ? rankAfter : peakBefore;

  const result = await prisma.$transaction(async (tx) => {
    const session = await tx.session.create({
      data: {
        userId,
        kind: "REVIEW",
        scope: { userSubjectIds },
        startedAt: now,
        completedAt: now,
        totalItems: userSubjectIds.length,
        correctItems: userSubjectIds.filter((id) => !itemEverWrong.get(id)).length,
        scorePct: accuracyPct,
        xpAwarded,
      },
    });

    const itemOutcomes: ReviewItemOutcome[] = [];

    for (const userSubjectId of userSubjectIds) {
      const row = bySubjectRow.get(userSubjectId);
      const transition = transitions.get(userSubjectId);
      if (!row || !transition) continue;

      const itemAnswers = answers.filter((a) => a.userSubjectId === userSubjectId);
      for (const answer of itemAnswers) {
        await tx.reviewLog.create({
          data: {
            userSubjectId,
            sessionId: session.id,
            questionType: answer.questionType,
            incorrectCount: answer.incorrectCount,
            startedStage: transition.startedStage,
            endedStage: transition.endedStage,
            answeredAt: now,
          },
        });
      }

      // Mastery never decreases, so it is farmable the same way account XP
      // is; scale it by productivity for the same reason.
      const masteryXpGain = itemAnswers
        .filter((a) => a.correct)
        .reduce((sum) => sum + scaleXpForProductivity(masteryXpForAnswer(row.srsStage), transition.promoted), 0);
      const newMasteryXp = row.masteryXp + masteryXpGain;

      const meaningCorrectDelta = itemAnswers.filter((a) => a.questionType === "MEANING" && a.correct).length;
      const meaningIncorrectDelta = itemAnswers.filter((a) => a.questionType === "MEANING" && !a.correct).length;
      const readingCorrectDelta = itemAnswers.filter((a) => a.questionType === "READING" && a.correct).length;
      const readingIncorrectDelta = itemAnswers.filter((a) => a.questionType === "READING" && !a.correct).length;

      const reachedGuru = transition.endedStage >= GURU_STAGE && row.srsStage < GURU_STAGE;
      const reachedBurned = transition.endedStage >= BURNED_STAGE && row.srsStage < BURNED_STAGE;

      await tx.userSubject.update({
        where: { id: userSubjectId },
        data: {
          srsStage: transition.endedStage,
          dueAt: transition.dueAt,
          lastPromotedAt: transition.lastPromotedAt,
          passedAt: reachedGuru ? now : row.passedAt,
          burnedAt: reachedBurned ? now : row.burnedAt,
          meaningCorrect: { increment: meaningCorrectDelta },
          meaningIncorrect: { increment: meaningIncorrectDelta },
          readingCorrect: { increment: readingCorrectDelta },
          readingIncorrect: { increment: readingIncorrectDelta },
          masteryXp: newMasteryXp,
          masteryLevel: masteryLevelFromXp(newMasteryXp),
        },
      });

      itemOutcomes.push({
        userSubjectId,
        subjectId: row.subjectId,
        startedStage: transition.startedStage,
        endedStage: transition.endedStage,
        promoted: transition.promoted,
        reachedGuru,
        reachedBurned,
      });
    }

    if (xpAwarded !== 0) {
      await tx.xpEvent.create({
        data: { userId, amount: xpAwarded, reason: "review", sessionId: session.id },
      });
    }

    await tx.dailyActivity.upsert({
      where: { userId_day: { userId, day: today } },
      update: { reviewCount: { increment: userSubjectIds.length }, xpEarned: { increment: xpAwarded } },
      create: { userId, day: today, reviewCount: userSubjectIds.length, xpEarned: xpAwarded },
    });

    await tx.userProfile.update({
      where: { userId },
      data: {
        totalXp: BigInt(newTotalXp),
        accountLevel: newLevel,
        rank: rankAfter.tier,
        rankDivision: rankAfter.division,
        lp: rankAfter.lp,
        peakRank: newPeak.tier,
        peakRankDivision: newPeak.division,
        currentStreak: streak.currentStreak,
        longestStreak: streak.longestStreak,
        lastActiveDay: streak.lastActiveDay,
      },
    });

    if (lpOutcome.delta !== 0) {
      await tx.lpEvent.create({
        data: {
          userId,
          delta: lpOutcome.delta,
          reason: "review",
          sessionId: session.id,
          accuracy: userSubjectIds.length === 0 ? 0 : itemsCorrect / userSubjectIds.length,
          itemCount: userSubjectIds.length,
          tierAfter: rankAfter.tier,
          divisionAfter: rankAfter.division,
          lpAfter: rankAfter.lp,
        },
      });
    }

    return { sessionId: session.id, itemOutcomes };
  });

  // Freshly-Guru'd kanji may have just pushed the KANJI *curriculum* level
  // forward (the 90%-at-Guru rule), which is what gates newly-unlocked
  // subjects. This is deliberately kept separate from `accountLevel`:
  // accountLevel is a pure function of totalXp and nothing else writes it.
  // Conflating the two used to let a review raise accountLevel and a later
  // lesson commit — recomputing from totalXp alone — silently roll it back.
  const unlockLevel = await curriculumLevelForUnlocks(userId);
  const newlyUnlockedSubjectIds = await findNewlyUnlockedSubjects(userId, unlockLevel);

  try {
    revalidatePath("/lessons");
    revalidatePath("/reviews");
    revalidatePath("/");
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
    previousRank: { tier: rankBefore.tier, division: rankBefore.division },
    newRank: { tier: rankAfter.tier, division: rankAfter.division },
    rankPromoted: lpOutcome.change === "promoted",
    rankDemoted: lpOutcome.change === "demoted",
    lpDelta: lpOutcome.delta,
    lpAfter: rankAfter.lp,
    lpBonus: lpOutcome.bonus,
    newlyUnlockedSubjectIds,
    itemOutcomes: result.itemOutcomes,
    itemsReviewed: userSubjectIds.length,
    accuracyPct,
    itemsCorrect,
  };
}

export interface CommitUnrankedSessionResult {
  sessionId: string;
  itemsReviewed: number;
  /// Percentage of individual questions answered correctly.
  accuracyPct: number;
  /// Items answered cleanly (never missed at any point in the session).
  itemsCorrect: number;
  /// Per-item correct/total, so the summary can show what needs work. No
  /// stage data: unranked never moves an item's stage.
  itemResults: { userSubjectId: string; correct: number; total: number }[];
}

/// Commits an UNRANKED (practice) session. Deliberately does far less than
/// commitReviewSession: it records that the practice happened and nothing
/// else.
///
/// Specifically it does NOT touch:
/// - XP or account level (unranked is not a progression path)
/// - masteryXp or masteryLevel (mastery never decreases, so awarding it here
///   would be farmable by simply practicing the same item repeatedly)
/// - srsStage, dueAt, lastPromotedAt, passedAt, burnedAt (no promotion, and
///   crucially no demotion — practicing a weak item must be risk-free, or
///   users avoid the items they most need to drill)
/// - streak / DailyActivity XP
///
/// It DOES log each answer to ReviewLog with startedStage == endedStage, so
/// per-item accuracy stats stay honest, and it records a Session row for
/// history. The correct/incorrect counters on UserSubject are updated too,
/// since those are descriptive stats rather than progression.
export async function commitUnrankedReviewSession(
  input: CommitReviewSessionInput,
  userId: string = APP_USER_ID,
): Promise<CommitUnrankedSessionResult> {
  const { answers } = input;
  const now = new Date();

  const userSubjectIds = Array.from(new Set(answers.map((a) => a.userSubjectId)));
  if (userSubjectIds.length === 0) {
    throw new Error("commitUnrankedReviewSession called with no answers");
  }

  const profile = await getOrCreateProfile(userId);
  const today = dayInTimezone(now, profile.timezone);

  const userSubjects = await prisma.userSubject.findMany({
    where: { id: { in: userSubjectIds }, userId },
    select: { id: true, srsStage: true },
  });
  const stageById = new Map(userSubjects.map((u) => [u.id, u.srsStage]));

  const correctAnswers = answers.filter((a) => a.correct).length;
  const accuracyPct = answers.length === 0 ? 100 : Math.round((correctAnswers / answers.length) * 100);
  const itemEverWrong = new Map<string, boolean>();
  for (const a of answers) {
    if (!a.correct) itemEverWrong.set(a.userSubjectId, true);
  }

  const result = await prisma.$transaction(async (tx) => {
    const session = await tx.session.create({
      data: {
        userId,
        kind: "REVIEW",
        // Distinguishes practice sessions from ranked ones in history; the
        // SessionKind enum stays as-is so this needs no migration.
        scope: { userSubjectIds, unranked: true },
        startedAt: now,
        completedAt: now,
        totalItems: userSubjectIds.length,
        correctItems: userSubjectIds.filter((id) => !itemEverWrong.get(id)).length,
        scorePct: accuracyPct,
        xpAwarded: 0,
      },
    });

    const itemResults: CommitUnrankedSessionResult["itemResults"] = [];

    for (const userSubjectId of userSubjectIds) {
      const stage = stageById.get(userSubjectId);
      if (stage === undefined) continue;

      const itemAnswers = answers.filter((a) => a.userSubjectId === userSubjectId);
      for (const answer of itemAnswers) {
        await tx.reviewLog.create({
          data: {
            userSubjectId,
            sessionId: session.id,
            questionType: answer.questionType,
            incorrectCount: answer.incorrectCount,
            // Unchanged on both sides: this review moved nothing.
            startedStage: stage,
            endedStage: stage,
            answeredAt: now,
          },
        });
      }

      await tx.userSubject.update({
        where: { id: userSubjectId },
        data: {
          meaningCorrect: { increment: itemAnswers.filter((a) => a.questionType === "MEANING" && a.correct).length },
          meaningIncorrect: { increment: itemAnswers.filter((a) => a.questionType === "MEANING" && !a.correct).length },
          readingCorrect: { increment: itemAnswers.filter((a) => a.questionType === "READING" && a.correct).length },
          readingIncorrect: { increment: itemAnswers.filter((a) => a.questionType === "READING" && !a.correct).length },
        },
      });

      itemResults.push({
        userSubjectId,
        correct: itemAnswers.filter((a) => a.correct).length,
        total: itemAnswers.length,
      });
    }

    // Practice still counts as showing up for the day's activity, but
    // contributes no XP.
    await tx.dailyActivity.upsert({
      where: { userId_day: { userId, day: today } },
      update: { reviewCount: { increment: userSubjectIds.length } },
      create: { userId, day: today, reviewCount: userSubjectIds.length, xpEarned: 0 },
    });

    return { sessionId: session.id, itemResults };
  });

  try {
    revalidatePath("/reviews");
    revalidatePath("/reviews/practice");
    revalidatePath("/");
  } catch {
    // See commitReviewSession.
  }

  return {
    sessionId: result.sessionId,
    itemsReviewed: userSubjectIds.length,
    accuracyPct,
    itemsCorrect: userSubjectIds.filter((id) => !itemEverWrong.get(id)).length,
    itemResults: result.itemResults,
  };
}

/// The level to gate newly-unlocked subjects against, after this commit.
///
/// This is the KANJI *curriculum* level (see getCurriculumLevels), not the
/// account level. The 90%-of-this-level's-kanji-at-Guru rule that
/// `nextUserLevel` implements is a curriculum concept: it decides which
/// level's content you have earned access to. Account level is XP, and the
/// two must not be conflated.
///
/// `getCurriculumLevels` already walks the ladder from level 1 and returns
/// the highest contiguous level whose 90% threshold is met, so it subsumes
/// the single-level `nextUserLevel` step this used to do by hand — and it
/// grades the right level's kanji, which the old code did not when the
/// account level had drifted away from the curriculum level.
async function curriculumLevelForUnlocks(userId: string): Promise<number> {
  const levels = await getCurriculumLevels(userId);
  return levels[SubjectType.KANJI];
}

/// Same shape as the lesson commit's unlock check: candidates at or below
/// the (possibly just-advanced) user level with no started UserSubject yet,
/// filtered by isSubjectUnlocked against their components' current stages.
async function findNewlyUnlockedSubjects(userId: string, userLevel: number): Promise<string[]> {
  const candidates = await prisma.subject.findMany({
    where: {
      type: { in: [SubjectType.RADICAL, SubjectType.KANJI, SubjectType.VOCAB] },
      level: { not: null, lte: userLevel },
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
        userLevel,
      ),
    )
    .map((c) => c.id);
}
