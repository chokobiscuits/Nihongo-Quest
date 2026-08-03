// Pure helpers for turning a Tatoeba (sentence, index tokens) pair into a
// SENTENCE subject: locating each token's character offset within the
// sentence text, and splicing per-token furigana (sourced from the already-
// resolved VOCAB subject's own furigana segment array) into a single
// sentence-wide segment list. transform.ts is the orchestrator; every
// decision with edge cases lives here so it can be unit tested directly.
import type { FuriganaSegment } from "./types";

/// One index token located within its sentence's character text.
export interface LocatedToken {
  /// The literal substring as it appears in the sentence — `surface` when
  /// present, otherwise `headword` (index tokens without an inflected
  /// surface form appear in the sentence exactly as their headword).
  text: string;
  start: number;
  end: number; // exclusive
}

/// Locates each token's surface text within `characters`, left-to-right,
/// consuming as it goes so repeated substrings (e.g. the same particle
/// appearing twice) each claim a distinct, non-overlapping occurrence in
/// token order rather than all matching the first occurrence. Tokens whose
/// surface text cannot be found from the current cursor onward are dropped
/// (returned as null in the same position) rather than guessed at.
export function locateTokens(
  characters: string,
  tokens: { headword: string; surface?: string }[],
): (LocatedToken | null)[] {
  let cursor = 0;
  const located: (LocatedToken | null)[] = [];

  for (const token of tokens) {
    const text = token.surface ?? token.headword;
    if (!text) {
      located.push(null);
      continue;
    }
    const idx = characters.indexOf(text, cursor);
    if (idx === -1) {
      located.push(null);
      continue;
    }
    located.push({ text, start: idx, end: idx + text.length });
    cursor = idx + text.length;
  }

  return located;
}

export interface ResolvedTokenForSplice {
  start: number;
  end: number;
  /// The resolved vocab's own furigana segments (ruby/rt pairs) covering
  /// exactly its own `characters`, in source order.
  furigana: FuriganaSegment[];
}

/// Builds a sentence-wide furigana segment list by splicing each resolved
/// token's own vocab furigana at its located offset, and filling any gap
/// between/around tokens (unresolved stretches: particles, punctuation,
/// unresolved tokens) with plain no-reading segments straight from the
/// sentence text. `resolved` must be sorted by `start` and non-overlapping.
///
/// A resolved token's `furigana` comes from its vocab's dictionary-form
/// segments, but the token's own surface in the sentence can be an
/// inflected form of different length (e.g. surface "見られない" resolving
/// to the dictionary entry 見る, whose furigana only covers 2 characters,
/// not the surface's 5). Splicing a shorter segment set into a longer span
/// would silently drop characters from the rendered sentence. So the vocab
/// furigana is only used when its own ruby text reconstructs exactly to
/// this token's surface slice; otherwise the token's full surface span
/// falls back to one plain (no-reading) segment — correct text, just no
/// per-character ruby for that inflected token.
export function spliceSentenceFurigana(
  characters: string,
  resolved: ResolvedTokenForSplice[],
): FuriganaSegment[] {
  const segments: FuriganaSegment[] = [];
  let cursor = 0;

  for (const token of resolved) {
    if (token.start > cursor) {
      segments.push({ ruby: characters.slice(cursor, token.start) });
    }
    const surface = characters.slice(token.start, token.end);
    const reconstructed = token.furigana.map((s) => s.ruby).join("");
    if (reconstructed === surface) {
      segments.push(...token.furigana);
    } else {
      segments.push({ ruby: surface });
    }
    cursor = token.end;
  }

  if (cursor < characters.length) {
    segments.push({ ruby: characters.slice(cursor) });
  }

  return segments;
}
