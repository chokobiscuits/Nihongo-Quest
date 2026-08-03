import { prisma } from "@/lib/db";
import { SubjectType } from "@/generated/prisma/enums";
import { getOrCreateProfile } from "@/server/queries/profile";
import { STAGES, GURU_STAGE } from "@/services/srs/stages";
import { rankForLevel } from "@/services/xp/rank";
import { totalXpToReach } from "@/services/xp/curve";
import { accountMasteryLevel, masteryTier, masteryProgress, type MasteryTier } from "@/services/xp/mastery";

const APP_USER_ID = process.env.APP_USER_ID ?? "local-user";

// Same laddered denominators the dashboard uses — see
// src/server/queries/dashboard.ts's UNSEEDED_DENOMINATORS/RADICAL_TOTAL for
// why radicals are a fixed constant while kanji/vocab totals come live from
// the DB (level: not null filters out off-ladder/"Additional" rows so the
// laddered denominator matches the curriculum, not the whole seeded set).
const RADICAL_TOTAL = 190;

export interface OverallProgressRow {
  type: SubjectType;
  labelEn: string;
  labelJa: string;
  passed: number;
  started: number;
  total: number;
}

export interface SrsDistributionRow {
  stage: number;
  name: string;
  count: number;
}

export interface JlptProgressRow {
  level: number; // 5..1 (N5..N1)
  passed: number;
  total: number; // JLPT-tagged items only, not the whole kanji/vocab set
}

export interface LevelProgress {
  currentLevel: number;
  levelKanjiTotal: number;
  levelKanjiGuruOrAbove: number;
  /// 0-100. Advancement requires >= 90 (see src/services/srs/unlock.ts).
  percentToAdvance: number;
}

export interface ActivityDay {
  date: Date;
  xpEarned: number;
  reviewCount: number;
  lessonCount: number;
}

export interface ProgressData {
  overall: OverallProgressRow[];
  srsDistribution: SrsDistributionRow[];
  srsDistributionTotal: number;
  jlpt: JlptProgressRow[];
  jlptTaggedNote: string;
  level: LevelProgress;
  activity: ActivityDay[];
  account: {
    totalXp: number;
    accountLevel: number;
    xpIntoCurrentLevel: number;
    xpForCurrentLevel: number;
    rank: ReturnType<typeof rankForLevel>;
    accountMasteryXp: number;
    accountMasteryLevel: number;
    masteryTier: MasteryTier;
    masteryXpIntoLevel: number;
    masteryXpForNextLevel: number;
  };
}

