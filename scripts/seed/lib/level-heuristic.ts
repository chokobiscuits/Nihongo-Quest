// Curriculum level (1-60) assignment. This is a design decision, not data
// pulled from any source, so it lives as a single pure, retunable function.
//
// Heuristic (quota-filling, not depth-assignment):
//   1. SELECT which kanji/radicals go on the 60-level ladder at all. Not
//      every seeded subject belongs on the ladder — only ~2,000 kanji and
//      the radicals those kanji actually depend on. Everything else gets
//      level = null: still seeded, searchable, and linkable, just outside
//      the curriculum. Kanji selection prefers JLPT-banded kanji (N5 first,
//      easiest) and falls back to frequency-ranked non-JLPT kanji only to
//      fill a level's quota.
//   2. ORDER the selected radicals/kanji with Kahn's-algorithm topological
//      sort so a radical always precedes the kanji that uses it. Within a
//      topological "wave", ties break by the curriculum ordering key (JLPT
//      band, then frequency, then grade, then id) rather than by
//      dependency depth.
//   3. FILL levels 1..60 by walking the ordered radical/kanji list and
//      assigning each item to the earliest level that (a) is at or after
//      every one of its dependencies' levels and (b) still has quota room
//      for that type. Dependency order is a CONSTRAINT on placement, not
//      the thing that picks the level — quotas are.
//   4. SELECT AND FILL vocab in a second pass, level by level, once every
//      radical/kanji has a level: at level N, a vocab item becomes eligible
//      once all of its kanji have a level <= N, and eligible vocab (common
//      first, then curriculum order) fill level N's vocab quota. This ties
//      vocab supply to kanji supply per level instead of pre-selecting the
//      globally most-common ~5,400 words and placing them after, which
//      jams whichever levels happen to unlock the most common kanji.
//
// Retuning: adjust the *_QUOTA / *_TARGET constants below. Everything that
// shapes level count, per-level quotas, or selection thresholds is a named
// exported constant, not a magic number inline.
import type { SubjectType } from "./types";

export const LEVEL_COUNT = 60;

// ---------------------------------------------------------------- Quotas
// Per-level targets. Kanji and vocab are flat (a kanji/vocab item is only
// ever "due" once, so an even quota spreads the curriculum evenly). Radical
// quota tapers because radicals are only needed once, the first time some
// kanji requires them — most of the component alphabet is exhausted well
// before level 60.
export const KANJI_PER_LEVEL = 33;
export const VOCAB_PER_LEVEL = 90;
// Capacity across the three bands must comfortably exceed the number of
// radicals actually pulled onto the ladder (every radical any laddered
// kanji transitively depends on) or the tail levels back up and dump
// everything downstream into level 60. With KanjiVG's real decomposition
// graph that's on the order of several hundred to low thousands of distinct
// components for ~2,000 kanji, hence the generous late-band quota.
export const RADICAL_QUOTA_EARLY = 20; // levels 1-10
export const RADICAL_QUOTA_MID = 16; // levels 11-30
export const RADICAL_QUOTA_LATE = 27; // levels 31-60
export const RADICAL_EARLY_LEVEL_CUTOFF = 10;
export const RADICAL_MID_LEVEL_CUTOFF = 30;

// A level may run over its type quota by up to this fraction before we
// consider the distribution broken (tested, not enforced at runtime — an
// overrun can legitimately happen near the tail when dependency constraints
// leave no earlier level with room).
export const QUOTA_OVERRUN_TOLERANCE = 0.2;

// ------------------------------------------------------------- Selection
// Target number of kanji actually placed on the ladder. The rest stay
// level = null. ~2,211 kanji carry a JLPT band, so this cap essentially
// selects "the JLPT-tagged kanji" plus a small frequency-ranked top-up.
export const KANJI_LADDER_TARGET = KANJI_PER_LEVEL * LEVEL_COUNT; // ~1,980

// Non-JLPT kanji are only eligible to top up a level's quota if their
// KANJIDIC2 frequency rank is better (numerically lower) than this.
export const NON_JLPT_FREQUENCY_CEILING = 2500;

// Target number of vocab placed on the ladder; the rest stay level = null.
export const VOCAB_LADDER_TARGET = VOCAB_PER_LEVEL * LEVEL_COUNT; // ~5,400

