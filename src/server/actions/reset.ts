"use server";

import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { startingRank } from "@/services/rank/lp";
import { RESET_CONFIRMATION } from "./resetConfirmation";

import { APP_USER_ID } from "@/lib/appUser";

export interface ResetProgressResult {
  userSubjects: number;
  reviewLogs: number;
  sessions: number;
  xpEvents: number;
  lpEvents: number;
  achievements: number;
  dailyActivity: number;
  tutorialCompletions: number;
}

/// Wipes every trace of learning progress for `userId` and returns the
/// profile to its starting state. This is irreversible: there is no backup
/// and no undo. Seeded content (Subject, SubjectComponent, Tutorial,
/// DataSource) is untouched — those are shared curriculum, not user data.
///
/// Requires `confirmation` to equal RESET_CONFIRMATION. The check lives here
/// rather than only in the UI so that no caller — a stray fetch, a
/// mis-wired button, a future page — can trigger a wipe without explicitly
/// opting in.
///
/// Deletion order matters: ReviewLog cascades from UserSubject and Session
/// cascades nothing, so logs go first, then the rows they point at. Doing it
/// in one transaction means a failure part-way leaves the account intact
/// rather than half-erased.
export async function resetProgress(
  confirmation: string,
  userId: string = APP_USER_ID,
): Promise<ResetProgressResult> {
  if (confirmation !== RESET_CONFIRMATION) {
    throw new Error("Reset not confirmed. Type RESET to confirm.");
  }

  const result = await prisma.$transaction(async (tx) => {
    // ReviewLog has no userId of its own; it hangs off UserSubject.
    const reviewLogs = await tx.reviewLog.deleteMany({
      where: { userSubject: { userId } },
    });
    const userSubjects = await tx.userSubject.deleteMany({ where: { userId } });
    const xpEvents = await tx.xpEvent.deleteMany({ where: { userId } });
    const lpEvents = await tx.lpEvent.deleteMany({ where: { userId } });
    const achievements = await tx.userAchievement.deleteMany({ where: { userId } });
    const sessions = await tx.session.deleteMany({ where: { userId } });
    const dailyActivity = await tx.dailyActivity.deleteMany({ where: { userId } });
    const tutorialCompletions = await tx.tutorialCompletion.deleteMany({ where: { userId } });

    // Return the profile to its schema defaults, but keep displayName,
    // avatarPath, timezone and settings: those are identity and preferences,
    // not progress, and losing them is a surprise rather than a reset.
    const start = startingRank();
    await tx.userProfile.update({
      where: { userId },
      data: {
        totalXp: BigInt(0),
        accountLevel: 1,
        rank: start.tier,
        rankDivision: start.division,
        lp: start.lp,
        peakRank: start.tier,
        peakRankDivision: start.division,
        currentStreak: 0,
        longestStreak: 0,
        lastActiveDay: null,
      },
    });

    return {
      userSubjects: userSubjects.count,
      reviewLogs: reviewLogs.count,
      sessions: sessions.count,
      xpEvents: xpEvents.count,
      lpEvents: lpEvents.count,
      achievements: achievements.count,
      dailyActivity: dailyActivity.count,
      tutorialCompletions: tutorialCompletions.count,
    };
  });

  try {
    revalidatePath("/", "layout");
  } catch {
    // revalidatePath requires an active Next.js request scope; a no-op
    // outside one (scripts, tests) is fine — the transaction is what
    // matters. Same convention as src/server/actions/reviews.ts.
  }

  return result;
}
