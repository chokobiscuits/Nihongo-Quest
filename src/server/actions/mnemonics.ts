"use server";

import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { getCurrentUserId } from "@/lib/session";

export interface SaveMnemonicInput {
  subjectId: string;
  meaningMnemonic?: string | null;
  readingMnemonic?: string | null;
  meaningHint?: string | null;
  readingHint?: string | null;
  acceptedMeanings?: string[];
}

/// Saves any subset of the mnemonic/hint/accepted-meaning fields to the
/// signed-in user's own UserMnemonic override row for this subject — never
/// to Subject itself, which is shared across every account. Fields omitted
/// from `input` are left untouched; fields explicitly passed as null clear
/// that field. `userId` always comes from the session, never from the
/// caller, so one user can never write another's override.
export async function saveMnemonic(input: SaveMnemonicInput) {
  const userId = await getCurrentUserId();
  const { subjectId, ...fields } = input;

  const data: Record<string, unknown> = {};
  if ("meaningMnemonic" in fields) data.meaningMnemonic = fields.meaningMnemonic;
  if ("readingMnemonic" in fields) data.readingMnemonic = fields.readingMnemonic;
  if ("meaningHint" in fields) data.meaningHint = fields.meaningHint;
  if ("readingHint" in fields) data.readingHint = fields.readingHint;
  if ("acceptedMeanings" in fields) data.acceptedMeanings = fields.acceptedMeanings;

  await prisma.userMnemonic.upsert({
    where: { userId_subjectId: { userId, subjectId } },
    create: { userId, subjectId, ...data },
    update: data,
  });

  revalidatePath("/lessons");
  revalidatePath(`/subjects`);
}

/// The "I should have been marked correct" escape hatch: appends the typed
/// answer to the signed-in user's own acceptedMeanings whitelist so future
/// grading accepts it for them. Session-side, the caller flips that answer's
/// result to correct locally; this only persists the whitelist change. Seeds
/// the user's override from Subject's own accepted meanings on first write,
/// so the append doesn't drop whatever the seeded fallback already allowed.
export async function acceptMeaningAnswer(subjectId: string, typedAnswer: string) {
  const userId = await getCurrentUserId();
  const trimmed = typedAnswer.trim();
  if (trimmed.length === 0) return;

  const [subject, override] = await Promise.all([
    prisma.subject.findUniqueOrThrow({ where: { id: subjectId }, select: { acceptedMeanings: true } }),
    prisma.userMnemonic.findUnique({ where: { userId_subjectId: { userId, subjectId } }, select: { acceptedMeanings: true } }),
  ]);

  const current = (override?.acceptedMeanings as string[] | undefined) ?? (subject.acceptedMeanings as string[]) ?? [];
  if (current.includes(trimmed)) return;

  const next = [...current, trimmed];
  await prisma.userMnemonic.upsert({
    where: { userId_subjectId: { userId, subjectId } },
    create: { userId, subjectId, acceptedMeanings: next },
    update: { acceptedMeanings: next },
  });

  revalidatePath("/lessons");
  revalidatePath(`/subjects`);
}