// Per-level quota for SENTENCE subjects. Sentences are placed by
// transform.ts in a third pass, after assignLevels has settled vocab levels
// (a sentence's level must be strictly greater than the max level of every
// vocab it contains — see strictDependsOn's doc comment above for why
// "strict" means "no ties" throughout this pipeline). Kept modest so
// sentences don't swamp any one level's lesson queue.
export const SENTENCE_PER_LEVEL = 30;

export interface LevelInput {
  tempId: string;
  type: SubjectType;
  grade: number | null;
  frequency: number | null;
  /// KANJIDIC2/JLPT band: 5 = N5 (easiest) .. 1 = N1 (hardest), null if untagged.
  /// Ignored for RADICAL/VOCAB inputs.
  jlpt: number | null;
  /// True for vocab JMdict flags as "common" (or radicals/kanji, where it's
  /// irrelevant and should just be left false).
  isCommon: boolean;
  /// tempIds of subjects this one is directly composed of (its children in
  /// SubjectComponent terms) — must be placed at an earlier or equal level.
  dependsOn: string[];
  /// Subset of dependsOn that must be placed at a STRICTLY earlier level,
  /// not merely equal. Used for every kanji-to-radical component edge
  /// (including identity radical links, where a kanji that is itself a
  /// Kangxi radical must learn the radical form first) — a radical must be
  /// learnable ahead of the kanji it composes, not tied with it. Every id
  /// here must also appear in dependsOn.
  strictDependsOn?: string[];
}

const TYPE_RANK: Record<SubjectType, number> = { RADICAL: 0, KANJI: 1, VOCAB: 2, SENTENCE: 3 };

/// Curriculum ordering key used both to pick which kanji/vocab make the
/// ladder and to break ties within a topological wave: JLPT band ascending
/// from N5 (5) to N1 (1) — expressed here as a rank where lower is earlier —
/// then frequency ascending (more common first), then grade, then id.
function jlptBandRank(jlpt: number | null): number {
  // jlpt is 5 (N5, easiest) down to 1 (N1, hardest). We want N5 first, so
  // rank = 5 - jlpt gives N5 -> 0, N4 -> 1, ... N1 -> 4. Untagged sorts last.
  return jlpt === null ? Number.MAX_SAFE_INTEGER : 5 - jlpt;
}

function curriculumCompare(a: LevelInput, b: LevelInput): number {
  if (TYPE_RANK[a.type] !== TYPE_RANK[b.type]) return TYPE_RANK[a.type] - TYPE_RANK[b.type];
  const bandA = jlptBandRank(a.jlpt);
  const bandB = jlptBandRank(b.jlpt);
  if (bandA !== bandB) return bandA - bandB;
  const freqA = a.frequency ?? Number.MAX_SAFE_INTEGER;
  const freqB = b.frequency ?? Number.MAX_SAFE_INTEGER;
  if (freqA !== freqB) return freqA - freqB;
  const gradeA = a.grade ?? Number.MAX_SAFE_INTEGER;
  const gradeB = b.grade ?? Number.MAX_SAFE_INTEGER;
  if (gradeA !== gradeB) return gradeA - gradeB;
  return a.tempId.localeCompare(b.tempId);
}

