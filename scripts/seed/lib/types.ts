// Shared shapes for the transform-phase artifacts written to
// data/processed/*.jsonl. These mirror the Prisma schema closely enough that
// load.ts can upsert them almost verbatim, but stay decoupled from the
// generated Prisma client so the transform phase has zero DB dependency.

export type SubjectType = "RADICAL" | "KANJI" | "VOCAB";

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
  level: number;
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
}

export interface DataSourceRecord {
  name: string;
  url: string;
  license: string;
  versionDate: string; // ISO date, e.g. "2024-06-01"
  attribution: string;
}
