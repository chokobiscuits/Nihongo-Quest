// Shared between getSubjectDetail (subjects.ts) and getLessonBatch
// (lessons.ts): both need to turn a SENTENCE's parentLinks (its VOCAB
// SubjectComponent edges) into a word-by-word breakdown ordered as the words
// appear in the sentence, with each word's surface form and gating status.
import type { SubjectType } from "@/generated/prisma/enums";
import type { LessonComponentSummary, LessonSubjectMeaning, LessonSubjectReading } from "@/server/queries/lessons";

interface SentenceToken {
  surface: string;
  start: number;
  isContent: boolean;
}

export interface SentenceParentLink {
  readingUsed: string | null;
  isGating: boolean;
  child: {
    id: string;
    slug: string;
    characters: string | null;
    meanings: unknown;
    readings: unknown;
    type: SubjectType;
  };
}

function firstMeaning(meanings: unknown): string | null {
  const list = meanings as LessonSubjectMeaning[] | null | undefined;
  if (!list || list.length === 0) return null;
  return (list.find((m) => m.primary) ?? list[0]).meaning;
}

/// Matches each SENTENCE->VOCAB SubjectComponent edge to its token's surface
/// form in the sentence. `Subject.metadata.tokens[].vocabTempId` (the seed
/// script's join key) doesn't survive load as a resolvable field on the real
/// Subject row, so matching here is by content: a token matches a child if
/// its surface equals the child's dictionary form (`characters`) or one of
/// its kana readings — which covers the common case (dictionary-form
/// tokens) exactly and falls back to sentence order for inflected surfaces
/// that don't literally match either. Ties (repeated words) resolve by
/// earliest unclaimed token, left to right — good enough for a display-only
/// word breakdown. Result is ordered by the word's position in the sentence.
export function sentenceWordBreakdown(
  metadata: unknown,
  parentLinks: SentenceParentLink[],
): LessonComponentSummary[] {
  const meta = metadata as { tokens?: SentenceToken[] } | null | undefined;
  const tokens = [...(meta?.tokens ?? [])].sort((a, b) => a.start - b.start);
  const claimed = new Set<number>();

  const withPosition = parentLinks.map((link) => {
    const childReadings = (link.child.readings as LessonSubjectReading[] | null) ?? [];
    const kanaForms = childReadings.map((r) => r.reading);
    let matchIdx = tokens.findIndex(
      (t, i) => !claimed.has(i) && (t.surface === link.child.characters || kanaForms.includes(t.surface)),
    );
    if (matchIdx === -1) {
      matchIdx = tokens.findIndex((_, i) => !claimed.has(i));
    }
    const surface = matchIdx !== -1 ? tokens[matchIdx].surface : undefined;
    const start = matchIdx !== -1 ? tokens[matchIdx].start : Number.POSITIVE_INFINITY;
    if (matchIdx !== -1) claimed.add(matchIdx);

    return {
      start,
      summary: {
        id: link.child.id,
        type: link.child.type as LessonComponentSummary["type"],
        slug: link.child.slug,
        characters: link.child.characters,
        meaning: firstMeaning(link.child.meanings),
        readingUsed: link.readingUsed,
        isGating: link.isGating,
        surface,
      } satisfies LessonComponentSummary,
    };
  });

  return withPosition.sort((a, b) => a.start - b.start).map((w) => w.summary);
}

export function tatoebaSentenceIdOf(metadata: unknown): string | null {
  const meta = metadata as { tatoebaSentenceId?: string } | null | undefined;
  return meta?.tatoebaSentenceId ?? null;
}

/// One example sentence attached to a GRAMMAR point (a GRAMMAR -> SENTENCE
/// SubjectComponent edge), carrying enough of the child SENTENCE to render
/// furigana + English translation without a second round trip.
export interface GrammarExample {
  id: string;
  slug: string;
  characters: string | null;
  furigana: { ruby: string; rt?: string }[] | null;
  furiganaFallback: boolean;
  englishMeaning: string | null;
}

export interface GrammarParentLink {
  child: {
    id: string;
    slug: string;
    characters: string | null;
    meanings: unknown;
    furigana: unknown;
    furiganaFallback: boolean;
  };
}

/// Turns a GRAMMAR subject's parentLinks (its attached SENTENCE examples,
/// always isGating: false — see transform.ts) into the shape the teach card
/// and detail page render: each linking to its own sentence subject with
/// furigana and an English gloss. Zero-example points (13 of 107) simply
/// return an empty array; callers render a clear empty state for that case.
export function grammarExamples(parentLinks: GrammarParentLink[]): GrammarExample[] {
  return parentLinks.map((link) => ({
    id: link.child.id,
    slug: link.child.slug,
    characters: link.child.characters,
    furigana: link.child.furigana as { ruby: string; rt?: string }[] | null,
    furiganaFallback: link.child.furiganaFallback,
    englishMeaning: firstMeaning(link.child.meanings),
  }));
}
