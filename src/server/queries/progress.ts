import { prisma } from "@/lib/db";
import { SubjectType } from "@/generated/prisma/enums";
import { getOrCreateProfile } from "@/server/queries/profile";
import { getCurriculumLevels } from "@/server/queries/curriculum";
import { STAGES, GURU_STAGE } from "@/services/srs/stages";
import { buildForecast, type ForecastBucket } from "@/services/reviews/forecast";
import { buildReviewStats, type ReviewStats, type ReviewStatsMode } from "@/services/reviews/stats";
import { parseTier, type Rank } from "@/services/rank/tiers";
import { totalXpToReach } from "@/services/xp/curve";
import { accountMasteryLevel, masteryTier, masteryProgress, type MasteryTier } from "@/services/xp/mastery";

import { APP_USER_ID } from "@/lib/appUser";

// Same laddered denominators the dashboard uses — see
// src/server/queries/dashboard.ts's UNSEEDED_DENOMINATORS/RADICAL_TOTAL for
// why radicals are a fixed constant while kanji/vocab totals come live from
// the DB (level: not null filters out off-ladder/"Additional" rows so the
// laddered denominator matches the curriculum, not the whole seeded set).
const RADICAL_TOTAL = 190;

// Same treatment for KANA — see dashboard.ts's KANA_TOTAL.
const KANA_TOTAL = 208;

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

export interface NearPromotionItem {
  userSubjectId: string;
  subjectId: string;
  slug: string;
  characters: string | null;
  /// Primary English meaning, for items whose `characters` is null or whose
  /// glyph alone isn't recognisable.
  meaning: string | null;
  srsStage: number;
  stageName: string;
  /// The stage this item moves to on its next correct review.
  nextStage: number;
  nextStageName: string;
  dueAt: Date | null;
  /// True when this promotion would cross into Guru (stage 5), which is what
  /// unlocks dependent subjects.
  unlocksAtGuru: boolean;
}

export interface NearPromotionGroup {
  type: SubjectType;
  labelEn: string;
  labelJa: string;
  items: NearPromotionItem[];
  /// Total items of this type one correct review from promoting, which may
  /// exceed `items.length` since the list is capped for display.
  total: number;
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
    rank: Rank;
    lp: number;
    accountMasteryXp: number;
    accountMasteryLevel: number;
    masteryTier: MasteryTier;
    masteryXpIntoLevel: number;
    masteryXpForNextLevel: number;
  };
}

export async function getProgress(userId: string = APP_USER_ID): Promise<ProgressData> {
  const profile = await getOrCreateProfile(userId);
  // KANJI's own curriculum level (per-type, not the shared accountLevel —
  // see curriculum.ts) is what levelKanji below needs to query the right
  // level's kanji for the advancement-progress panel.
  const curriculumLevels = await getCurriculumLevels(userId);
  const kanjiCurriculumLevel = curriculumLevels[SubjectType.KANJI];

  const [
    kanjiTotal,
    vocabTotal,
    sentenceTotal,
    grammarTotal,
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
    prisma.subject.count({ where: { type: SubjectType.GRAMMAR, level: { not: null } } }),
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
      where: { userId, subject: { type: SubjectType.KANJI, level: kanjiCurriculumLevel } },
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
    { type: SubjectType.KANA, labelEn: "Kana", labelJa: "かな", passed: passedByType.KANA, started: startedByType.KANA, total: KANA_TOTAL },
    { type: SubjectType.RADICAL, labelEn: "Radicals", labelJa: "部首", passed: passedByType.RADICAL, started: startedByType.RADICAL, total: RADICAL_TOTAL },
    { type: SubjectType.KANJI, labelEn: "Kanji", labelJa: "漢字", passed: passedByType.KANJI, started: startedByType.KANJI, total: kanjiTotal },
    { type: SubjectType.VOCAB, labelEn: "Vocabulary", labelJa: "語彙", passed: passedByType.VOCAB, started: startedByType.VOCAB, total: vocabTotal },
    { type: SubjectType.SENTENCE, labelEn: "Sentences", labelJa: "例文", passed: passedByType.SENTENCE, started: startedByType.SENTENCE, total: sentenceTotal },
    { type: SubjectType.GRAMMAR, labelEn: "Grammar", labelJa: "文法", passed: passedByType.GRAMMAR, started: startedByType.GRAMMAR, total: grammarTotal },
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
    currentLevel: kanjiCurriculumLevel,
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

  const rank: Rank = { tier: parseTier(profile.rank), division: profile.rankDivision };
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
      lp: profile.lp,
      accountMasteryXp,
      accountMasteryLevel: accountMasteryLevelValue,
      masteryTier: tier,
      masteryXpIntoLevel: masteryProg.xpIntoLevel,
      masteryXpForNextLevel: masteryProg.xpForNextLevel,
    },
  };
}