/// Kahn's-algorithm topological sort over an arbitrary subset of inputs
/// (dependencies pointing outside the subset are ignored, same as before).
///
/// Uses a single global ready frontier, sorted by curriculumCompare, rather
/// than processing full dependency "waves" one at a time: an item that
/// becomes ready a wave later than some unrelated item (e.g. a kanji that
/// now depends on its identity radical, becoming ready in wave 2 instead of
/// wave 0) must still be able to outrank lower-curriculum-priority items
/// that happened to have zero dependencies from the start. Wave-at-a-time
/// processing would let every zero-dependency item claim its level-quota
/// slot before any item with a dependency is even considered, regardless of
/// curriculum rank — starving e.g. 一/日/生 behind obscure zero-component
/// kanji. A global frontier picks the single best-ranked ready item at each
/// step, so priority is compared across the whole remaining pool, not just
/// within one wave.
function topologicalOrder(inputs: LevelInput[]): string[] {
  const byId = new Map(inputs.map((i) => [i.tempId, i]));
  const inDegree = new Map<string, number>();
  const dependents = new Map<string, string[]>();

  for (const item of inputs) {
    if (!inDegree.has(item.tempId)) inDegree.set(item.tempId, 0);
    for (const depId of item.dependsOn) {
      if (!byId.has(depId)) continue; // dependency outside the selected set
      inDegree.set(item.tempId, (inDegree.get(item.tempId) ?? 0) + 1);
      const list = dependents.get(depId) ?? [];
      list.push(item.tempId);
      dependents.set(depId, list);
    }
  }

  const order: string[] = [];
  const remaining = new Map(inDegree);
  const placed = new Set<string>();
  const ready = inputs.filter((i) => (inDegree.get(i.tempId) ?? 0) === 0);
  ready.sort(curriculumCompare);

  while (ready.length > 0) {
    const item = ready.shift()!;
    order.push(item.tempId);
    placed.add(item.tempId);
    const newlyReady: LevelInput[] = [];
    for (const depId of dependents.get(item.tempId) ?? []) {
      const left = (remaining.get(depId) ?? 0) - 1;
      remaining.set(depId, left);
      if (left === 0) newlyReady.push(byId.get(depId)!);
    }
    if (newlyReady.length > 0) {
      // Merge newly-ready items into the sorted frontier and re-sort — the
      // frontier stays small relative to total input size in practice, so
      // a full re-sort per batch is cheap enough for a one-off seed script.
      ready.push(...newlyReady);
      ready.sort(curriculumCompare);
    }
  }

  if (order.length !== inputs.length) {
    const missing = inputs.filter((i) => !placed.has(i.tempId)).map((i) => i.tempId);
    throw new Error(
      `level-heuristic: dependency cycle detected, ${missing.length} subject(s) unreachable: ${missing.slice(0, 5).join(", ")}${missing.length > 5 ? "..." : ""}`,
    );
  }

  return order;
}

/// Recursively collects every dependency (radicals under a kanji, kanji
/// under a vocab, transitively) of `tempId`, using `byId` to look up
/// dependsOn edges. Used to pull a laddered kanji's radicals onto the
/// ladder too, regardless of the radical's own curriculum-order rank.
function collectDependencies(tempId: string, byId: Map<string, LevelInput>, out: Set<string>): void {
  const item = byId.get(tempId);
  if (!item) return;
  for (const depId of item.dependsOn) {
    if (out.has(depId)) continue;
    out.add(depId);
    collectDependencies(depId, byId, out);
  }
}

/// Selects which subjects belong on the ladder at all. Returns the tempIds
/// to place; everything else should get level = null.
///
/// Kanji: JLPT-banded kanji first (curriculumCompare order, i.e. N5 then
/// frequency), then non-JLPT kanji whose frequency rank is better than
/// NON_JLPT_FREQUENCY_CEILING, until KANJI_LADDER_TARGET is reached.
/// Radicals: every radical any selected kanji transitively depends on.
/// Vocab selection happens separately, in assignLevels, once radical/kanji
/// levels are known (see the comment there for why).
function selectLadderSet(inputs: LevelInput[]): Set<string> {
  const byId = new Map(inputs.map((i) => [i.tempId, i]));
  const kanji = inputs.filter((i) => i.type === "KANJI");
  const radicals = inputs.filter((i) => i.type === "RADICAL");

  const jlptKanji = kanji.filter((k) => k.jlpt !== null).sort(curriculumCompare);
  const nonJlptKanji = kanji
    .filter((k) => k.jlpt === null && k.frequency !== null && k.frequency < NON_JLPT_FREQUENCY_CEILING)
    .sort(curriculumCompare);

  const selected = new Set<string>();
  for (const k of jlptKanji) {
    if (selected.size >= KANJI_LADDER_TARGET) break;
    selected.add(k.tempId);
  }
  for (const k of nonJlptKanji) {
    if (selected.size >= KANJI_LADDER_TARGET) break;
    selected.add(k.tempId);
  }

  // Pull in every radical any selected kanji (transitively) needs.
  const neededRadicals = new Set<string>();
  for (const tempId of selected) collectDependencies(tempId, byId, neededRadicals);
  for (const r of radicals) {
    if (neededRadicals.has(r.tempId)) selected.add(r.tempId);
  }

  return selected;
}

function radicalQuotaForLevel(level: number): number {
  if (level <= RADICAL_EARLY_LEVEL_CUTOFF) return RADICAL_QUOTA_EARLY;
  if (level <= RADICAL_MID_LEVEL_CUTOFF) return RADICAL_QUOTA_MID;
  return RADICAL_QUOTA_LATE;
}

