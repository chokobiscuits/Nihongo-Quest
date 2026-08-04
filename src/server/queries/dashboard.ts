import { prisma } from "@/lib/db";
import { storage } from "@/lib/storage";
import { SubjectType } from "@/generated/prisma/enums";
import { getOrCreateProfile } from "@/server/queries/profile";
import { getReviewQueue } from "@/server/queries/reviews";
import { getTypeUnlockStatuses } from "@/server/queries/curriculum";
import { rankForLevel } from "@/services/xp/rank";
import { isGuruOrAbove } from "@/services/srs/stages";
import { totalXpToReach, xpForLevel } from "@/services/xp/curve";
import { accountMasteryLevel, masteryTier, type MasteryTier } from "@/services/xp/mastery";

// Static denominator for the one content type that still has no Subject
// rows (readings). Grammar and sentences are now real (seed phases 1-3) and
// count live from the DB alongside radical/kanji/vocab — see
// `grammarTotal`/`sentenceTotal` below.
const UNSEEDED_DENOMINATORS: Record<"READING", number> = {
  READING: 320,
};

// Radicals aren't seeded via Subject rows with the other ladder content's
// denominator source in this query, but the ladder is fixed at 190 laddered
// radicals — kept alongside the other unseeded denominators for the one row
// that has no `passed`/`started` distinction worth a live count against a
// changing total.
const RADICAL_TOTAL = 190;

// Same treatment for KANA: laddered total is fixed by the hand-encoded
// character set (see scripts/seed/lib/kana.ts / kana-level.ts), not a
// dictionary-derived count that changes on reseed.
const KANA_TOTAL = 208;

