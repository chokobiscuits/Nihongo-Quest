// davidluzgouveia/kanji-data ships modern N5-N1 JLPT levels as a JSON map of
// { [kanji: string]: { jlpt_new: number, jlpt_old: number, ... } }
// (N5=5 ... N1=1). `jlpt_new` is the modern scale we want; `jlpt_old` is that
// project's own copy of the legacy scale and is intentionally ignored here —
// KANJIDIC2's <jlpt> already gives us jlptLegacy directly (see the jlpt
// gotcha in README). This module only trusts `jlpt_new` and ignores every
// other field (strokes, WaniKani level, etc.) so it stays resilient to that
// file adding fields.
export interface JlptLevelRow {
  kanji: string;
  jlpt: number;
}

export function parseJlptSource(json: string): JlptLevelRow[] {
  const parsed: unknown = JSON.parse(json);
  if (!parsed || typeof parsed !== "object") return [];

  const rows: JlptLevelRow[] = [];
  for (const [kanji, value] of Object.entries(parsed as Record<string, unknown>)) {
    if (!value || typeof value !== "object") continue;
    const jlpt = (value as Record<string, unknown>).jlpt_new;
    if (typeof jlpt === "number") rows.push({ kanji, jlpt });
  }
  return rows;
}
