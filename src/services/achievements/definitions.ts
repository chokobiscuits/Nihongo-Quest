import type { RankTier } from "@/services/rank/tiers";

/// Real, live-computed stats an achievement's progress function reads from.
/// Everything here is a plain number/string so `definitions.ts` stays pure
/// and unit-testable without touching Prisma — `src/server/queries/achievements.ts`
/// is responsible for turning DB rows into this shape.
export interface AchievementStats {
  itemsLearned: number; // total passedAt across radicals+kanji+vocab
  radicalsLearned: number;
  kanjiLearned: number;
  vocabLearned: number;
  radicalsTotal: number; // 214, per the WaniKani-style radical set (out of the 190 laddered + off-ladder extras)
  guruOrAboveCount: number; // any subject at srsStage >= 5
  masterOrAboveCount: number; // srsStage >= 7
  burnedCount: number; // srsStage >= 9
  currentStreak: number;
  accountLevel: number;
  rankTier: RankTier;
  accountMasteryLevel: number;
  /// Best single-session accuracy/size seen, from Session rows.
  bestSessionAccuracyPct: number; // 0-100, from any completed session
  largestSessionItemCount: number; // items in the largest completed session
}

export type AchievementAccent =
  | "bronze"
  | "silver"
  | "gold"
  | "platinum"
  | "diamond"
  | "brand";

export interface AchievementDefinition {
  id: string;
  titleJa: string;
  titleEn: string;
  description: string;
  target: number;
  accent: AchievementAccent;
  /// Current progress against `target`, clamped to `target` by callers when
  /// displaying (the raw value is allowed to exceed target, e.g. burned
  /// count climbing past 100).
  progress: (stats: AchievementStats) => number;
}

function rankAtLeast(stats: AchievementStats, tier: RankTier): number {
  const order: RankTier[] = [
    "IRON",
    "BRONZE",
    "SILVER",
    "GOLD",
    "PLATINUM",
    "DIAMOND",
    "MASTER",
    "GRANDMASTER",
    "CHALLENGER",
  ];
  const targetIndex = order.indexOf(tier);
  const currentIndex = order.indexOf(stats.rankTier);
  return currentIndex >= targetIndex ? 1 : 0;
}