async function bucketByType(subjectIds: string[]) {
  const result: Record<"KANA" | "RADICAL" | "KANJI" | "VOCAB" | "SENTENCE" | "GRAMMAR", number> = {
    KANA: 0,
    RADICAL: 0,
    KANJI: 0,
    VOCAB: 0,
    SENTENCE: 0,
    GRAMMAR: 0,
  };
  if (subjectIds.length === 0) return result;

  const rows = await prisma.subject.findMany({
    where: { id: { in: subjectIds } },
    select: { type: true },
  });
  for (const row of rows) {
    if (row.type === SubjectType.KANA) result.KANA += 1;
    else if (row.type === SubjectType.RADICAL) result.RADICAL += 1;
    else if (row.type === SubjectType.KANJI) result.KANJI += 1;
    else if (row.type === SubjectType.VOCAB) result.VOCAB += 1;
    else if (row.type === SubjectType.SENTENCE) result.SENTENCE += 1;
    else if (row.type === SubjectType.GRAMMAR) result.GRAMMAR += 1;
  }
  return result;
}

// Display labels per type, matching the OverallProgressRow labels above so
// the same subject reads identically wherever it appears.
const TYPE_LABELS: Record<string, { en: string; ja: string }> = {
  KANA: { en: "Kana", ja: "かな" },
  RADICAL: { en: "Radicals", ja: "部首" },
  KANJI: { en: "Kanji", ja: "漢字" },
  VOCAB: { en: "Vocabulary", ja: "語彙" },
  SENTENCE: { en: "Sentences", ja: "例文" },
  GRAMMAR: { en: "Grammar", ja: "文法" },
  READING: { en: "Reading", ja: "読解" },
};

// Order groups the way the curriculum progresses rather than alphabetically.
const TYPE_ORDER: SubjectType[] = [
  SubjectType.KANA,
  SubjectType.RADICAL,
  SubjectType.KANJI,
  SubjectType.VOCAB,
  SubjectType.GRAMMAR,
  SubjectType.SENTENCE,
];

