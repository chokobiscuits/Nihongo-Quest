import { describe, expect, it } from "vitest";
import {
  CELEBRATION_SOUND,
  SOUND_MANIFEST,
  comboRateFor,
  DEFAULT_SOUND_VOLUME,
  type SoundId,
} from "./manifest";

const ALL_IDS = Object.keys(SOUND_MANIFEST) as SoundId[];

describe("SOUND_MANIFEST", () => {
  it("points every id at a file under /sounds/", () => {
    for (const id of ALL_IDS) {
      expect(SOUND_MANIFEST[id].src).toMatch(/^\/sounds\/[\w-]+\.webm$/);
    }
  });

  it("gives every id a distinct source file", () => {
    const srcs = ALL_IDS.map((id) => SOUND_MANIFEST[id].src);
    expect(new Set(srcs).size).toBe(ALL_IDS.length);
  });

  // gain multiplies the user's volume, so a value above ~2 would let one
  // sound blow past the level every other sound respects.
  it("keeps every gain within a sane range", () => {
    for (const id of ALL_IDS) {
      const { gain } = SOUND_MANIFEST[id];
      expect(gain).toBeGreaterThan(0);
      expect(gain).toBeLessThanOrEqual(2);
    }
  });

  it("throttles only the sounds that can fire in bursts", () => {
    expect(SOUND_MANIFEST["ui.hover"].throttleMs).toBeGreaterThan(0);
    expect(SOUND_MANIFEST["answer.correct"].throttleMs).toBeUndefined();
  });

  it("keeps the wrong-answer sound quieter than the correct one", () => {
    // The app re-queues a miss rather than failing it, so the miss should
    // read as a nudge rather than a buzzer.
    expect(SOUND_MANIFEST["answer.wrong"].gain).toBeLessThan(SOUND_MANIFEST["answer.correct"].gain);
  });
});

describe("CELEBRATION_SOUND", () => {
  it("maps every celebration kind to a real manifest entry", () => {
    for (const id of Object.values(CELEBRATION_SOUND)) {
      expect(SOUND_MANIFEST[id]).toBeDefined();
    }
  });

  it("gives each kind its own sound", () => {
    const ids = Object.values(CELEBRATION_SOUND);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("comboRateFor", () => {
  it("plays at natural pitch on the first correct answer", () => {
    expect(comboRateFor(0)).toBe(1);
  });

  it("climbs a semitone per consecutive correct answer", () => {
    expect(comboRateFor(1)).toBeCloseTo(2 ** (1 / 12), 10);
    expect(comboRateFor(3)).toBeCloseTo(2 ** (3 / 12), 10);
  });

  it("caps at five semitones so a long run does not go shrill", () => {
    const cap = 2 ** (5 / 12);
    expect(comboRateFor(5)).toBeCloseTo(cap, 10);
    expect(comboRateFor(50)).toBeCloseTo(cap, 10);
  });

  it("treats a negative or fractional streak as no lift", () => {
    expect(comboRateFor(-3)).toBe(1);
    expect(comboRateFor(0.9)).toBe(1);
  });
});

describe("defaults", () => {
  it("keeps the default volume in range", () => {
    expect(DEFAULT_SOUND_VOLUME).toBeGreaterThan(0);
    expect(DEFAULT_SOUND_VOLUME).toBeLessThanOrEqual(1);
  });
});
