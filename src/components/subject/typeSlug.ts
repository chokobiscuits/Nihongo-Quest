import { SubjectType } from "@/generated/prisma/enums";

/// URL-slug <-> SubjectType mapping. The URL uses plural, lowercase,
/// WaniKani-style segments ("radicals", "kanji", "readings"); the enum is
/// the DB's singular uppercase name.
const SLUG_TO_TYPE: Record<string, SubjectType> = {
  kana: SubjectType.KANA,
  radicals: SubjectType.RADICAL,
  kanji: SubjectType.KANJI,
  vocabulary: SubjectType.VOCAB,
  grammar: SubjectType.GRAMMAR,
  sentences: SubjectType.SENTENCE,
  readings: SubjectType.READING,
};

const TYPE_TO_SLUG: Record<SubjectType, string> = {
  [SubjectType.KANA]: "kana",
  [SubjectType.RADICAL]: "radicals",
  [SubjectType.KANJI]: "kanji",
  [SubjectType.VOCAB]: "vocabulary",
  [SubjectType.GRAMMAR]: "grammar",
  [SubjectType.SENTENCE]: "sentences",
  [SubjectType.READING]: "readings",
};

export function slugToType(slug: string): SubjectType | null {
  return SLUG_TO_TYPE[slug] ?? null;
}

export function typeToSlug(type: SubjectType): string {
  return TYPE_TO_SLUG[type];
}

export const ALL_TYPE_SLUGS = Object.keys(SLUG_TO_TYPE);
