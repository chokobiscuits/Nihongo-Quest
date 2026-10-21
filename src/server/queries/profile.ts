import { prisma } from "@/lib/db";
import type { UserProfileModel } from "@/generated/prisma/models";

/// Single-user app: this is the one profile row. Created lazily on first
/// access — level 1, 0 XP, Iron IV — rather than via a seed/signup step.
export async function getOrCreateProfile(userId: string): Promise<UserProfileModel> {
  const existing = await prisma.userProfile.findUnique({ where: { userId } });
  if (existing) return existing;

  return prisma.userProfile.upsert({
    where: { userId },
    update: {},
    create: {
      userId,
      displayName: "Learner",
      totalXp: 0,
      accountLevel: 1,
      rank: "IRON",
      rankDivision: 4,
      currentStreak: 0,
      longestStreak: 0,
    },
  });
}
