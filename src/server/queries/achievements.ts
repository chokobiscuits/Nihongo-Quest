import { prisma } from "@/lib/db";
import { SubjectType } from "@/generated/prisma/enums";
import { getOrCreateProfile } from "@/server/queries/profile";
import { parseTier } from "@/services/rank/tiers";
import { accountMasteryLevel } from "@/services/xp/mastery";
import { GURU_STAGE, BURNED_STAGE } from "@/services/srs/stages";
import { ACHIEVEMENTS, type AchievementDefinition, type AchievementStats } from "@/services/achievements/definitions";

// Radical count per the roster's "all radicals" achievement — the full
// WaniKani-style radical set (190 laddered + off-ladder/"additional" radicals
// used only as kanji components), distinct from the dashboard's 190-laddered
// denominator.
const ALL_RADICALS_TOTAL = 214;

// Master tier in the srs stage table is stage 7 (see stages.ts's STAGES);
// there is no exported constant for "Master or above" specifically, so it is
// named locally against the same table Guru/Burned already read from.
const MASTER_STAGE = 7;

import { APP_USER_ID } from "@/lib/appUser";

export interface AchievementRow {
  definition: AchievementDefinition;
  progress: number;
  target: number;
  unlocked: boolean;
}

export interface AchievementsData {
  unlocked: AchievementRow[];
  locked: AchievementRow[];
  stats: AchievementStats;
}

