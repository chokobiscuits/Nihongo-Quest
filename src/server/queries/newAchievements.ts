import { prisma } from "@/lib/db";
import { ACHIEVEMENTS } from "@/services/achievements/definitions";
import { getAchievements } from "@/server/queries/achievements";

import { APP_USER_ID } from "@/lib/appUser";

export interface NewAchievement {
  id: string;
  titleJa: string;
  titleEn: string;
  description: string;
  accent: string;
}

/// Detects achievements crossed during the session that just committed, and
/// records them.
///
/// Achievement progress is computed fresh from live stats on every read, so
/// it cannot tell "just earned" from "already had" — the UserAchievement
/// table is what supplies that memory. Anything currently unlocked with no
/// row yet is newly earned: we insert a row and report it.
///
/// Deliberately called AFTER the commit transaction rather than inside it.
/// The stats it reads (Guru counts, session history, LP events) are exactly
/// what the commit just wrote, so it needs to observe the post-commit state;
/// and a failure here must never roll back a completed session. The cost of
/// that choice is that a crash between the two leaves an achievement
/// un-notified — it will simply be recorded silently on the next session,
/// which is the right failure direction.
export async function recordNewAchievements(userId: string = APP_USER_ID): Promise<NewAchievement[]> {
  const [{ unlocked }, existing] = await Promise.all([
    getAchievements(userId),
    prisma.userAchievement.findMany({ where: { userId }, select: { achievementId: true } }),
  ]);

  const alreadyEarned = new Set(existing.map((r) => r.achievementId));
  const newlyEarned = unlocked.filter((row) => !alreadyEarned.has(row.definition.id));

  if (newlyEarned.length === 0) return [];

  await prisma.userAchievement.createMany({
    data: newlyEarned.map((row) => ({ userId, achievementId: row.definition.id })),
    skipDuplicates: true,
  });

  return newlyEarned.map((row) => ({
    id: row.definition.id,
    titleJa: row.definition.titleJa,
    titleEn: row.definition.titleEn,
    description: row.definition.description,
    accent: row.definition.accent,
  }));
}

/// Backfills the earned table without reporting anything as new. Used on
/// first run against an existing account so a user who already qualifies for
/// twenty achievements is not shown twenty pop-ups at once.
export async function backfillEarnedAchievements(userId: string = APP_USER_ID): Promise<number> {
  const { unlocked } = await getAchievements(userId);
  if (unlocked.length === 0) return 0;

  const result = await prisma.userAchievement.createMany({
    data: unlocked.map((row) => ({ userId, achievementId: row.definition.id })),
    skipDuplicates: true,
  });
  return result.count;
}

export { ACHIEVEMENTS };