function quotaForType(type: SubjectType, level: number): number {
  switch (type) {
    case "RADICAL":
      return radicalQuotaForLevel(level);
    case "KANJI":
      return KANJI_PER_LEVEL;
    case "VOCAB":
      return VOCAB_PER_LEVEL;
    case "SENTENCE":
      return SENTENCE_PER_LEVEL;
  }
}

export { quotaForType };

/// Places a single already-selected item at the earliest level >= minLevel
/// with room under its type's base quota; if every level from minLevel to
/// LEVEL_COUNT is already at base quota, spreads into whichever eligible
/// level is currently least full relative to its own quota (so overrun is
/// spent evenly instead of concentrated at level 60).
function placeAtLevel(
  item: LevelInput,
  minLevel: number,
  levelCounts: Map<string, number>,
): number {
  let level = minLevel;
  while (level < LEVEL_COUNT) {
    const key = `${level}:${item.type}`;
    const count = levelCounts.get(key) ?? 0;
    if (count < quotaForType(item.type, level)) break;
    level += 1;
  }
  const atCapKey = `${level}:${item.type}`;
  const atCapCount = levelCounts.get(atCapKey) ?? 0;
  if (atCapCount >= quotaForType(item.type, level)) {
    let bestLevel = level;
    let bestRatio = Number.POSITIVE_INFINITY;
    for (let candidate = minLevel; candidate <= LEVEL_COUNT; candidate += 1) {
      const candidateKey = `${candidate}:${item.type}`;
      const candidateCount = levelCounts.get(candidateKey) ?? 0;
      const quota = quotaForType(item.type, candidate);
      const ratio = candidateCount / quota;
      if (ratio < bestRatio) {
        bestRatio = ratio;
        bestLevel = candidate;
      }
    }
    level = bestLevel;
  }

  const key = `${level}:${item.type}`;
  levelCounts.set(key, (levelCounts.get(key) ?? 0) + 1);
  return level;
}

/// Assigns levels 1..LEVEL_COUNT to a curriculum-selected subset of `inputs`
/// by walking the topological order and filling each level to its type
/// quota; subjects not selected for the ladder get level = null.
///
/// Dependency order is a constraint on placement (an item is never placed
/// before any of its dependencies), not the sole determinant of level —
/// within that constraint, items fill the earliest level with quota room.
///
/// Vocab is selected and placed in a second pass, level by level, after
/// radicals and kanji have levels: at each level we look at which vocab is
/// now eligible (every kanji dependency already placed at or before this
/// level) and fill up to that level's quota from the eligible pool, ordered
/// isCommon-first then by curriculum rank. This keeps per-level vocab supply
/// tied to per-level kanji supply instead of jamming late levels when
/// common words cluster around late-placed kanji.
export function assignLevels(inputs: LevelInput[]): Map<string, number | null> {
  const selectedIds = selectLadderSet(inputs);
  const byId = new Map(inputs.map((i) => [i.tempId, i]));
  const radicalKanjiInputs = inputs.filter((i) => selectedIds.has(i.tempId) && i.type !== "VOCAB");
  const order = topologicalOrder(radicalKanjiInputs);

  const levels = new Map<string, number | null>();
  for (const item of inputs) levels.set(item.tempId, null);

  const levelCounts = new Map<string, number>(); // `${level}:${type}` -> count

  for (const tempId of order) {
    const item = byId.get(tempId)!;
    let minLevel = 1;
    const strict = new Set(item.strictDependsOn ?? []);
    for (const depId of item.dependsOn) {
      const depLevel = levels.get(depId);
      if (typeof depLevel !== "number") continue;
      const required = strict.has(depId) ? depLevel + 1 : depLevel;
      if (required > minLevel) minLevel = required;
    }
    const assigned = placeAtLevel(item, minLevel, levelCounts);
    for (const depId of strict) {
      const depLevel = levels.get(depId);
      if (typeof depLevel === "number" && !(depLevel < assigned)) {
        throw new Error(
          `level-heuristic: strict dependency invariant violated — ${tempId} (level ${assigned}) must be strictly after ${depId} (level ${depLevel})`,
        );
      }
    }
    levels.set(tempId, assigned);
  }

  // Second pass: vocab, level by level, capped at VOCAB_LADDER_TARGET total.
  // Every kanji dependency is strict (see strictDependsOn on the VOCAB
  // input): a vocab item must land at a level strictly after the max level
  // of every kanji it contains, never the same level, so the runtime unlock
  // (which gates on the kanji being Guru'd) is never offered a lesson ahead
  // of its own prerequisite.
  const vocabInputs = inputs.filter((i) => i.type === "VOCAB");
  const laddered = new Set(radicalKanjiInputs.map((i) => i.tempId));
  let vocabPlaced = 0;
  for (let level = 1; level <= LEVEL_COUNT && vocabPlaced < VOCAB_LADDER_TARGET; level += 1) {
    // Eligible now = every kanji dependency already placed at a STRICTLY
    // earlier level than `level`. Re-derived each level since eligibility
    // grows monotonically as more kanji get placed, and levels beyond the
    // current one haven't committed their kanji yet (levels.get returns the
    // already-final level from the radical/kanji pass above, so this check
    // is stable).
    const eligibleNow = vocabInputs.filter((v) => {
      if (laddered.has(v.tempId)) return false; // already placed
      return v.dependsOn.every((dep) => {
        const depItem = byId.get(dep);
        if (!depItem) return false;
        if (depItem.type !== "KANJI") return true;
        const depLevel = levels.get(dep);
        return typeof depLevel === "number" && depLevel < level;
      });
    });
    eligibleNow.sort((a, b) => {
      if (a.isCommon !== b.isCommon) return a.isCommon ? -1 : 1;
      return curriculumCompare(a, b);
    });

    const quota = quotaForType("VOCAB", level);
    for (const v of eligibleNow) {
      if (vocabPlaced >= VOCAB_LADDER_TARGET) break;
      const key = `${level}:VOCAB`;
      const count = levelCounts.get(key) ?? 0;
      if (count >= quota) break;
      levels.set(v.tempId, level);
      laddered.add(v.tempId);
      levelCounts.set(key, count + 1);
      vocabPlaced += 1;
    }
  }

  return levels;
}

