// KANA is graded meaning-only, but its "meaning" is the romaji reading
// itself (see scripts/seed/lib/kana.ts, which stores romaji in `meanings`
// rather than `readings` so the existing meaning-question grading path
// applies unmodified — but plain string-equality meaning grading has no
// notion of romanization variants, so KANA answers need a small variant
// table layered on top). Maps a stored canonical romaji spelling to every
// alternate spelling that should also grade as correct.
//
// ん (n) is a special case: both "n" and "nn" are accepted regardless of
// what's stored, so it's expanded separately rather than through this table
// (see acceptedKanaRomaji below).
export const KANA_ROMAJI_VARIANTS: Record<string, string[]> = {
  shi: ["si"],
  chi: ["ti"],
  tsu: ["tu"],
  fu: ["hu"],
  ji: ["zi"],
  // Youon (palatalized) forms built on the same base kana carry the same
  // variant spelling, e.g. しゃ = sha, historically also "sya".
  sha: ["sya"],
  shu: ["syu"],
  sho: ["syo"],
  cha: ["tya"],
  chu: ["tyu"],
  cho: ["tyo"],
  ja: ["zya"],
  ju: ["zyu"],
  jo: ["zyo"],
};

/// Every romaji spelling that should grade as correct for a KANA subject
/// whose canonical stored romaji is `canonical` — the canonical spelling
/// itself, plus its variant-table alternates, plus (for ん) both "n" and
/// "nn" regardless of which one is canonical.
export function acceptedKanaRomaji(canonical: string): string[] {
  const accepted = new Set<string>([canonical]);
  for (const variant of KANA_ROMAJI_VARIANTS[canonical] ?? []) accepted.add(variant);

  if (canonical === "n" || canonical === "nn") {
    accepted.add("n");
    accepted.add("nn");
  }

  return [...accepted];
}
