import { describe, expect, it } from "vitest";
import { mergeMnemonicFields } from "./mnemonics";

const seededSubject = {
  meaningMnemonic: "seeded meaning mnemonic",
  readingMnemonic: "seeded reading mnemonic",
  meaningHint: "seeded meaning hint",
  readingHint: "seeded reading hint",
  acceptedMeanings: ["seeded synonym"],
};

describe("mergeMnemonicFields", () => {
  it("falls back to the Subject's seeded fields when there is no override", () => {
    expect(mergeMnemonicFields(seededSubject, null)).toEqual({
      meaningMnemonic: "seeded meaning mnemonic",
      readingMnemonic: "seeded reading mnemonic",
      meaningHint: "seeded meaning hint",
      readingHint: "seeded reading hint",
      acceptedMeanings: ["seeded synonym"],
    });
  });

  it("prefers the user's override field by field over the seeded default", () => {
    const override = {
      meaningMnemonic: "my own meaning mnemonic",
      readingMnemonic: null,
      meaningHint: null,
      readingHint: null,
      acceptedMeanings: ["my synonym"],
    };

    expect(mergeMnemonicFields(seededSubject, override)).toEqual({
      meaningMnemonic: "my own meaning mnemonic",
      // Override left this null -> seeded fallback still applies per field.
      readingMnemonic: "seeded reading mnemonic",
      meaningHint: "seeded meaning hint",
      readingHint: "seeded reading hint",
      acceptedMeanings: ["my synonym"],
    });
  });

  it("two different subjects' merges never share state", () => {
    const subjectA = { ...seededSubject, meaningMnemonic: "A's seeded mnemonic" };
    const subjectB = { ...seededSubject, meaningMnemonic: "B's seeded mnemonic" };
    const overrideA = { meaningMnemonic: "A's own mnemonic", readingMnemonic: null, meaningHint: null, readingHint: null, acceptedMeanings: [] };

    const mergedA = mergeMnemonicFields(subjectA, overrideA);
    const mergedB = mergeMnemonicFields(subjectB, null);

    expect(mergedA.meaningMnemonic).toBe("A's own mnemonic");
    expect(mergedB.meaningMnemonic).toBe("B's seeded mnemonic");
  });

  it("two different users' overrides for the same subject never leak into each other", () => {
    const overrideUser1 = { meaningMnemonic: "user1's mnemonic", readingMnemonic: null, meaningHint: null, readingHint: null, acceptedMeanings: ["user1 synonym"] };
    const overrideUser2 = { meaningMnemonic: "user2's mnemonic", readingMnemonic: null, meaningHint: null, readingHint: null, acceptedMeanings: ["user2 synonym"] };

    const mergedForUser1 = mergeMnemonicFields(seededSubject, overrideUser1);
    const mergedForUser2 = mergeMnemonicFields(seededSubject, overrideUser2);

    expect(mergedForUser1.meaningMnemonic).toBe("user1's mnemonic");
    expect(mergedForUser1.acceptedMeanings).toEqual(["user1 synonym"]);
    expect(mergedForUser2.meaningMnemonic).toBe("user2's mnemonic");
    expect(mergedForUser2.acceptedMeanings).toEqual(["user2 synonym"]);
  });
});
