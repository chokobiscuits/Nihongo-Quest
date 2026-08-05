// Tutorial categorization. Pure: no DB access, no Prisma imports.
//
// Category is keyed by slug rather than derived from `order`, because the
// two do not line up. Tutorials are ordered by when a learner should meet
// them, so app-mechanics entries are scattered through the sequence (1, 5,
// 15, 16, 19, 20, 21) rather than sitting in a contiguous block. Any
// range-based rule would miscategorize them, and would silently
// recategorize a tutorial the moment someone reordered the list.
//
// Kept here rather than as a Tutorial column so adding a category needs no
// migration against the live database. The tradeoff is that a new tutorial
// must be added in two places: the seed constant and this map. UNCATEGORIZED
// exists so forgetting the second place degrades to a visible fallback
// section instead of dropping the tutorial off the page entirely.

/// Stable category ids. Ordered as they should appear to a reader: how the
/// app works, then the language itself, then outside reference.
export const TUTORIAL_CATEGORIES = ["APP", "LANGUAGE", "REFERENCE", "UNCATEGORIZED"] as const;

export type TutorialCategory = (typeof TUTORIAL_CATEGORIES)[number];

export interface TutorialCategoryInfo {
  id: TutorialCategory;
  titleEn: string;
  titleJa: string;
  /// One line explaining what belongs in the section, for the panel subtitle.
  blurbEn: string;
}

export const TUTORIAL_CATEGORY_INFO: Record<TutorialCategory, TutorialCategoryInfo> = {
  APP: {
    id: "APP",
    titleEn: "Using this app",
    titleJa: "アプリの使い方",
    blurbEn: "How lessons, reviews, and the SRS ladder actually work.",
  },
  LANGUAGE: {
    id: "LANGUAGE",
    titleEn: "The Japanese language",
    titleJa: "日本語",
    blurbEn: "Scripts, readings, word forms, and grammar.",
  },
  REFERENCE: {
    id: "REFERENCE",
    titleEn: "Reference",
    titleJa: "参考",
    blurbEn: "Background on things outside the app itself.",
  },
  UNCATEGORIZED: {
    id: "UNCATEGORIZED",
    titleEn: "Other",
    titleJa: "その他",
    blurbEn: "Tutorials not yet assigned to a section.",
  },
};

/// Slug to category. Every seeded tutorial in scripts/seed/lib/tutorials.ts
/// should appear here; see categoryForTutorial for unknown-slug behavior.
///
/// APP covers this app's own rules and interface, including SRS mechanics:
/// Guru thresholds, stage intervals, and unlock gates are decisions this app
/// makes, not facts about Japanese. LANGUAGE covers the language itself,
/// including how it is written (furigana is a feature of Japanese text, not
/// an app feature). REFERENCE is for things outside both, like the JLPT,
/// which is an external exam this app only cross-references.
const CATEGORY_BY_SLUG: Record<string, TutorialCategory> = {
  // Using this app
  "how-this-app-works": "APP",
  "how-to-answer": "APP",
  "what-is-guru": "APP",
  "srs-ladder": "APP",
  "mastery-vs-srs-stage": "APP",
  "kana-skip-flow": "APP",
  "lessons-and-reviews": "APP",

  // The Japanese language
  "reading-japanese": "LANGUAGE",
  "what-are-radicals": "LANGUAGE",
  "meaning-vs-reading": "LANGUAGE",
  "onyomi-vs-kunyomi": "LANGUAGE",
  rendaku: "LANGUAGE",
  "particles-and-word-order": "LANGUAGE",
  "no-spaces": "LANGUAGE",
  okurigana: "LANGUAGE",
  "verb-groups": "LANGUAGE",
  "politeness-levels": "LANGUAGE",
  "transitive-intransitive": "LANGUAGE",
  counters: "LANGUAGE",
  "furigana-explained": "LANGUAGE",

  // Reference
  "jlpt-explained": "REFERENCE",
};

/// The category for `slug`, or UNCATEGORIZED when the slug is unknown. Falls
/// back rather than throwing so a newly seeded tutorial that nobody mapped
/// still renders, in a clearly-labeled catch-all section.
export function categoryForTutorial(slug: string): TutorialCategory {
  return CATEGORY_BY_SLUG[slug] ?? "UNCATEGORIZED";
}

export interface CategorizedTutorials<T> {
  category: TutorialCategoryInfo;
  tutorials: T[];
  completedCount: number;
}

/// Groups tutorials into categories, preserving the input order within each
/// category (callers pass them already sorted by `order`) and returning
/// categories in TUTORIAL_CATEGORIES order.
///
/// Empty categories are omitted, so a section only appears once it has
/// something in it. That matters most for UNCATEGORIZED, which should stay
/// invisible while every slug is mapped.
export function categorizeTutorials<T extends { slug: string; completed: boolean }>(
  tutorials: T[],
): CategorizedTutorials<T>[] {
  const grouped = new Map<TutorialCategory, T[]>();
  for (const tutorial of tutorials) {
    const category = categoryForTutorial(tutorial.slug);
    const bucket = grouped.get(category);
    if (bucket) bucket.push(tutorial);
    else grouped.set(category, [tutorial]);
  }

  return TUTORIAL_CATEGORIES.flatMap((id) => {
    const items = grouped.get(id);
    if (!items || items.length === 0) return [];
    return [
      {
        category: TUTORIAL_CATEGORY_INFO[id],
        tutorials: items,
        completedCount: items.filter((t) => t.completed).length,
      },
    ];
  });
}
