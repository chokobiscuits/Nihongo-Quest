import { describe, expect, it } from "vitest";
import { CHANGELOG, isKnownReleaseId, latestRelease } from "./changelog";

describe("CHANGELOG", () => {
  it("has unique release ids", () => {
    const ids = CHANGELOG.map((release) => release.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("is sorted newest first", () => {
    const dates = CHANGELOG.map((release) => release.date);
    expect([...dates].sort().reverse()).toEqual(dates);
    const ids = CHANGELOG.map((release) => release.id);
    expect([...ids].sort().reverse()).toEqual(ids);
  });

  it("uses ISO dates, and ids that start with the release date", () => {
    for (const release of CHANGELOG) {
      expect(release.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(release.id.startsWith(release.date)).toBe(true);
    }
  });

  it("gives every release a title and at least one highlight", () => {
    for (const release of CHANGELOG) {
      expect(release.title.trim().length).toBeGreaterThan(0);
      expect(release.highlights.length).toBeGreaterThan(0);
      for (const highlight of release.highlights) expect(highlight.trim().length).toBeGreaterThan(0);
    }
  });

  it("has no em or en dashes in user-facing text", () => {
    for (const release of CHANGELOG) {
      const text = [release.title, release.details ?? "", ...release.highlights].join(" ");
      expect(text).not.toMatch(/[\u2013\u2014]/);
    }
  });
});

describe("latestRelease", () => {
  it("is the first entry", () => {
    expect(latestRelease()).toBe(CHANGELOG[0]);
  });
});

describe("isKnownReleaseId", () => {
  it("accepts every release id", () => {
    for (const release of CHANGELOG) expect(isKnownReleaseId(release.id)).toBe(true);
  });

  it("rejects unknown ids and non-strings", () => {
    for (const bad of ["", "2099-01-01", "constructor", null, undefined, 20261031, {}, ["2026-10-31"], true]) {
      expect(isKnownReleaseId(bad)).toBe(false);
    }
  });
});
