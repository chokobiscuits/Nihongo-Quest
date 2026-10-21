import { prisma } from "@/lib/db";
import { storage } from "@/lib/storage";
import { dayInTimezone } from "@/services/xp/streak";
import { rankLeaderboard, type LeaderboardRow } from "@/services/leaderboard/rank";

export type LeaderboardTab = "weekly" | "total" | "streak";

export interface LeaderboardData {
  weekly: LeaderboardRow[];
  total: LeaderboardRow[];
  streak: LeaderboardRow[];
  /// Monday of the viewer's current calendar week, for display ("week of …").
  weekStart: Date;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/// Monday on/before `today` (both date-only, UTC-midnight-encoded like
/// dayInTimezone returns). getUTCDay() is 0=Sun..6=Sat; distance back to
/// Monday is 0 for Monday itself and 6 for Sunday.
function mondayOnOrBefore(today: Date): Date {
  const dow = today.getUTCDay();
  const daysSinceMonday = dow === 0 ? 6 : dow - 1;
  return new Date(today.getTime() - daysSinceMonday * DAY_MS);
}

/// All 4 accounts, ranked three ways: weekly XP (calendar-week, Monday reset,
/// computed per-user in their own timezone), all-time total XP, and current
/// streak (shown as 0 if stale — see below). `viewerId` is only used to know
/// whose "this week" anchors the window label; every user's own weekly sum is
/// still computed against their own Monday, which can differ from the
/// viewer's if timezones disagree on what day it is. That's expected: see
/// the leaderboard spec.
///
/// Profiles are created lazily (getOrCreateProfile), so a user who has never
/// logged in has no UserProfile row yet — such accounts are silently
/// excluded rather than crashing or showing a placeholder.
export async function getLeaderboard(viewerId: string, now: Date = new Date()): Promise<LeaderboardData> {
  const profiles = await prisma.userProfile.findMany({
    select: {
      userId: true,
      displayName: true,
      avatarPath: true,
      totalXp: true,
      currentStreak: true,
      lastActiveDay: true,
      timezone: true,
    },
  });

  const viewerProfile = profiles.find((p) => p.userId === viewerId);
  const viewerTimezone = viewerProfile?.timezone ?? "Asia/Tokyo";
  const weekStart = mondayOnOrBefore(dayInTimezone(now, viewerTimezone));

  // Each user's own Monday-anchored week, in their own timezone — may span a
  // different UTC range per user, but DailyActivity.day is already
  // timezone-correct per row (see streak.ts's dayInTimezone), so summing
  // between each user's own weekStart/today is enough; no per-user query
  // needed for the boundary, just the filter below.
  const weekStartByUser = new Map(
    profiles.map((p) => [p.userId, mondayOnOrBefore(dayInTimezone(now, p.timezone))]),
  );
  const earliestWeekStart = new Date(Math.min(...Array.from(weekStartByUser.values()).map((d) => d.getTime())));

  const activityRows = await prisma.dailyActivity.findMany({
    where: { userId: { in: profiles.map((p) => p.userId) }, day: { gte: earliestWeekStart } },
    select: { userId: true, day: true, xpEarned: true },
  });

  const weeklyXpByUser = new Map<string, number>();
  for (const row of activityRows) {
    const userWeekStart = weekStartByUser.get(row.userId);
    if (!userWeekStart || row.day.getTime() < userWeekStart.getTime()) continue;
    weeklyXpByUser.set(row.userId, (weeklyXpByUser.get(row.userId) ?? 0) + row.xpEarned);
  }

  const candidates = profiles.map((profile) => {
    const totalXp = Number(profile.totalXp);
    const today = dayInTimezone(now, profile.timezone);
    const yesterday = new Date(today.getTime() - DAY_MS);
    // Stale streaks: the stored currentStreak only advances/resets when
    // DailyActivity is next written (see applyDailyActivity), so a user
    // inactive since before yesterday shows a nonzero streak that is no
    // longer true. Displaying 0 here is display-only — it never writes back
    // to UserProfile.currentStreak.
    const streakIsFresh = profile.lastActiveDay !== null && profile.lastActiveDay.getTime() >= yesterday.getTime();
    return {
      userId: profile.userId,
      displayName: profile.displayName,
      avatarUrl: profile.avatarPath ? storage.publicUrl(profile.avatarPath) : null,
      totalXp,
      weeklyXp: weeklyXpByUser.get(profile.userId) ?? 0,
      streak: streakIsFresh ? profile.currentStreak : 0,
    };
  });

  return {
    weekly: rankLeaderboard(candidates.map((c) => ({ ...c, value: c.weeklyXp }))),
    total: rankLeaderboard(candidates.map((c) => ({ ...c, value: c.totalXp }))),
    streak: rankLeaderboard(candidates.map((c) => ({ ...c, value: c.streak }))),
    weekStart,
  };
}
