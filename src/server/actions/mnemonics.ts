"use server";

import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";

export interface SaveMnemonicInput {
  subjectId: string;
  meaningMnemonic?: string | null;
  readingMnemonic?: string | null;
  meaningHint?: string | null;
  readingHint?: string | null;
  acceptedMeanings?: string[];
}

/// Saves any subset of the user-authored fields on a Subject and marks it
/// `authored: true`. Fields omitted from `input` are left untouched;
/// fields explicitly passed as null clear that field. Also flips
/// `mnemonicSource` to "authored" so scripts/mnemonics/generate.ts's
/// --regenerate pass never overwrites what the user just wrote here.
export async function saveMnemonic(input: SaveMnemonicInput) {
  const { subjectId, ...fields } = input;

  const data: Record<string, unknown> = { authored: true, mnemonicSource: "authored" };
  if ("meaningMnemonic" in fields) data.meaningMnemonic = fields.meaningMnemonic;
  if ("readingMnemonic" in fields) data.readingMnemonic = fields.readingMnemonic;
  if ("meaningHint" in fields) data.meaningHint = fields.meaningHint;
  if ("readingHint" in fields) data.readingHint = fields.readingHint;
  if ("acceptedMeanings" in fields) data.acceptedMeanings = fields.acceptedMeanings;

  await prisma.subject.update({ where: { id: subjectId }, data });

  revalidatePath("/lessons");
  revalidatePath(`/subjects`);
}

/// The "I should have been marked correct" escape hatch: appends the typed
/// answer to the subject's acceptedMeanings whitelist so future grading
/// accepts it. Session-side, the caller flips that answer's result to
/// correct locally; this only persists the whitelist change.
export async function acceptMeaningAnswer(subjectId: string, typedAnswer: string) {
  const subject = await prisma.subject.findUniqueOrThrow({
    where: { id: subjectId },
    select: { acceptedMeanings: true },
  });

  const current = (subject.acceptedMeanings as string[]) ?? [];
  const trimmed = typedAnswer.trim();
  if (trimmed.length === 0 || current.includes(trimmed)) return;

  await prisma.subject.update({
    where: { id: subjectId },
    data: { acceptedMeanings: [...current, trimmed], authored: true },
  });

  revalidatePath("/lessons");
  revalidatePath(`/subjects`);
}
