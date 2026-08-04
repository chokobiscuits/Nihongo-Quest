import type { SubjectType } from "@/generated/prisma/enums";

/// Discriminated union of every tutorial trigger shape. Stored as `Tutorial.trigger`
/// Json in the DB — this is the TS-side contract for that column's shape.
/// Only RADICAL/KANJI/VOCAB/SENTENCE are valid for `before_first` (the four
/// ladder types lessons actually teach — see LADDER_TYPES in
/// src/server/queries/lessons.ts).
export type TutorialSubjectType = Extract<SubjectType, "RADICAL" | "KANJI" | "VOCAB" | "SENTENCE">;

export type TutorialTrigger =
  | { kind: "first_launch" }
  | { kind: "before_first"; subjectType: TutorialSubjectType }
  | { kind: "account_level"; level: number }
  | { kind: "first_guru" }
  | { kind: "first_burn" }
  | { kind: "first_multi_kanji_word" }
  | { kind: "manual" };
