import { describe, expect, it } from "vitest";
import { mayRevealPronunciation } from "./quizAudio";

const meaning = (itemId: string) => ({ kind: "MEANING", itemId });
const reading = (itemId: string) => ({ kind: "READING", itemId });

describe("mayRevealPronunciation", () => {
  it("withholds audio after a meaning answer while the item's reading is pending", () => {
    expect(mayRevealPronunciation(meaning("a"), [meaning("b"), reading("a")])).toBe(false);
  });

  it("allows audio after a meaning answer once the reading is done", () => {
    expect(mayRevealPronunciation(meaning("a"), [meaning("b"), reading("b")])).toBe(true);
  });

  it("allows audio for meaning-only items", () => {
    expect(mayRevealPronunciation(meaning("a"), [])).toBe(true);
    expect(mayRevealPronunciation(meaning("a"), [meaning("a")])).toBe(true);
  });

  it("ignores other items' pending readings", () => {
    expect(mayRevealPronunciation(meaning("a"), [reading("b"), reading("c")])).toBe(true);
  });

  it("always allows audio after a reading answer", () => {
    expect(mayRevealPronunciation(reading("a"), [reading("a"), meaning("a")])).toBe(true);
  });

  it("withholds audio when a re-queued reading is behind the current meaning", () => {
    // Reading answered wrong earlier and sent to the back; the meaning is now up.
    expect(mayRevealPronunciation(meaning("a"), [meaning("b"), reading("a")])).toBe(false);
  });
});
