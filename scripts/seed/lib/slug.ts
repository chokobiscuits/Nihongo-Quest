// Subject.slug must be globally unique across radicals, kanji, and vocab.
// We prefix by type and use the literal characters (or a transliteration for
// radicals without a Unicode kanji form), falling back to an index suffix on
// collision. The caller is responsible for tracking used slugs across a run.
export function baseSlug(type: "radical" | "kanji" | "vocab" | "sentence", characters: string): string {
  return `${type}-${characters}`;
}

/// Appends a disambiguating suffix once a base slug collides (e.g. multiple
/// JMdict entries sharing kanji+reading with different senses).
export function dedupeSlug(base: string, used: Set<string>): string {
  if (!used.has(base)) {
    used.add(base);
    return base;
  }
  let n = 2;
  while (used.has(`${base}-${n}`)) n += 1;
  const slug = `${base}-${n}`;
  used.add(slug);
  return slug;
}
