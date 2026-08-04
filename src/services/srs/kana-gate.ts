import { prisma } from "@/lib/db";
import { SubjectType } from "@/generated/prisma/enums";
import { GURU_STAGE } from "./stages";

/// Whether `userId` has resolved every kana subject — each one is either
/// passed (srsStage >= Guru) or skipped (the "I already know kana" flow
/// burns every kana subject outright, srsStage 9, see
/// src/server/actions/kana.ts). Used by src/services/srs/unlock.ts's
/// isSubjectUnlocked to gate RADICAL unlock on kana. A user with zero kana
/// UserSubject rows at all (brand new, hasn't started kana yet) is
/// unresolved — kana must be actively passed or skipped, not merely absent.
export async function isKanaResolvedFor(userId: string): Promise<boolean> {
  const [kanaTotal, kanaResolvedCount] = await Promise.all([
    prisma.subject.count({ where: { type: SubjectType.KANA } }),
    prisma.userSubject.count({
      where: { userId, subject: { type: SubjectType.KANA }, srsStage: { gte: GURU_STAGE } },
    }),
  ]);
  if (kanaTotal === 0) return true; // nothing seeded to gate on — fail open, never deadlock
  return kanaResolvedCount >= kanaTotal;
}