/// Computes real progress for every achievement in the roster from live
/// UserSubject/Session/Profile data, then splits into unlocked/locked. Locked
/// achievements are never hidden — the roadmap is the point.
export async function getAchievements(userId: string = APP_USER_ID): Promise<AchievementsData> {
  const profile = await getOrCreateProfile(userId);

  const [passedCounts, stageCounts, sessions, masteryXpAgg, lpEvents] = await Promise.all([
    prisma.userSubject.groupBy({
      by: ["subjectId"],
      where: { userId, passedAt: { not: null } },
      _count: true,
    }),
    prisma.userSubject.findMany({
      where: { userId },
      select: { srsStage: true },
    }),
    prisma.session.findMany({
      where: { userId, completedAt: { not: null } },
      select: { totalItems: true, correctItems: true, scorePct: true, kind: true, scope: true, completedAt: true },
    }),
    prisma.userSubject.aggregate({ where: { userId }, _sum: { masteryXp: true } }),
    prisma.lpEvent.findMany({
      where: { userId },
      select: { delta: true, tierAfter: true, divisionAfter: true },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  const passedSubjectIds = passedCounts.map((r) => r.subjectId);
  const passedByType = await bucketByType(passedSubjectIds);

  const guruOrAboveCount = stageCounts.filter((r) => r.srsStage >= GURU_STAGE).length;
  const masterOrAboveCount = stageCounts.filter((r) => r.srsStage >= MASTER_STAGE).length;
  const burnedCount = stageCounts.filter((r) => r.srsStage >= BURNED_STAGE).length;

  let bestSessionAccuracyPct = 0;
  let largestSessionItemCount = 0;
  let bestLargeSessionAccuracyPct = 0;
  let lessonSessionCount = 0;
  let reviewSessionCount = 0;
  let practiceSessionCount = 0;
  const activeDays = new Set<string>();

  for (const session of sessions) {
    const accuracy =
      session.scorePct ?? (session.totalItems > 0 ? (session.correctItems / session.totalItems) * 100 : 0);
    if (accuracy > bestSessionAccuracyPct) bestSessionAccuracyPct = accuracy;
    if (session.totalItems > largestSessionItemCount) largestSessionItemCount = session.totalItems;
    if (session.totalItems >= 20 && accuracy > bestLargeSessionAccuracyPct) {
      bestLargeSessionAccuracyPct = accuracy;
    }

    // Practice sessions are REVIEW-kind rows flagged in `scope`, since the
    // SessionKind enum was deliberately left alone — see
    // commitUnrankedReviewSession.
    const scope = session.scope as { unranked?: boolean } | null;
    if (session.kind === "LESSON") lessonSessionCount += 1;
    else if (scope?.unranked) practiceSessionCount += 1;
    else if (session.kind === "REVIEW") reviewSessionCount += 1;

    if (session.completedAt) activeDays.add(session.completedAt.toISOString().slice(0, 10));
  }

  // Walk LP history in order to count promotions and spot a recovery (a
  // division regained after one was lost).
  let lpGainedTotal = 0;
  let divisionPromotionCount = 0;
  let tierPromotionCount = 0;
  let hasRecoveredDivision = false;
  let sawDemotion = false;
  let previousTier: string | null = null;
  let previousDivision: number | null = null;

  for (const event of lpEvents) {
    if (event.delta > 0) lpGainedTotal += event.delta;

    if (previousTier !== null) {
      const tierChanged = event.tierAfter !== previousTier;
      const divisionImproved =
        !tierChanged &&
        previousDivision !== null &&
        event.divisionAfter !== null &&
        event.divisionAfter < previousDivision;
      const divisionWorsened =
        !tierChanged &&
        previousDivision !== null &&
        event.divisionAfter !== null &&
        event.divisionAfter > previousDivision;

      if (tierChanged) tierPromotionCount += 1;
      if (tierChanged || divisionImproved) {
        divisionPromotionCount += 1;
        if (sawDemotion) hasRecoveredDivision = true;
      }
      if (divisionWorsened) sawDemotion = true;
    }

    previousTier = event.tierAfter;
    previousDivision = event.divisionAfter;
  }

  const rank = { tier: parseTier(profile.rank), division: profile.rankDivision };
  const masteryLevel = accountMasteryLevel(masteryXpAgg._sum.masteryXp ?? 0);

  const stats: AchievementStats = {
    itemsLearned: passedByType.RADICAL + passedByType.KANJI + passedByType.VOCAB,
    radicalsLearned: passedByType.RADICAL,
    kanjiLearned: passedByType.KANJI,
    vocabLearned: passedByType.VOCAB,
    radicalsTotal: ALL_RADICALS_TOTAL,
    guruOrAboveCount,
    masterOrAboveCount,
    burnedCount,
    currentStreak: profile.currentStreak,
    accountLevel: profile.accountLevel,
    rankTier: rank.tier,
    accountMasteryLevel: masteryLevel,
    bestSessionAccuracyPct: Math.round(bestSessionAccuracyPct),
    largestSessionItemCount,
    lessonSessionCount,
    reviewSessionCount,
    practiceSessionCount,
    activeDayCount: activeDays.size,
    lpGainedTotal,
    divisionPromotionCount,
    tierPromotionCount,
    hasRecoveredDivision,
    bestLargeSessionAccuracyPct: Math.round(bestLargeSessionAccuracyPct),
  };

  const rows: AchievementRow[] = ACHIEVEMENTS.map((definition) => {
    const progress = definition.progress(stats);
    return {
      definition,
      progress,
      target: definition.target,
      unlocked: progress >= definition.target,
    };
  });

  return {
    unlocked: rows.filter((r) => r.unlocked),
    locked: rows.filter((r) => !r.unlocked),
    stats,
  };
}

async function bucketByType(subjectIds: string[]) {
  const result: Record<"RADICAL" | "KANJI" | "VOCAB", number> = { RADICAL: 0, KANJI: 0, VOCAB: 0 };
  if (subjectIds.length === 0) return result;

  const rows = await prisma.subject.findMany({
    where: { id: { in: subjectIds } },
    select: { type: true },
  });
  for (const row of rows) {
    if (row.type === SubjectType.RADICAL) result.RADICAL += 1;
    else if (row.type === SubjectType.KANJI) result.KANJI += 1;
    else if (row.type === SubjectType.VOCAB) result.VOCAB += 1;
  }
  return result;
}
