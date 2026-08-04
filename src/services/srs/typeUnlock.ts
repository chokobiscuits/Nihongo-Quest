// Type-level unlocking: which SubjectTypes are open for lessons at all,
// independent of per-type curriculum level (curriculum.ts) and per-item
// component gating (unlock.ts). Soft gating — a locked type stays visible
// and browsable; it just contributes no lesson items (see
// src/services/lessons/batch.ts's caller in
// src/server/queries/lessons.ts).
//
// Thresholds are Guru counts (srsStage >= 5) of a prerequisite type. KANA and
// RADICAL have no prerequisite: KANA is the pre-curriculum gate itself,
// RADICAL is gated only by kana-resolution (see kana-gate.ts), never by a
// Guru count.

import type { SubjectType } from "@/generated/prisma/enums";

export const KANJI_UNLOCK_RADICAL_GURU = 10;
export const VOCAB_UNLOCK_KANJI_GURU = 10;
export const SENTENCE_UNLOCK_VOCAB_GURU = 50;
export const GRAMMAR_UNLOCK_VOCAB_GURU = 50;
export const READING_UNLOCK_GRAMMAR_GURU = 20;

export interface GuruCounts {
  RADICAL: number;
  KANJI: number;
  VOCAB: number;
  GRAMMAR: number;
}

export interface TypeUnlockStatus {
  type: SubjectType;
  unlocked: boolean;
  /// Human-readable requirement, e.g. "Guru 10 kanji". Null for types with
  /// no Guru-count prerequisite (KANA, RADICAL).
  requirement: string | null;
  have: number;
  need: number;
}

const REQUIREMENTS: {
  type: "KANJI" | "VOCAB" | "SENTENCE" | "GRAMMAR" | "READING";
  need: number;
  of: keyof GuruCounts;
  label: string;
}[] = [
  { type: "KANJI", need: KANJI_UNLOCK_RADICAL_GURU, of: "RADICAL", label: "radicals" },
  { type: "VOCAB", need: VOCAB_UNLOCK_KANJI_GURU, of: "KANJI", label: "kanji" },
  { type: "SENTENCE", need: SENTENCE_UNLOCK_VOCAB_GURU, of: "VOCAB", label: "vocabulary" },
  { type: "GRAMMAR", need: GRAMMAR_UNLOCK_VOCAB_GURU, of: "VOCAB", label: "vocabulary" },
  { type: "READING", need: READING_UNLOCK_GRAMMAR_GURU, of: "GRAMMAR", label: "grammar points" },
];

/// Computes unlock status for every gated type given the user's current Guru
/// counts. KANA and RADICAL are not included — they are always unlocked (per
/// the "Decisions already made" #3: KANA and RADICAL are always unlocked;
/// RADICAL additionally still respects the existing kana-resolved gate,
/// which is orthogonal to this module — see kana-gate.ts).
export function typeUnlockStatuses(guru: GuruCounts): Record<"KANJI" | "VOCAB" | "SENTENCE" | "GRAMMAR" | "READING", TypeUnlockStatus> {
  const result = {} as Record<"KANJI" | "VOCAB" | "SENTENCE" | "GRAMMAR" | "READING", TypeUnlockStatus>;
  for (const req of REQUIREMENTS) {
    const have = guru[req.of];
    result[req.type] = {
      type: req.type as unknown as SubjectType,
      unlocked: have >= req.need,
      requirement: `Guru ${req.need} ${req.label}`,
      have,
      need: req.need,
    };
  }
  return result;
}

/// Whether a single type is unlocked. KANA and RADICAL always return true
/// here (RADICAL's kana gate is handled separately by isSubjectUnlocked).
export function isTypeUnlocked(type: SubjectType, guru: GuruCounts): boolean {
  if (type === "KANA" || type === "RADICAL") return true;
  const statuses = typeUnlockStatuses(guru);
  const key = type as keyof typeof statuses;
  return statuses[key]?.unlocked ?? true;
}