/// The full achievement roster. Each entry's `progress` is a pure function
/// of `AchievementStats` so it is trivially testable at zero/partial/complete
/// without any DB access. Grouped by axis via id prefix for readability;
/// the achievements page groups by unlocked/locked instead.
export const ACHIEVEMENTS: AchievementDefinition[] = [
  // ---------------------------------------------------------- Learning volume
  {
    id: "first-item",
    titleJa: "第一歩",
    titleEn: "Learn your first item",
    description: "Pass any radical, kanji, or vocabulary item.",
    target: 1,
    accent: "bronze",
    progress: (s) => s.itemsLearned,
  },
  {
    id: "kanji-10",
    titleJa: "漢字入門",
    titleEn: "Learn 10 kanji",
    description: "Pass 10 kanji.",
    target: 10,
    accent: "bronze",
    progress: (s) => s.kanjiLearned,
  },
  {
    id: "kanji-100",
    titleJa: "漢字の道",
    titleEn: "Learn 100 kanji",
    description: "Pass 100 kanji.",
    target: 100,
    accent: "silver",
    progress: (s) => s.kanjiLearned,
  },
  {
    id: "kanji-500",
    titleJa: "漢字探求者",
    titleEn: "Learn 500 kanji",
    description: "Pass 500 kanji.",
    target: 500,
    accent: "gold",
    progress: (s) => s.kanjiLearned,
  },
  {
    id: "kanji-1000",
    titleJa: "漢字マスター",
    titleEn: "Learn 1000 kanji",
    description: "Pass 1000 kanji.",
    target: 1000,
    accent: "platinum",
    progress: (s) => s.kanjiLearned,
  },
  {
    id: "vocab-100",
    titleJa: "語彙の芽生え",
    titleEn: "Learn 100 vocabulary",
    description: "Pass 100 vocabulary words.",
    target: 100,
    accent: "bronze",
    progress: (s) => s.vocabLearned,
  },
  {
    id: "vocab-1000",
    titleJa: "語彙の拡大",
    titleEn: "Learn 1000 vocabulary",
    description: "Pass 1000 vocabulary words.",
    target: 1000,
    accent: "silver",
    progress: (s) => s.vocabLearned,
  },
  {
    id: "vocab-5000",
    titleJa: "語彙王",
    titleEn: "Learn 5000 vocabulary",
    description: "Pass 5000 vocabulary words.",
    target: 5000,
    accent: "diamond",
    progress: (s) => s.vocabLearned,
  },
  {
    id: "all-radicals",
    titleJa: "部首制覇",
    titleEn: "Learn all radicals",
    description: "Pass every radical.",
    target: 214,
    accent: "gold",
    progress: (s) => s.radicalsLearned,
  },

  // ---------------------------------------------------------------- SRS depth
  {
    id: "first-guru",
    titleJa: "グルへの道",
    titleEn: "Reach Guru on any item",
    description: "Bring one item to Guru I or above.",
    target: 1,
    accent: "silver",
    progress: (s) => s.guruOrAboveCount,
  },
  {
    id: "first-master",
    titleJa: "師範への一歩",
    titleEn: "Reach Master on any item",
    description: "Bring one item to Master.",
    target: 1,
    accent: "gold",
    progress: (s) => s.masterOrAboveCount,
  },
  {
    id: "first-burned",
    titleJa: "初めての燃焼",
    titleEn: "Burn your first item",
    description: "Bring one item all the way to Burned.",
    target: 1,
    accent: "platinum",
    progress: (s) => s.burnedCount,
  },
  {
    id: "burned-100",
    titleJa: "灰の道",
    titleEn: "Burn 100 items",
    description: "Bring 100 items all the way to Burned.",
    target: 100,
    accent: "diamond",
    progress: (s) => s.burnedCount,
  },

  // ------------------------------------------------------------------ Streaks
  {
    id: "streak-7",
    titleJa: "一週間の継続",
    titleEn: "7-day streak",
    description: "Study 7 days in a row.",
    target: 7,
    accent: "bronze",
    progress: (s) => s.currentStreak,
  },
  {
    id: "streak-30",
    titleJa: "一ヶ月の継続",
    titleEn: "30-day streak",
    description: "Study 30 days in a row.",
    target: 30,
    accent: "silver",
    progress: (s) => s.currentStreak,
  },
  {
    id: "streak-100",
    titleJa: "百日の継続",
    titleEn: "100-day streak",
    description: "Study 100 days in a row.",
    target: 100,
    accent: "gold",
    progress: (s) => s.currentStreak,
  },
  {
    id: "streak-365",
    titleJa: "継続は力なり",
    titleEn: "365-day streak",
    description: "Study 365 days in a row.",
    target: 365,
    accent: "diamond",
    progress: (s) => s.currentStreak,
  },

  // ------------------------------------------------------------------ Account
  {
    id: "level-10",
    titleJa: "初学者",
    titleEn: "Reach account level 10",
    description: "Reach level 10.",
    target: 10,
    accent: "bronze",
    progress: (s) => s.accountLevel,
  },
  {
    id: "level-25",
    titleJa: "中級者",
    titleEn: "Reach account level 25",
    description: "Reach level 25.",
    target: 25,
    accent: "silver",
    progress: (s) => s.accountLevel,
  },
  {
    id: "level-50",
    titleJa: "上級者",
    titleEn: "Reach account level 50",
    description: "Reach level 50.",
    target: 50,
    accent: "gold",
    progress: (s) => s.accountLevel,
  },
  {
    id: "rank-silver",
    titleJa: "シルバー到達",
    titleEn: "Reach Silver rank",
    description: "Reach Silver rank or above.",
    target: 1,
    accent: "silver",
    progress: (s) => rankAtLeast(s, "SILVER"),
  },
  {
    id: "rank-gold",
    titleJa: "ゴールド到達",
    titleEn: "Reach Gold rank",
    description: "Reach Gold rank or above.",
    target: 1,
    accent: "gold",
    progress: (s) => rankAtLeast(s, "GOLD"),
  },
  {
    id: "rank-diamond",
    titleJa: "ダイヤモンド到達",
    titleEn: "Reach Diamond rank",
    description: "Reach Diamond rank or above.",
    target: 1,
    accent: "diamond",
    progress: (s) => rankAtLeast(s, "DIAMOND"),
  },

  // ----------------------------------------------------------------- Mastery
  {
    id: "mastery-1",
    titleJa: "修練の始まり",
    titleEn: "Reach account Mastery level 1",
    description: "Reach account mastery level 1 (Novice).",
    target: 1,
    accent: "bronze",
    progress: (s) => s.accountMasteryLevel,
  },
  {
    id: "mastery-5",
    titleJa: "熟達者",
    titleEn: "Reach account Mastery level 5",
    description: "Reach account mastery level 5 (Proficient).",
    target: 5,
    accent: "gold",
    progress: (s) => s.accountMasteryLevel,
  },
  {
    id: "mastery-10",
    titleJa: "師範",
    titleEn: "Reach account Mastery level 10",
    description: "Reach account mastery level 10 (Master).",
    target: 10,
    accent: "platinum",
    progress: (s) => s.accountMasteryLevel,
  },

  // ---------------------------------------------------------------- Accuracy
  {
    id: "perfect-session",
    titleJa: "完璧な復習",
    titleEn: "Complete a session with 100% accuracy",
    description: "Finish any lesson or review session with a perfect score.",
    target: 100,
    accent: "gold",
    progress: (s) => s.bestSessionAccuracyPct,
  },
  {
    id: "big-session",
    titleJa: "大量復習",
    titleEn: "Complete a 50-item session",
    description: "Finish a single session with 50 or more items.",
    target: 50,
    accent: "silver",
    progress: (s) => s.largestSessionItemCount,
  },
];