export async function getProgress(userId: string = APP_USER_ID): Promise<ProgressData> {
  const profile = await getOrCreateProfile(userId);

  const [
    kanjiTotal,
    vocabTotal,
    sentenceTotal,
    passedRows,
    startedRows,
    stageRows,
    jlptTotals,
    jlptPassed,
    levelKanji,
    activityRows,
    masteryXpAgg,
  ] = await Promise.all([
    prisma.subject.count({ where: { type: SubjectType.KANJI, level: { not: null } } }),
    prisma.subject.count({ where: { type: SubjectType.VOCAB, level: { not: null } } }),
    prisma.subject.count({ where: { type: SubjectType.SENTENCE, level: { not: null } } }),
    prisma.userSubject.findMany({
      where: { userId, passedAt: { not: null } },
      select: { subjectId: true },
    }),
    prisma.userSubject.findMany({
      where: { userId, startedAt: { not: null } },
      select: { subjectId: true },
    }),
    prisma.userSubject.groupBy({
      by: ["srsStage"],
      where: { userId, startedAt: { not: null } },
      _count: true,
    }),
    prisma.subject.groupBy({
      by: ["jlpt"],
      where: { jlpt: { not: null }, type: { in: [SubjectType.KANJI, SubjectType.VOCAB] } },
      _count: true,
    }),
    // JLPT-tagged items the user has passed — joined below via subjectId set.
    prisma.userSubject.findMany({
      where: { userId, passedAt: { not: null }, subject: { jlpt: { not: null } } },
      select: { subject: { select: { jlpt: true } } },
    }),
    prisma.userSubject.findMany({
      where: { userId, subject: { type: SubjectType.KANJI, level: profile.accountLevel } },
      select: { srsStage: true },
    }),
    prisma.dailyActivity.findMany({
      where: { userId },
      orderBy: { day: "asc" },
    }),
    prisma.userSubject.aggregate({ where: { userId }, _sum: { masteryXp: true } }),
  ]);

  const passedByType = await bucketByType(passedRows.map((r) => r.subjectId));
  const startedByType = await bucketByType(startedRows.map((r) => r.subjectId));

  const overall: OverallProgressRow[] = [
    { type: SubjectType.RADICAL, labelEn: "Radicals", labelJa: "部首", passed: passedByType.RADICAL, started: startedByType.RADICAL, total: RADICAL_TOTAL },
    { type: SubjectType.KANJI, labelEn: "Kanji", labelJa: "漢字", passed: passedByType.KANJI, started: startedByType.KANJI, total: kanjiTotal },
    { type: SubjectType.VOCAB, labelEn: "Vocabulary", labelJa: "語彙", passed: passedByType.VOCAB, started: startedByType.VOCAB, total: vocabTotal },
    { type: SubjectType.SENTENCE, labelEn: "Sentences", labelJa: "例文", passed: passedByType.SENTENCE, started: startedByType.SENTENCE, total: sentenceTotal },
  ];

  // SRS distribution: stages 1-9 (Apprentice I through Burned). Stage 0
  // (Lesson) is excluded from `startedAt: not null` above by construction —
  // items reach stage 1 the moment they're taught, so stage 0 never appears
  // here. Every stage is represented even at 0 so the bar never collapses.
  const countByStage = new Map<number, number>();
  for (const row of stageRows) countByStage.set(row.srsStage, row._count);
  const srsDistribution: SrsDistributionRow[] = STAGES.filter((s) => s.stage >= 1).map((s) => ({
    stage: s.stage,
    name: s.name,
    count: countByStage.get(s.stage) ?? 0,
  }));
  const srsDistributionTotal = srsDistribution.reduce((acc, r) => acc + r.count, 0);

  // JLPT: denominators only count kanji+vocab rows that actually carry a
  // jlpt tag (~2,211 kanji; most vocab is tagged too) — never the full
  // laddered total, which would silently overstate coverage.
  const totalByLevel = new Map<number, number>();
  for (const row of jlptTotals) {
    if (row.jlpt !== null) totalByLevel.set(row.jlpt, (totalByLevel.get(row.jlpt) ?? 0) + row._count);
  }
  const passedByLevel = new Map<number, number>();
  for (const row of jlptPassed) {
    const level = row.subject.jlpt;
    if (level !== null) passedByLevel.set(level, (passedByLevel.get(level) ?? 0) + 1);
  }
  const jlpt: JlptProgressRow[] = [5, 4, 3, 2, 1].map((level) => ({
    level,
    passed: passedByLevel.get(level) ?? 0,
    total: totalByLevel.get(level) ?? 0,
  }));

  const levelKanjiGuruOrAbove = levelKanji.filter((k) => k.srsStage >= GURU_STAGE).length;
  const level: LevelProgress = {
    currentLevel: profile.accountLevel,
    levelKanjiTotal: levelKanji.length,
    levelKanjiGuruOrAbove,
    percentToAdvance: levelKanji.length > 0 ? Math.round((levelKanjiGuruOrAbove / levelKanji.length) * 100) : 0,
  };

  const activity: ActivityDay[] = activityRows.map((row) => ({
    date: row.day,
    xpEarned: row.xpEarned,
    reviewCount: row.reviewCount,
    lessonCount: row.lessonCount,
  }));

  const rank = rankForLevel(profile.accountLevel);
  const accountMasteryXp = masteryXpAgg._sum.masteryXp ?? 0;
  const accountMasteryLevelValue = accountMasteryLevel(accountMasteryXp);
  const tier = masteryTier(accountMasteryLevelValue);
  const masteryProg = masteryProgress(accountMasteryXp);

  return {
    overall,
    srsDistribution,
    srsDistributionTotal,
    jlpt,
    jlptTaggedNote: "Counts only JLPT-tagged kanji and vocabulary — most content has no N-level assigned.",
    level,
    activity,
    account: {
      totalXp: Number(profile.totalXp),
      accountLevel: profile.accountLevel,
      xpIntoCurrentLevel: Number(profile.totalXp) - totalXpToReach(profile.accountLevel),
      xpForCurrentLevel: totalXpToReach(profile.accountLevel + 1) - totalXpToReach(profile.accountLevel),
      rank,
      accountMasteryXp,
      accountMasteryLevel: accountMasteryLevelValue,
      masteryTier: tier,
      masteryXpIntoLevel: masteryProg.xpIntoLevel,
      masteryXpForNextLevel: masteryProg.xpForNextLevel,
    },
  };
}

async function bucketByType(subjectIds: string[]) {
  const result: Record<"RADICAL" | "KANJI" | "VOCAB" | "SENTENCE", number> = {
    RADICAL: 0,
    KANJI: 0,
    VOCAB: 0,
    SENTENCE: 0,
  };
  if (subjectIds.length === 0) return result;

  const rows = await prisma.subject.findMany({
    where: { id: { in: subjectIds } },
    select: { type: true },
  });
  for (const row of rows) {
    if (row.type === SubjectType.RADICAL) result.RADICAL += 1;
    else if (row.type === SubjectType.KANJI) result.KANJI += 1;
    else if (row.type === SubjectType.VOCAB) result.VOCAB += 1;
    else if (row.type === SubjectType.SENTENCE) result.SENTENCE += 1;
  }
  return result;
}