/// Items that are one correct review away from moving up an SRS stage,
/// grouped by subject type.
///
/// "Close to ranking up" means exactly that: every started, non-burned item
/// is one correct answer from its next stage, so what actually distinguishes
/// them is *readiness* — whether the item is due now, and how big the jump
/// is. Ordering therefore puts due items first (you can act on them
/// immediately), then the soonest-due, and within that the highest stage
/// (the most valuable promotion).
///
/// Items crossing into Guru are flagged: that's the promotion that unlocks
/// dependent subjects, so it's worth more than a plain stage step.
export async function getNearPromotion(
  userId: string = APP_USER_ID,
  perTypeLimit = 5,
  now: Date = new Date(),
): Promise<NearPromotionGroup[]> {
  const rows = await prisma.userSubject.findMany({
    where: { userId, startedAt: { not: null }, srsStage: { gte: 1, lte: 8 } },
    select: {
      id: true,
      srsStage: true,
      dueAt: true,
      subject: { select: { id: true, type: true, slug: true, characters: true, meanings: true } },
    },
  });

  const byType = new Map<SubjectType, NearPromotionItem[]>();

  for (const row of rows) {
    const nextStage = Math.min(row.srsStage + 1, STAGES.length - 1);
    const meanings = row.subject.meanings as { text?: string }[] | null;
    const item: NearPromotionItem = {
      userSubjectId: row.id,
      subjectId: row.subject.id,
      slug: row.subject.slug,
      characters: row.subject.characters,
      meaning: meanings?.[0]?.text ?? null,
      srsStage: row.srsStage,
      stageName: STAGES[row.srsStage].name,
      nextStage,
      nextStageName: STAGES[nextStage].name,
      dueAt: row.dueAt,
      unlocksAtGuru: row.srsStage < GURU_STAGE && nextStage >= GURU_STAGE,
    };
    const type = row.subject.type as SubjectType;
    const list = byType.get(type) ?? [];
    list.push(item);
    byType.set(type, list);
  }

  const groups: NearPromotionGroup[] = [];
  for (const type of TYPE_ORDER) {
    const items = byType.get(type);
    if (!items || items.length === 0) continue;

    items.sort((a, b) => {
      const aDue = a.dueAt === null || a.dueAt <= now;
      const bDue = b.dueAt === null || b.dueAt <= now;
      if (aDue !== bDue) return aDue ? -1 : 1;
      // Both due, or both pending: soonest first. Nulls sort as "due now".
      const aTime = a.dueAt?.getTime() ?? 0;
      const bTime = b.dueAt?.getTime() ?? 0;
      if (aTime !== bTime) return aTime - bTime;
      // Same readiness: the bigger promotion first.
      return b.srsStage - a.srsStage;
    });

    const labels = TYPE_LABELS[type] ?? { en: type, ja: "" };
    groups.push({
      type,
      labelEn: labels.en,
      labelJa: labels.ja,
      items: items.slice(0, perTypeLimit),
      total: items.length,
    });
  }

  return groups;
}

/// When existing SRS reviews are scheduled to come due, bucketed into fixed
/// windows (see `buildForecast`). Purely a readout of already-scheduled
/// dueAt values — it does not project future review volume based on user
/// behavior.
export async function getReviewForecast(userId: string = APP_USER_ID, now: Date = new Date()): Promise<ForecastBucket[]> {
  const rows = await prisma.userSubject.findMany({
    where: { userId, startedAt: { not: null }, dueAt: { not: null }, srsStage: { gte: 1, lte: 8 } },
    select: { dueAt: true },
  });

  return buildForecast({ dueAts: rows.map((r) => r.dueAt as Date), now });
}

/// Review accuracy split by question type and trended over time, from every
/// ReviewLog row belonging to the user's UserSubjects in the last
/// `sinceDays` days. See `buildReviewStats` for the scoring rules.
///
/// `mode` defaults to "ranked", so unranked practice is fetched but not
/// scored. Practice is unbounded and re-servable (it has no due-date filter),
/// so folding it into one accuracy number would let repeated drilling of easy
/// items mask ranked performance. The returned `rankedAnswers` and
/// `practiceAnswers` still describe every row fetched, so the UI can show
/// what was left out. Pass "all" to score both together.
export async function getReviewStats(
  userId: string = APP_USER_ID,
  sinceDays = 30,
  mode: ReviewStatsMode = "ranked",
): Promise<ReviewStats> {
  const since = new Date(Date.now() - sinceDays * 24 * 60 * 60 * 1000);

  const rows = await prisma.reviewLog.findMany({
    where: { answeredAt: { gte: since }, userSubject: { userId } },
    select: { questionType: true, incorrectCount: true, startedStage: true, endedStage: true, answeredAt: true },
  });

  return buildReviewStats({ logs: rows, mode });
}