export interface DashboardProgressRow {
  type: SubjectType;
  labelEn: string;
  labelJa: string;
  /// Reached Guru (or beyond) — the "mastered" count. Kept as `learned` for
  /// backward compat with existing callers; this is what the ring's center
  /// percentage is based on.
  learned: number;
  /// In the user's SRS at any stage (startedAt IS NOT NULL) — includes
  /// `learned`. Rendered as a lighter/translucent ring segment behind the
  /// solid `learned` fill so partial progress is never invisible.
  started: number;
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
  /// True for the Review card, which links to the review queue rather than
  /// a lesson type and shows a due count instead of a completion percent.
  isReviewQueue?: boolean;
  dueCount?: number;
  /// Type-unlock gate (see typeUnlock.ts) — false for a seeded type whose
  /// prerequisite Guru count hasn't been met yet. Distinct from `seeded`:
  /// an unseeded type (e.g. READING) keeps its own "Coming soon" treatment
  /// regardless of this flag.
  unlocked: boolean;
  requirement: string | null;
  have: number;
  need: number;
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
  avatarUrl: string | null;
  accountLevel: number;
  totalXp: number;
  xpForCurrentLevel: number;
  xpIntoCurrentLevel: number;
  currentStreak: number;
  rank: ReturnType<typeof rankForLevel>;
  accountMasteryXp: number;
  accountMasteryLevel: number;
  masteryTier: MasteryTier;
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
import { APP_USER_ID } from "@/lib/appUser";

export async function getDashboard(userId: string = APP_USER_ID): Promise<DashboardData> {
  const profile = await getOrCreateProfile(userId);

  const [kanjiTotal, vocabTotal, sentenceTotal, grammarTotal, passedCounts, startedCounts, reviewQueue, masteryXpAgg, unlockStatuses] = await Promise.all([
    prisma.subject.count({ where: { type: SubjectType.KANJI, level: { not: null } } }),
    prisma.subject.count({ where: { type: SubjectType.VOCAB, level: { not: null } } }),
    prisma.subject.count({ where: { type: SubjectType.SENTENCE, level: { not: null } } }),
    prisma.subject.count({ where: { type: SubjectType.GRAMMAR, level: { not: null } } }),
    prisma.userSubject.groupBy({
      by: ["subjectId"],
      where: { userId, passedAt: { not: null } },
      _count: true,
    }),
    // startedAt IS NOT NULL: in the user's SRS at any stage. Superset of
    // passedAt — everything Guru+ was started first — so `started` is
    // always >= `learned` per type.
    prisma.userSubject.groupBy({
      by: ["subjectId"],
      where: { userId, startedAt: { not: null } },
      _count: true,
    }),
    // Ranked queue only: due items (stage 1-8, dueAt <= now). The dashboard
    // count means "reviews waiting for you", so unranked practice — which is
    // always available and awards nothing — deliberately isn't counted here.
    getReviewQueue(userId),
    // Account mastery is derived, not stored: a single SUM aggregate avoids
    // loading every UserSubject row just to add up masteryXp.
    prisma.userSubject.aggregate({ where: { userId }, _sum: { masteryXp: true } }),
    getTypeUnlockStatuses(userId),
  ]);

  const accountMasteryXp = masteryXpAgg._sum.masteryXp ?? 0;
  const accountMasteryLevelValue = accountMasteryLevel(accountMasteryXp);
  const tier = masteryTier(accountMasteryLevelValue);

  // groupBy above only tells us which subjectIds passed/started; join
  // subject type via a second lookup keyed on those ids to bucket counts.
  const passedSubjectIds = passedCounts.map((r) => r.subjectId);
  const startedSubjectIds = startedCounts.map((r) => r.subjectId);
  const passedByType = await bucketByType(passedSubjectIds);
  const startedByType = await bucketByType(startedSubjectIds);

  const rank = rankForLevel(profile.accountLevel);

  const progress: DashboardProgressRow[] = [
    { type: SubjectType.KANA, labelEn: "Kana", labelJa: "かな", learned: passedByType.KANA, started: startedByType.KANA, total: KANA_TOTAL },
    { type: SubjectType.RADICAL, labelEn: "Radicals", labelJa: "部首", learned: passedByType.RADICAL, started: startedByType.RADICAL, total: RADICAL_TOTAL },
    { type: SubjectType.KANJI, labelEn: "Kanji", labelJa: "漢字", learned: passedByType.KANJI, started: startedByType.KANJI, total: kanjiTotal },
    { type: SubjectType.VOCAB, labelEn: "Vocabulary", labelJa: "語彙", learned: passedByType.VOCAB, started: startedByType.VOCAB, total: vocabTotal },
    { type: SubjectType.SENTENCE, labelEn: "Sentences", labelJa: "例文", learned: passedByType.SENTENCE, started: startedByType.SENTENCE, total: sentenceTotal },
    { type: SubjectType.GRAMMAR, labelEn: "Grammar", labelJa: "文法", learned: passedByType.GRAMMAR, started: startedByType.GRAMMAR, total: grammarTotal },
    { type: SubjectType.READING, labelEn: "Readings", labelJa: "読解", learned: 0, started: 0, total: UNSEEDED_DENOMINATORS.READING },
  ];

  const continueCards: DashboardContinueCard[] = [
    { type: SubjectType.KANA, labelEn: "Kana", labelJa: "かな", glyph: "あ", seeded: true, lessonNumber: seededLessonNumber(passedByType.KANA), percent: percentOf(passedByType.KANA, KANA_TOTAL), unlocked: true, requirement: null, have: 0, need: 0 },
    { type: SubjectType.KANJI, labelEn: "Kanji", labelJa: "かんじ", glyph: "漢字", seeded: true, lessonNumber: seededLessonNumber(passedByType.KANJI), percent: percentOf(passedByType.KANJI, kanjiTotal), unlocked: unlockStatuses.KANJI.unlocked, requirement: unlockStatuses.KANJI.unlocked ? null : unlockStatuses.KANJI.requirement, have: unlockStatuses.KANJI.have, need: unlockStatuses.KANJI.need },
    { type: SubjectType.VOCAB, labelEn: "Vocabulary", labelJa: "ごい", glyph: "語彙", seeded: true, lessonNumber: seededLessonNumber(passedByType.VOCAB), percent: percentOf(passedByType.VOCAB, vocabTotal), unlocked: unlockStatuses.VOCAB.unlocked, requirement: unlockStatuses.VOCAB.unlocked ? null : unlockStatuses.VOCAB.requirement, have: unlockStatuses.VOCAB.have, need: unlockStatuses.VOCAB.need },
    { type: SubjectType.SENTENCE, labelEn: "Sentences", labelJa: "ぶんしょう", glyph: "文", seeded: true, lessonNumber: seededLessonNumber(passedByType.SENTENCE), percent: percentOf(passedByType.SENTENCE, sentenceTotal), unlocked: unlockStatuses.SENTENCE.unlocked, requirement: unlockStatuses.SENTENCE.unlocked ? null : unlockStatuses.SENTENCE.requirement, have: unlockStatuses.SENTENCE.have, need: unlockStatuses.SENTENCE.need },
    { type: SubjectType.GRAMMAR, labelEn: "Grammar", labelJa: "ぶんぽう", glyph: "文法", seeded: true, lessonNumber: seededLessonNumber(passedByType.GRAMMAR), percent: percentOf(passedByType.GRAMMAR, grammarTotal), unlocked: unlockStatuses.GRAMMAR.unlocked, requirement: unlockStatuses.GRAMMAR.unlocked ? null : unlockStatuses.GRAMMAR.requirement, have: unlockStatuses.GRAMMAR.have, need: unlockStatuses.GRAMMAR.need },
    // READING is genuinely unseeded (no Subject rows at all) — this stays
    // `seeded: false` regardless of its type-unlock status, so it keeps the
    // "準備中 / Coming soon" treatment rather than being conflated with
    // "locked" (a seeded type whose prerequisite Guru count isn't met yet).
    { type: SubjectType.READING, labelEn: "Text Reading", labelJa: "ぶんしょうどっかい", glyph: "読解", seeded: false, lessonNumber: null, percent: null, unlocked: unlockStatuses.READING.unlocked, requirement: null, have: 0, need: 0 },
    // Reviews is not a content type — it is the review queue, and it works.
    // It was previously typed SENTENCE and hardcoded seeded:false, so the
    // dashboard advertised a working feature as "Coming soon".
    {
      type: SubjectType.SENTENCE,
      labelEn: "Review",
      labelJa: "ふくしゅう",
      glyph: "復習",
      seeded: true,
      isReviewQueue: true,
      lessonNumber: null,
      percent: null,
      dueCount: reviewQueue.items.length,
      unlocked: true,
      requirement: null,
      have: 0,
      need: 0,
    },
  ];

  const dueTypeCounts = new Map<SubjectType, number>();
  for (const row of reviewQueue.dueCounts) {
    dueTypeCounts.set(row.type, row.count);
  }
  const reviewsByType: DashboardReviewTypeCount[] = [
    SubjectType.KANA,
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
    { id: "master", titleJa: "日本語の達人", requirementEn: "Reach Mastery Lv.∞", progress: totalLearned, target: Number.POSITIVE_INFINITY },
  ];

  const streakDays = buildStreakDays(profile.currentStreak);

  return {
    displayName: profile.displayName,
    avatarUrl: profile.avatarPath ? storage.publicUrl(profile.avatarPath) : null,
    accountLevel: profile.accountLevel,
    totalXp: Number(profile.totalXp),
    xpForCurrentLevel: totalXpToReach(profile.accountLevel + 1),
    xpIntoCurrentLevel: Number(profile.totalXp),
    currentStreak: profile.currentStreak,
    rank,
    accountMasteryXp,
    accountMasteryLevel: accountMasteryLevelValue,
    masteryTier: tier,
    progress,
    continueCards,
    reviewsDue,
    reviewsByType,
    achievements,
    streakDays,
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

function labelForType(type: SubjectType): string {
  switch (type) {
    case SubjectType.KANA: return "Kana";
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
