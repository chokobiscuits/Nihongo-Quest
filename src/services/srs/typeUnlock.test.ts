import { describe, expect, it } from "vitest";
import {
  typeUnlockStatuses,
  isTypeUnlocked,
  KANJI_UNLOCK_RADICAL_GURU,
  VOCAB_UNLOCK_KANJI_GURU,
  SENTENCE_UNLOCK_VOCAB_GURU,
  GRAMMAR_UNLOCK_VOCAB_GURU,
  READING_UNLOCK_GRAMMAR_GURU,
  type GuruCounts,
} from "./typeUnlock";

const zero: GuruCounts = { RADICAL: 0, KANJI: 0, VOCAB: 0, GRAMMAR: 0 };

describe("typeUnlockStatuses", () => {
  it("locks everything when Guru counts are all zero", () => {
    const s = typeUnlockStatuses(zero);
    expect(s.KANJI.unlocked).toBe(false);
    expect(s.VOCAB.unlocked).toBe(false);
    expect(s.SENTENCE.unlocked).toBe(false);
    expect(s.GRAMMAR.unlocked).toBe(false);
    expect(s.READING.unlocked).toBe(false);
  });

  it("reports have/need for a locked type", () => {
    const s = typeUnlockStatuses({ ...zero, RADICAL: 3 });
    expect(s.KANJI).toMatchObject({ unlocked: false, have: 3, need: KANJI_UNLOCK_RADICAL_GURU });
    expect(s.KANJI.requirement).toBe("Guru 10 radicals");
  });

  it("KANJI unlocks one below the radical threshold: still locked", () => {
    const s = typeUnlockStatuses({ ...zero, RADICAL: KANJI_UNLOCK_RADICAL_GURU - 1 });
    expect(s.KANJI.unlocked).toBe(false);
  });

  it("KANJI unlocks exactly at the radical threshold", () => {
    const s = typeUnlockStatuses({ ...zero, RADICAL: KANJI_UNLOCK_RADICAL_GURU });
    expect(s.KANJI.unlocked).toBe(true);
  });

  it("KANJI stays unlocked above the threshold", () => {
    const s = typeUnlockStatuses({ ...zero, RADICAL: KANJI_UNLOCK_RADICAL_GURU + 5 });
    expect(s.KANJI.unlocked).toBe(true);
  });

  it("VOCAB unlocks exactly at the kanji threshold", () => {
    const below = typeUnlockStatuses({ ...zero, KANJI: VOCAB_UNLOCK_KANJI_GURU - 1 });
    const at = typeUnlockStatuses({ ...zero, KANJI: VOCAB_UNLOCK_KANJI_GURU });
    expect(below.VOCAB.unlocked).toBe(false);
    expect(at.VOCAB.unlocked).toBe(true);
  });

  it("SENTENCE unlocks exactly at the vocab threshold (50)", () => {
    const below = typeUnlockStatuses({ ...zero, VOCAB: SENTENCE_UNLOCK_VOCAB_GURU - 1 });
    const at = typeUnlockStatuses({ ...zero, VOCAB: SENTENCE_UNLOCK_VOCAB_GURU });
    expect(below.SENTENCE.unlocked).toBe(false);
    expect(at.SENTENCE.unlocked).toBe(true);
  });

  it("GRAMMAR unlocks exactly at the vocab threshold (50, same as sentence)", () => {
    const below = typeUnlockStatuses({ ...zero, VOCAB: GRAMMAR_UNLOCK_VOCAB_GURU - 1 });
    const at = typeUnlockStatuses({ ...zero, VOCAB: GRAMMAR_UNLOCK_VOCAB_GURU });
    expect(below.GRAMMAR.unlocked).toBe(false);
    expect(at.GRAMMAR.unlocked).toBe(true);
  });

  it("READING unlocks exactly at the grammar threshold (20)", () => {
    const below = typeUnlockStatuses({ ...zero, GRAMMAR: READING_UNLOCK_GRAMMAR_GURU - 1 });
    const at = typeUnlockStatuses({ ...zero, GRAMMAR: READING_UNLOCK_GRAMMAR_GURU });
    expect(below.READING.unlocked).toBe(false);
    expect(at.READING.unlocked).toBe(true);
  });
});

describe("isTypeUnlocked", () => {
  it("KANA is always unlocked", () => {
    expect(isTypeUnlocked("KANA" as never, zero)).toBe(true);
  });

  it("RADICAL is always unlocked (kana-resolution gate lives elsewhere)", () => {
    expect(isTypeUnlocked("RADICAL" as never, zero)).toBe(true);
  });

  it("KANJI follows typeUnlockStatuses", () => {
    expect(isTypeUnlocked("KANJI" as never, zero)).toBe(false);
    expect(isTypeUnlocked("KANJI" as never, { ...zero, RADICAL: KANJI_UNLOCK_RADICAL_GURU })).toBe(true);
  });
});
