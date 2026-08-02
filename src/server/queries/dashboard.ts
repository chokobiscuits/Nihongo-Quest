import { prisma } from "@/lib/db";
import { SubjectType } from "@/generated/prisma/enums";
import { getOrCreateProfile } from "@/server/queries/profile";
import { rankForLevel } from "@/services/xp/rank";
import { isGuruOrAbove } from "@/services/srs/stages";
import { totalXpToReach, xpForLevel } from "@/services/xp/curve";

// Static denominators for content types that aren't seeded/laddered yet
// (grammar, sentences, readings have no Subject rows to count). Radical,
// Kanji, and Vocab denominators come from the DB instead, since those are
// laddered content already loaded by the seed scripts.
const UNSEEDED_DENOMINATORS: Record<"GRAMMAR" | "SENTENCE" | "READING", number> = {
  GRAMMAR: 856,
  SENTENCE: 2500,
  READING: 320,
};

export interface DashboardProgressRow {
  type: SubjectType;
  labelEn: string;
  labelJa: string;
  learned: number;
  total: number;
}

export interface DashboardContinueCard {
  type: SubjectType;
  labelEn: string;
  labelJa: string;
  glyph: string;
  /// Null when this content type has no seeded data yet (grammar, sentence,
  /// reading) — renders as a "Coming soon" placeholder card instead.
  seeded: boolean;
  lessonNumber: number | null;
  percent: number | null;
}

export interface DashboardReviewTypeCount {
  type: SubjectType;
  labelEn: string;
  count: number;
}

export interface DashboardAchievement {
  id: string;
  titleJa: string;
  requirementEn: string;
  progress: number;
  target: number;
}

export interface DashboardData {
  displayName: string;
  accountLevel: number;
  totalXp: number;
  xpForCurrentLevel: number;
  xpIntoCurrentLevel: number;
  currentStreak: number;
  rank: ReturnType<typeof rankForLevel>;
  masteryLabel: string;
  progress: DashboardProgressRow[];
  continueCards: DashboardContinueCard[];
  reviewsDue: number;
  reviewsByType: DashboardReviewTypeCount[];
  achievements: DashboardAchievement[];
  streakDays: { date: Date; active: boolean; isToday: boolean }[];
}

