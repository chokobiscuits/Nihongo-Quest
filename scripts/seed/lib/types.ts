// Shared shapes for the transform-phase artifacts written to
// data/processed/*.jsonl. These mirror the Prisma schema closely enough that
// load.ts can upsert them almost verbatim, but stay decoupled from the
// generated Prisma client so the transform phase has zero DB dependency.

export type SubjectType = "KANA" | "RADICAL" | "KANJI" | "VOCAB" | "SENTENCE" | "GRAMMAR";

/// WaniKani-style meaning/reading entry: a flat list with one "primary" flag.
export interface MeaningEntry {
  meaning: string;
  primary: boolean;
}

export interface ReadingEntry {
  reading: string;
  primary: boolean;
  /// e.g. "onyomi" | "kunyomi" | "nanori" for kanji; "kana" for vocab.
  type?: string;
}

export interface FuriganaSegment {
  ruby: string;
  rt?: string;
}

/// One row of data/processed/subjects.jsonl. `tempId` is a stable, source-
/// derived key (not a cuid) used only to wire up SubjectComponent edges
/// before real ids exist; load.ts resolves it to the DB id at upsert time.
export interface SubjectRecord {
  tempId: string;
  type: SubjectType;
  /// Curriculum level 1-60, or null when the subject is seeded but not part
  /// of the 60-level ladder (searchable/linkable, not scheduled).
  level: number | null;
  slug: string;
  characters: string | null;
  meanings: MeaningEntry[];
  readings: ReadingEntry[];
  jlpt: number | null;
  jlptLegacy: number | null;
  frequency: number | null;
  metadata: Record<string, unknown>;
  furigana: FuriganaSegment[] | null;
  furiganaFallback: boolean;
}

/// One row of data/processed/components.jsonl. Ids are `tempId`s from
/// subjects.jsonl, resolved to real Subject ids in load.ts.
export interface ComponentRecord {
  parentTempId: string;
  childTempId: string;
  position: string | null;
  isRadical: boolean;
  readingUsed: string | null;
  /// True when this edge should gate its parent's runtime unlock — see
  /// src/services/srs/unlock.ts's componentsSatisfied, which only considers
  /// gating components. Every RADICAL/KANJI/VOCAB component edge is gating.
  /// SENTENCE -> VOCAB edges are gating only for the sentence's CONTENT-word
  /// vocab (nouns, verbs, adjectives, adverbs) that is ALSO laddered (has a
  /// non-null level, i.e. actually taught); function-word vocab (particles,
  /// copula, auxiliaries, conjunctions, pronouns, counters, interjections —
  /// see scripts/seed/lib/pos-classifier.ts) and off-ladder content vocab
  /// (seeded but outside the curriculum ladder, so never learnable) both
  /// still get an edge, for UI highlighting/linking, but must not block
  /// unlock — a gating edge to an off-ladder subject would be a permanent
  /// lock. Loaded into SubjectComponent.isGating by load.ts.
  isGating: boolean;
}

export interface DataSourceRecord {
  name: string;
  url: string;
  license: string;
  versionDate: string; // ISO date, e.g. "2024-06-01"
  attribution: string;
}
