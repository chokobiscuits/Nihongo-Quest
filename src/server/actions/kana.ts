"use server";

import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { SubjectType } from "@/generated/prisma/enums";
import { BURNED_STAGE } from "@/services/srs/stages";

const APP_USER_ID = process.env.APP_USER_ID ?? "local-user";

export interface SkipKanaResult {
  skipped: number;
}

/// "I already know kana": creates a Burned UserSubject row for every KANA
/// subject the user doesn't already have a row for, so kana counts as known
/// and never enters the review queue — see src/services/srs/unlock.ts's
/// kana gate, which only requires every kana to be passed OR skipped, not
/// specifically learned through review. Existing rows (already started via
/// real practice) are left untouched: skip only fills in the gaps, it never
/// downgrades or overwrites genuine progress.
export async function skipKana(userId: string = APP_USER_ID): Promise<SkipKanaResult> {
  const allKana = await prisma.subject.findMany({
    where: { type: SubjectType.KANA },
    select: { id: true },
  });
  const existing = await prisma.userSubject.findMany({
    where: { userId, subjectId: { in: allKana.map((k) => k.id) } },
    select: { subjectId: true },
  });
  const existingIds = new Set(existing.map((r) => r.subjectId));
  const toSkip = allKana.filter((k) => !existingIds.has(k.id));

  if (toSkip.length === 0) return { skipped: 0 };

  const now = new Date();
  await prisma.userSubject.createMany({
    data: toSkip.map((k) => ({
      userId,
      subjectId: k.id,
      unlockedAt: now,
      startedAt: now,
      srsStage: BURNED_STAGE,
      passedAt: now,
      burnedAt: now,
      lastPromotedAt: now,
      dueAt: null,
    })),
  });

  try {
    revalidatePath("/subjects/kana");
    revalidatePath("/settings");
    revalidatePath("/");
    revalidatePath("/subjects/radicals");
  } catch {
    // revalidatePath requires an active Next.js request scope; a no-op
    // outside one (e.g. scripts/sim, tests) is fine — the writes above are
    // what actually matter. See src/server/actions/lessons.ts for the same
    // convention.
  }

  return { skipped: toSkip.length };
}

export interface UnskipKanaResult {
  removed: number;
  kept: number;
}

/// Reverses skipKana: deletes KANA UserSubject rows for this user, but ONLY
/// ones with zero ReviewLog history — a row with real review activity means
/// the user has actually been practicing that kana (whether or not it also
/// happens to sit at Burned), and unskip must never destroy that. Rows that
/// were purely created by skipKana (no reviews ever logged) are removed.
export async function unskipKana(userId: string = APP_USER_ID): Promise<UnskipKanaResult> {
  const rows = await prisma.userSubject.findMany({
    where: { userId, subject: { type: SubjectType.KANA } },
    select: { id: true, _count: { select: { reviewLogs: true } } },
  });

  const removableIds = rows.filter((r) => r._count.reviewLogs === 0).map((r) => r.id);
  const kept = rows.length - removableIds.length;

  if (removableIds.length > 0) {
    await prisma.userSubject.deleteMany({ where: { id: { in: removableIds } } });
  }

  try {
    revalidatePath("/subjects/kana");
    revalidatePath("/settings");
    revalidatePath("/");
    revalidatePath("/subjects/radicals");
  } catch {
    // See skipKana above.
  }

  return { removed: removableIds.length, kept };
}
