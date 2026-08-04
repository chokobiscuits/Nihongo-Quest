"use server";

import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { SubjectType } from "@/generated/prisma/enums";
import { BURNED_STAGE } from "@/services/srs/stages";

import { APP_USER_ID } from "@/lib/appUser";

export interface SkipKanaResult {
  /// Kana that had no UserSubject row at all and were created at Burned.
  skipped: number;
  /// Kana that already had a row below Burned (in-progress practice) and
  /// were promoted up to Burned by this call.
  promoted: number;
}

/// "I already know kana": marks EVERY kana subject as Burned, so kana counts
/// as known and never enters the review queue — see src/services/srs/unlock.ts's
/// kana gate, which requires every kana to be passed OR skipped.
///
/// This deliberately overwrites in-progress kana rather than only filling in
/// gaps. The gate checks `srsStage >= Guru` across *all* kana, so leaving a
/// single Apprentice row behind keeps radicals locked and makes the button
/// look like it did nothing. The button is a claim about what the user
/// already knows, so it is taken at its word. `unskipKana` remains the
/// escape hatch, and it still refuses to delete rows with real review
/// history.
export async function skipKana(userId: string = APP_USER_ID): Promise<SkipKanaResult> {
  const allKana = await prisma.subject.findMany({
    where: { type: SubjectType.KANA },
    select: { id: true },
  });
  const existing = await prisma.userSubject.findMany({
    where: { userId, subjectId: { in: allKana.map((k) => k.id) } },
    select: { id: true, subjectId: true, srsStage: true },
  });
  const existingIds = new Set(existing.map((r) => r.subjectId));
  const toSkip = allKana.filter((k) => !existingIds.has(k.id));
  const toPromote = existing.filter((r) => r.srsStage < BURNED_STAGE);

  if (toSkip.length === 0 && toPromote.length === 0) return { skipped: 0, promoted: 0 };

  const now = new Date();
  await prisma.$transaction(async (tx) => {
    if (toSkip.length > 0) {
      await tx.userSubject.createMany({
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
    }

    if (toPromote.length > 0) {
      // Burn in-progress kana. passedAt/burnedAt are preserved where already
      // set so the original milestone timestamps aren't rewritten.
      await tx.userSubject.updateMany({
        where: { id: { in: toPromote.map((r) => r.id) }, passedAt: null },
        data: { passedAt: now },
      });
      await tx.userSubject.updateMany({
        where: { id: { in: toPromote.map((r) => r.id) }, burnedAt: null },
        data: { burnedAt: now },
      });
      await tx.userSubject.updateMany({
        where: { id: { in: toPromote.map((r) => r.id) } },
        data: {
          srsStage: BURNED_STAGE,
          lastPromotedAt: now,
          dueAt: null,
        },
      });
    }
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

  return { skipped: toSkip.length, promoted: toPromote.length };
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
