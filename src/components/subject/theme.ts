import { SubjectType } from "@/generated/prisma/enums";

export interface SubjectThemeEntry {
  base: string;
  bg: string;
  text: string;
  labelEn: string;
  labelJa: string;
  /// Emoji-free glyph icon used in compact UI (nav, chips).
  icon: string;
}

/// Single source of truth for content-type color/label lookups. Every
/// component that needs to color or label a SubjectType reads from here
/// rather than hardcoding a color.
export const SUBJECT_THEME: Record<SubjectType, SubjectThemeEntry> = {
  [SubjectType.RADICAL]: {
    base: "var(--color-radical)",
    bg: "var(--color-radical-bg)",
    text: "var(--color-radical-text)",
    labelEn: "Radicals",
    labelJa: "部首",
    icon: "⼀",
  },
  [SubjectType.KANJI]: {
    base: "var(--color-kanji)",
    bg: "var(--color-kanji-bg)",
    text: "var(--color-kanji-text)",
    labelEn: "Kanji",
    labelJa: "漢字",
    icon: "字",
  },
  [SubjectType.VOCAB]: {
    base: "var(--color-vocab)",
    bg: "var(--color-vocab-bg)",
    text: "var(--color-vocab-text)",
    labelEn: "Vocabulary",
    labelJa: "単語",
    icon: "語",
  },
  [SubjectType.GRAMMAR]: {
    base: "var(--color-grammar)",
    bg: "var(--color-grammar-bg)",
    text: "var(--color-grammar-text)",
    labelEn: "Grammar",
    labelJa: "文法",
    icon: "法",
  },
  [SubjectType.SENTENCE]: {
    base: "var(--color-sentence)",
    bg: "var(--color-sentence-bg)",
    text: "var(--color-sentence-text)",
    labelEn: "Sentences",
    labelJa: "例文",
    icon: "文",
  },
  [SubjectType.READING]: {
    base: "var(--color-reading)",
    bg: "var(--color-reading-bg)",
    text: "var(--color-reading-text)",
    labelEn: "Text Readings",
    labelJa: "読解",
    icon: "読",
  },
};