/// Single aggregated read for the whole dashboard. Every panel gets a
/// fully-populated object with real denominators — zeroed counts render as
/// designed empty states, not null branches per-panel.
export async function getDashboard(userId: string): Promise<DashboardData> {
  const profile = await getOrCreateProfile(userId);

  // radicalTotal (182 laddered) isn't shown as its own Progress Overview
  // legend row per the sheet, but is fetched alongside the other ladder
  // counts for parity and to keep this the one place ladder denominators
  // are read from.
  const [, kanjiTotal, vocabTotal, learnedCounts, dueCounts] = await Promise.all([
    prisma.subject.count({ where: { type: SubjectType.RADICAL, level: { not: null } } }),
    prisma.subject.count({ where: { type: SubjectType.KANJI, level: { not: null } } }),
    prisma.subject.count({ where: { type: SubjectType.VOCAB, level: { not: null } } }),
    prisma.userSubject.groupBy({
      by: ["subjectId"],
      where: { userId, passedAt: { not: null } },
      _count: true,
    }),
    prisma.userSubject.findMany({
      where: { userId, dueAt: { not: null, lte: new Date() } },
      select: { subject: { select: { type: true } } },
    }),
  ]);

  // groupBy above only tells us which subjectIds passed; join subject type
  // via a second lookup keyed on those ids to bucket learned counts by type.
  const passedSubjectIds = learnedCounts.map((r) => r.subjectId);
  const passedByType = await bucketByType(passedSubjectIds);

  const rank = rankForLevel(profile.accountLevel);

  const progress: DashboardProgressRow[] = [
    { type: SubjectType.KANJI, labelEn: "Kanji", labelJa: "漢字", learned: passedByType.KANJI, total: kanjiTotal },
    { type: SubjectType.VOCAB, labelEn: "Vocabulary", labelJa: "語彙", learned: passedByType.VOCAB, total: vocabTotal },
    { type: SubjectType.GRAMMAR, labelEn: "Grammar", labelJa: "文法", learned: 0, total: UNSEEDED_DENOMINATORS.GRAMMAR },
    { type: SubjectType.SENTENCE, labelEn: "Sentences", labelJa: "例文", learned: 0, total: UNSEEDED_DENOMINATORS.SENTENCE },
    { type: SubjectType.READING, labelEn: "Readings", labelJa: "読解", learned: 0, total: UNSEEDED_DENOMINATORS.READING },
  ];

  const continueCards: DashboardContinueCard[] = [
    { type: SubjectType.KANJI, labelEn: "Kanji", labelJa: "かんじ", glyph: "漢字", seeded: true, lessonNumber: seededLessonNumber(passedByType.KANJI), percent: percentOf(passedByType.KANJI, kanjiTotal) },
    { type: SubjectType.VOCAB, labelEn: "Vocabulary", labelJa: "ごい", glyph: "語彙", seeded: true, lessonNumber: seededLessonNumber(passedByType.VOCAB), percent: percentOf(passedByType.VOCAB, vocabTotal) },
    { type: SubjectType.GRAMMAR, labelEn: "Grammar", labelJa: "ぶんぽう", glyph: "文法", seeded: false, lessonNumber: null, percent: null },
    { type: SubjectType.READING, labelEn: "Text Reading", labelJa: "ぶんしょうどっかい", glyph: "読解", seeded: false, lessonNumber: null, percent: null },
    { type: SubjectType.SENTENCE, labelEn: "Review", labelJa: "ふくしゅう", glyph: "復習", seeded: false, lessonNumber: null, percent: null },
  ];

  const dueTypeCounts = new Map<SubjectType, number>();
  for (const row of dueCounts) {
    const t = row.subject.type;
    dueTypeCounts.set(t, (dueTypeCounts.get(t) ?? 0) + 1);
  }
  const reviewsByType: DashboardReviewTypeCount[] = [
    SubjectType.RADICAL,
    SubjectType.KANJI,
    SubjectType.VOCAB,
    SubjectType.GRAMMAR,
    SubjectType.SENTENCE,
  ].map((type) => ({
    type,
    labelEn: labelForType(type),
    count: dueTypeCounts.get(type) ?? 0,
  }));
  const reviewsDue = reviewsByType.reduce((acc, r) => acc + r.count, 0);

  const totalLearned = passedByType.RADICAL + passedByType.KANJI + passedByType.VOCAB;

  const achievements: DashboardAchievement[] = [
    { id: "beginner", titleJa: "初学者", requirementEn: "Reach Level 10", progress: profile.accountLevel, target: 10 },
    { id: "kanji-master", titleJa: "漢字マスター", requirementEn: "Learn 1000 kanji", progress: passedByType.KANJI, target: 1000 },
    { id: "vocab-king", titleJa: "語彙王", requirementEn: "Learn 5000 vocabulary", progress: passedByType.VOCAB, target: 5000 },
    { id: "perseverance", titleJa: "継続は力なり", requirementEn: "365日連続！", progress: profile.currentStreak, target: 365 },
    { id: "master", titleJa: "日本語の達人", requirementEn: "Reach Mastery ∞", progress: totalLearned, target: Number.POSITIVE_INFINITY },
  ];

  const streakDays = buildStreakDays(profile.currentStreak);

  return {
    displayName: profile.displayName,
    accountLevel: profile.accountLevel,
    totalXp: Number(profile.totalXp),
    xpForCurrentLevel: totalXpToReach(profile.accountLevel + 1),
    xpIntoCurrentLevel: Number(profile.totalXp),
    currentStreak: profile.currentStreak,
    rank,
    masteryLabel: totalLearned > 0 ? `Mastery ${totalLearned}` : "Mastery ∞",
    progress,
    continueCards,
    reviewsDue,
    reviewsByType,
    achievements,
    streakDays,
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

function labelForType(type: SubjectType): string {
  switch (type) {
    case SubjectType.RADICAL: return "Radicals";
    case SubjectType.KANJI: return "Kanji";
    case SubjectType.VOCAB: return "Vocabulary";
    case SubjectType.GRAMMAR: return "Grammar";
    case SubjectType.SENTENCE: return "Sentences";
    case SubjectType.READING: return "Readings";
  }
}

function percentOf(learned: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round((learned / total) * 100);
}

function seededLessonNumber(learned: number): number {
  return Math.floor(learned / 10) + 1;
}

// Import guard: isGuruOrAbove and xpForLevel are reserved for a future
// per-stage/per-level breakdown; keep the imports so extending this query
// doesn't require re-deriving stage/level thresholds elsewhere.
void isGuruOrAbove;
void xpForLevel;

/// Last 5 days including today, oldest first. `active` only reflects the
/// unbroken tail of the current streak ending today — good enough for the
/// widget's "last N days" flame row without a full DailyActivity query.
function buildStreakDays(currentStreak: number) {
  const days: { date: Date; active: boolean; isToday: boolean }[] = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  for (let i = 4; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    days.push({ date, active: currentStreak > 0 && i < currentStreak, isToday: i === 0 });
  }
  return days;
}
