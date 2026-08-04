// Curriculum level assignment for KANA, independent of assignLevels in
// level-heuristic.ts (which drives the RADICAL/KANJI/VOCAB dependency-based
// ladder). Kana has no dependency graph at all — it's the pre-curriculum
// content that sits *before* radicals (see transform.ts's KANA_LEVEL_COUNT
// wiring and src/services/srs/unlock.ts's kana gate) — so placement is
// purely gojuon-row order, hiragana before katakana, filled into a small
// fixed number of levels of roughly even size.
import type { KanaChar } from "./kana";

// ~5 levels of ~20 characters each, per the task directive (208 characters
// total / 5 ~= 42 per level would be too many; instead we spread evenly
// across enough levels to keep each around 20).
export const KANA_LEVEL_COUNT = 10;

export interface KanaLevelPlacement {
  kana: KanaChar;
  level: number;
}

/// Places every kana onto levels 1..KANA_LEVEL_COUNT, hiragana before
/// katakana, gojuon row order preserved within each script (the input
/// array's own order — see kana.ts's ALL_KANA), split into
/// KANA_LEVEL_COUNT roughly-even chunks.
export function assignKanaLevels(allKana: KanaChar[]): KanaLevelPlacement[] {
  const perLevel = Math.ceil(allKana.length / KANA_LEVEL_COUNT);
  return allKana.map((kana, i) => ({
    kana,
    level: Math.min(KANA_LEVEL_COUNT, Math.floor(i / perLevel) + 1),
  }));
}
