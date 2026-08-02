const DAY_MS = 24 * 60 * 60 * 1000;

export interface StreakInput {
  currentStreak: number;
  longestStreak: number;
  /// Date-only (no time component) of the last day any activity was logged,
  /// or null if this is the user's first-ever activity.
  lastActiveDay: Date | null;
  /// Date-only "today", in the user's timezone.
  today: Date;
}

export interface StreakResult {
  currentStreak: number;
  longestStreak: number;
  lastActiveDay: Date;
}

function dayDiff(a: Date, b: Date): number {
  return Math.round((a.getTime() - b.getTime()) / DAY_MS);
}

/// Updates the daily streak for one day of activity. Same-day activity is a
/// no-op on the streak count; the very next day extends it; any gap resets
/// to 1. `longestStreak` only ever grows.
export function applyDailyActivity(input: StreakInput): StreakResult {
  const { currentStreak, longestStreak, lastActiveDay, today } = input;

  if (!lastActiveDay) {
    return { currentStreak: 1, longestStreak: Math.max(longestStreak, 1), lastActiveDay: today };
  }

  const gap = dayDiff(today, lastActiveDay);

  if (gap === 0) {
    return { currentStreak, longestStreak, lastActiveDay: today };
  }

  const nextStreak = gap === 1 ? currentStreak + 1 : 1;
  return {
    currentStreak: nextStreak,
    longestStreak: Math.max(longestStreak, nextStreak),
    lastActiveDay: today,
  };
}