export interface SentenceLevelInput {
  tempId: string;
  /// tempIds of every VOCAB subject the sentence's tokens resolved to. The
  /// sentence's level must be STRICTLY greater than the max level of these
  /// (same strict-dependency convention as every other component edge in
  /// this pipeline — see strictDependsOn above) so a sentence is never
  /// offered before every word it exemplifies has already unlocked.
  vocabTempIds: string[];
}

/// Assigns levels to SENTENCE subjects in a third pass, after `assignLevels`
/// has settled every RADICAL/KANJI/VOCAB level. A sentence becomes eligible
/// for level N once every vocab it depends on already has a level strictly
/// less than N; sentences whose vocab is entirely off-ladder (any dependency
/// missing a level) get level = null, same as any other subject that falls
/// outside the 60-level curriculum. Quota-filled per level like every other
/// type, via SENTENCE_PER_LEVEL through quotaForType.
export function assignSentenceLevels(
  inputs: SentenceLevelInput[],
  vocabLevels: Map<string, number | null>,
): Map<string, number | null> {
  const levels = new Map<string, number | null>();
  const levelCounts = new Map<number, number>();

  // Precompute each sentence's minimum eligible level (max vocab level + 1);
  // sentences with any off-ladder vocab dependency never become eligible.
  const minLevelByTempId = new Map<string, number | null>();
  for (const input of inputs) {
    let maxVocabLevel = 0;
    let allLaddered = true;
    for (const vocabTempId of input.vocabTempIds) {
      const level = vocabLevels.get(vocabTempId);
      if (typeof level !== "number") {
        allLaddered = false;
        break;
      }
      if (level > maxVocabLevel) maxVocabLevel = level;
    }
    minLevelByTempId.set(input.tempId, allLaddered ? maxVocabLevel + 1 : null);
    levels.set(input.tempId, null);
  }

  for (let level = 1; level <= LEVEL_COUNT; level += 1) {
    const quota = quotaForType("SENTENCE", level);
    const eligibleNow = inputs.filter(
      (i) => levels.get(i.tempId) === null && minLevelByTempId.get(i.tempId) !== null && minLevelByTempId.get(i.tempId)! <= level,
    );
    let placed = levelCounts.get(level) ?? 0;
    for (const item of eligibleNow) {
      if (placed >= quota) break;
      levels.set(item.tempId, level);
      placed += 1;
    }
    levelCounts.set(level, placed);
  }

  return levels;
}
