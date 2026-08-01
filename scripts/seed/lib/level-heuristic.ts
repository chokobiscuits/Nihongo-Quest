// Curriculum level (1-60) assignment. This is a design decision, not data
// pulled from any source, so it lives as a single pure, retunable function.
//
// Heuristic:
//   1. Topological sort on the component dependency graph built from
//      SubjectComponent edges (radicals before the kanji that use them,
//      kanji before the vocab that use them). This guarantees a subject
//      never gets a level lower than anything it's composed of.
//   2. Within a topological "wave" (all nodes whose dependencies are already
//      placed), order by: RADICAL < KANJI < VOCAB, then ascending
//      grade (kanji-data schoolbook grade, lower = more basic, nulls last),
//      then ascending frequency rank (lower = more common, nulls last).
//   3. Levels are assigned by chunking the ordered list into fixed-size
//      bands across the 60 available levels, proportional to how many
//      subjects need to fit. This keeps radicals/early kanji front-loaded
//      into low levels the way WaniKani-style curricula expect, without
//      hardcoding a fixed items-per-level count that might not fit the
//      actual seeded volume.
//
// Retuning: adjust `tieBreakKey` for a different ordering within a wave, or
// `LEVEL_COUNT` / the banding math in `assignLevels` for a different level
// count or distribution shape.
import type { SubjectType } from "./types";

export const LEVEL_COUNT = 60;

export interface LevelInput {
  tempId: string;
  type: SubjectType;
  grade: number | null;
  frequency: number | null;
  /// tempIds of subjects this one is directly composed of (its children in
  /// SubjectComponent terms) — must be placed at an earlier or equal level.
  dependsOn: string[];
}

const TYPE_RANK: Record<SubjectType, number> = { RADICAL: 0, KANJI: 1, VOCAB: 2 };

/// Kahn's-algorithm topological sort with a deterministic tie-break, so two
/// runs over the same input always produce the same ordering.
export function topologicalOrder(inputs: LevelInput[]): string[] {
  const byId = new Map(inputs.map((i) => [i.tempId, i]));
  const inDegree = new Map<string, number>();
  const dependents = new Map<string, string[]>();

  for (const item of inputs) {
    if (!inDegree.has(item.tempId)) inDegree.set(item.tempId, 0);
    for (const depId of item.dependsOn) {
      if (!byId.has(depId)) continue; // dependency outside the seeded set
      inDegree.set(item.tempId, (inDegree.get(item.tempId) ?? 0) + 1);
      const list = dependents.get(depId) ?? [];
      list.push(item.tempId);
      dependents.set(depId, list);
    }
  }

  const ready = inputs.filter((i) => (inDegree.get(i.tempId) ?? 0) === 0);
  const order: string[] = [];
  const remaining = new Map(inDegree);

  const compare = (a: LevelInput, b: LevelInput) => {
    if (TYPE_RANK[a.type] !== TYPE_RANK[b.type]) return TYPE_RANK[a.type] - TYPE_RANK[b.type];
    const gradeA = a.grade ?? Number.MAX_SAFE_INTEGER;
    const gradeB = b.grade ?? Number.MAX_SAFE_INTEGER;
    if (gradeA !== gradeB) return gradeA - gradeB;
    const freqA = a.frequency ?? Number.MAX_SAFE_INTEGER;
    const freqB = b.frequency ?? Number.MAX_SAFE_INTEGER;
    if (freqA !== freqB) return freqA - freqB;
    return a.tempId.localeCompare(b.tempId);
  };

  const placed = new Set<string>();
  let wave = [...ready];
  while (wave.length > 0) {
    wave.sort(compare);
    for (const item of wave) {
      order.push(item.tempId);
      placed.add(item.tempId);
      for (const depId of dependents.get(item.tempId) ?? []) {
        const next = (remaining.get(depId) ?? 0) - 1;
        remaining.set(depId, next);
      }
    }
    wave = inputs.filter((i) => !placed.has(i.tempId) && (remaining.get(i.tempId) ?? 0) === 0);
  }

  if (order.length !== inputs.length) {
    const missing = inputs.filter((i) => !placed.has(i.tempId)).map((i) => i.tempId);
    throw new Error(
      `level-heuristic: dependency cycle detected, ${missing.length} subject(s) unreachable: ${missing.slice(0, 5).join(", ")}${missing.length > 5 ? "..." : ""}`,
    );
  }

  return order;
}

/// Assigns levels 1..LEVEL_COUNT by chunking the topological order into
/// equal-size bands, so the actual level count adapts to however many
/// subjects were seeded rather than assuming a fixed items-per-level.
export function assignLevels(inputs: LevelInput[]): Map<string, number> {
  const order = topologicalOrder(inputs);
  const levels = new Map<string, number>();
  const perLevel = Math.max(1, Math.ceil(order.length / LEVEL_COUNT));

  order.forEach((tempId, index) => {
    const level = Math.min(LEVEL_COUNT, Math.floor(index / perLevel) + 1);
    levels.set(tempId, level);
  });

  // Guarantee dependency ordering survives the banding: a subject can never
  // be assigned a level below any of its dependencies (banding is monotonic
  // with topological order, so this loop is a defensive no-op in practice,
  // but it's cheap insurance against a future change to the banding math).
  const byId = new Map(inputs.map((i) => [i.tempId, i]));
  for (const tempId of order) {
    const item = byId.get(tempId)!;
    let level = levels.get(tempId)!;
    for (const depId of item.dependsOn) {
      const depLevel = levels.get(depId);
      if (depLevel !== undefined && depLevel > level) level = depLevel;
    }
    levels.set(tempId, level);
  }

  return levels;
}
