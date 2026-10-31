// Turns Subject rows into the list of clips to synthesize. Pure: no DB, no
// network. The set of texts comes from `subjectSpeechTexts`, the same helper
// the UI's play buttons derive their text from, so a clip exists for
// everything the UI can ask for.
import { normalizeSpeechText, speechAudioKey } from "../../src/components/speech/speechAudio";
import { subjectSpeechTexts } from "../../src/components/speech/speechText";

/// How a clip is synthesized:
///   kana     the text is kana to be spoken exactly as written (kana glyphs,
///            kanji readings): built from kana notation, never guessed
///   word     a vocab reading: the kanji word is synthesized when the engine
///            reads it the same way, otherwise the kana
///   sentence same as word, for a full sentence
export type JobKind = "kana" | "word" | "sentence";

export interface AudioJob {
  /// Bucket-relative object key, derived from `text` alone.
  key: string;
  /// The exact UI text this clip answers for (normalized).
  text: string;
  kind: JobKind;
  /// Kanji form to try first for verification, or null when `text` is it.
  source: string | null;
  /// Human-readable origin for logs and the failure report.
  label: string;
}

export interface SubjectRow {
  id: string;
  type: string;
  slug: string;
  characters: string | null;
  readings: unknown;
  furigana: unknown;
}

const KIND_PRIORITY: Record<JobKind, number> = { kana: 0, word: 1, sentence: 2 };

export function jobsForSubject(row: SubjectRow): AudioJob[] {
  const subject = {
    type: row.type,
    characters: row.characters,
    readings: Array.isArray(row.readings) ? (row.readings as { reading: string; primary: boolean; type?: string }[]) : [],
    furigana: Array.isArray(row.furigana) ? (row.furigana as { ruby: string; rt?: string }[]) : null,
  };

  const kind: JobKind | null =
    row.type === "KANA" || row.type === "KANJI"
      ? "kana"
      : row.type === "VOCAB"
        ? "word"
        : row.type === "SENTENCE"
          ? "sentence"
          : null;
  if (!kind) return [];

  return subjectSpeechTexts(subject).map((raw) => {
    const text = normalizeSpeechText(raw);
    const characters = row.characters ? normalizeSpeechText(row.characters) : null;
    return {
      key: speechAudioKey(text),
      text,
      kind,
      source: kind !== "kana" && characters && characters !== text ? characters : null,
      label: `${row.type} ${row.slug}`,
    };
  });
}

/// Collapses jobs that share a key. When the same text is wanted both as a
/// plain kana clip and a verified word (a kanji reading that is also a vocab
/// word), the kana clip wins: it is the deterministic one. Two different
/// texts landing on one key is a hash collision and is reported, not hidden.
export function dedupeJobs(jobs: AudioJob[]): { jobs: AudioJob[]; collisions: [AudioJob, AudioJob][] } {
  const byKey = new Map<string, AudioJob>();
  const collisions: [AudioJob, AudioJob][] = [];
  for (const job of jobs) {
    const existing = byKey.get(job.key);
    if (!existing) {
      byKey.set(job.key, job);
    } else if (existing.text !== job.text) {
      collisions.push([existing, job]);
    } else if (KIND_PRIORITY[job.kind] < KIND_PRIORITY[existing.kind]) {
      byKey.set(job.key, job);
    }
  }
  return { jobs: [...byKey.values()], collisions };
}
