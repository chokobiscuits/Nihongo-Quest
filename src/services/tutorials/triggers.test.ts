import { describe, expect, it } from "vitest";
import { isTriggered, type TutorialStats } from "./triggers";
import type { TutorialTrigger } from "./trigger-types";

const ZERO_COUNTS = { RADICAL: 0, KANJI: 0, VOCAB: 0, SENTENCE: 0 };

const BASE_STATS: TutorialStats = {
  accountLevel: 1,
  startedByType: { ...ZERO_COUNTS },
  passedByType: { ...ZERO_COUNTS },
  burnedByType: { ...ZERO_COUNTS },
  hasMultiKanjiWordStarted: false,
  hasCompletedAnyTutorial: false,
};

describe("isTriggered", () => {
  describe("first_launch", () => {
    const trigger: TutorialTrigger = { kind: "first_launch" };

    it("triggers when no tutorial has ever been completed", () => {
      expect(isTriggered(trigger, BASE_STATS)).toBe(true);
    });

    it("does not trigger once any tutorial has been completed", () => {
      expect(isTriggered(trigger, { ...BASE_STATS, hasCompletedAnyTutorial: true })).toBe(false);
    });
  });

  describe("before_first", () => {
    const trigger: TutorialTrigger = { kind: "before_first", subjectType: "KANJI" };

    it("triggers when the type has zero started subjects", () => {
      expect(isTriggered(trigger, BASE_STATS)).toBe(true);
    });

    it("does not trigger once one subject of that type has been started", () => {
      const stats: TutorialStats = {
        ...BASE_STATS,
        startedByType: { ...ZERO_COUNTS, KANJI: 1 },
      };
      expect(isTriggered(trigger, stats)).toBe(false);
    });

    it("is scoped to its own subject type only", () => {
      const stats: TutorialStats = {
        ...BASE_STATS,
        startedByType: { ...ZERO_COUNTS, RADICAL: 5 },
      };
      expect(isTriggered(trigger, stats)).toBe(true);
    });
  });

  describe("account_level", () => {
    const trigger: TutorialTrigger = { kind: "account_level", level: 5 };

    it("does not trigger below the level", () => {
      expect(isTriggered(trigger, { ...BASE_STATS, accountLevel: 4 })).toBe(false);
    });

    it("triggers exactly at the boundary level", () => {
      expect(isTriggered(trigger, { ...BASE_STATS, accountLevel: 5 })).toBe(true);
    });

    it("triggers above the level", () => {
      expect(isTriggered(trigger, { ...BASE_STATS, accountLevel: 6 })).toBe(true);
    });
  });

  describe("first_guru", () => {
    const trigger: TutorialTrigger = { kind: "first_guru" };

    it("does not trigger with zero passed subjects of any type", () => {
      expect(isTriggered(trigger, BASE_STATS)).toBe(false);
    });

    it("triggers once any type has a passed subject", () => {
      const stats: TutorialStats = { ...BASE_STATS, passedByType: { ...ZERO_COUNTS, VOCAB: 1 } };
      expect(isTriggered(trigger, stats)).toBe(true);
    });
  });

  describe("first_burn", () => {
    const trigger: TutorialTrigger = { kind: "first_burn" };

    it("does not trigger with zero burned subjects of any type", () => {
      expect(isTriggered(trigger, BASE_STATS)).toBe(false);
    });

    it("triggers once any type has a burned subject", () => {
      const stats: TutorialStats = { ...BASE_STATS, burnedByType: { ...ZERO_COUNTS, KANJI: 1 } };
      expect(isTriggered(trigger, stats)).toBe(true);
    });
  });

  describe("first_multi_kanji_word", () => {
    const trigger: TutorialTrigger = { kind: "first_multi_kanji_word" };

    it("does not trigger when false", () => {
      expect(isTriggered(trigger, BASE_STATS)).toBe(false);
    });

    it("triggers when true", () => {
      expect(isTriggered(trigger, { ...BASE_STATS, hasMultiKanjiWordStarted: true })).toBe(true);
    });
  });

  describe("manual", () => {
    const trigger: TutorialTrigger = { kind: "manual" };

    it("never auto-triggers, regardless of stats", () => {
      expect(isTriggered(trigger, BASE_STATS)).toBe(false);
      expect(
        isTriggered(trigger, {
          ...BASE_STATS,
          accountLevel: 100,
          hasCompletedAnyTutorial: true,
          hasMultiKanjiWordStarted: true,
        }),
      ).toBe(false);
    });
  });
});
