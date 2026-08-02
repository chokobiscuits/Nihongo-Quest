import { toKana, isJapanese } from "wanakana";

/// Lowercases, trims, collapses internal whitespace, and strips punctuation
/// from a free-typed meaning answer, so "A Tree!" and "a tree" compare equal.
export function normalizeMeaning(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[.,!?;:'"()[\]{}\-_/\\]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/// Converts a free-typed reading answer to kana via wanakana (romaji input
/// passes through `toKana`; text already in kana/kanji is left as-is, since
/// `toKana` on Japanese input round-trips it unchanged), then trims and
/// collapses whitespace. Does not strip punctuation: reading answers are
/// kana, where punctuation stripping isn't meaningful.
export function normalizeReading(input: string): string {
  const trimmed = input.trim();
  const kana = isJapanese(trimmed) ? trimmed : toKana(trimmed, { IMEMode: false });
  return kana.replace(/\s+/g, "").trim();
}

/// Strips the okurigana separator dot from a kanji reading, so `た.べる`
/// compares equal to a typed `たべる`. Readings without a dot pass through
/// unchanged.
export function stripOkuriganaDot(reading: string): string {
  return reading.replace(/\./g, "");
}
