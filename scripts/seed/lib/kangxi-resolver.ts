// Resolves a raw glyph (as it appears in KRADFILE component lists) to its
// canonical Kangxi radical, folding known variant forms (氵 -> 水, 忄 -> 心,
// ⺅ -> 人, ...) onto the radical they belong to. Components with no match in
// KANGXI_RADICALS are not Kangxi radicals at all (KRADFILE decomposes kanji
// into visual parts more finely than the 214-radical set) and the caller
// should drop them from the unlock graph rather than inventing an unnamed
// radical for them.
import { KANGXI_RADICALS, type KangxiRadical } from "./kangxi-radicals";

export function buildKangxiResolver(): Map<string, KangxiRadical> {
  const map = new Map<string, KangxiRadical>();
  for (const radical of KANGXI_RADICALS) {
    map.set(radical.character, radical);
    for (const variant of radical.variants) {
      map.set(variant, radical);
    }
  }
  return map;
}

/// Romaji-derived slug segment for a Kangxi radical, e.g. "water" for 水.
/// Radical slugs are `radical-<number>-<romaji-name>`, per the task's
/// stability requirement — the English name (lowercased, spaces/commas
/// replaced with hyphens) rather than the romaji reading, since `name` is
/// what the slug spec example ("radical-85-water") uses.
export function radicalSlugName(radical: KangxiRadical): string {
  return radical.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
