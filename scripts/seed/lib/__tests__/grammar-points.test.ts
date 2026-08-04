import { describe, expect, it } from "vitest";
import { GRAMMAR_POINTS } from "../grammar-points";

describe("GRAMMAR_POINTS", () => {
  it("has unique, kebab-case ascii slugs", () => {
    const slugs = GRAMMAR_POINTS.map((p) => p.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    for (const slug of slugs) {
      expect(slug).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
    }
  });

  it("every relatedSlugs entry references a real point in the list", () => {
    const slugs = new Set(GRAMMAR_POINTS.map((p) => p.slug));
    for (const point of GRAMMAR_POINTS) {
      for (const related of point.relatedSlugs) {
        expect(slugs.has(related)).toBe(true);
      }
      // A point should never list itself as related.
      expect(point.relatedSlugs).not.toContain(point.slug);
    }
  });

  it("has at least one matchPattern per point, and every pattern is a non-empty regex", () => {
    for (const point of GRAMMAR_POINTS) {
      expect(point.matchPatterns.length).toBeGreaterThan(0);
      for (const re of point.matchPatterns) {
        expect(re).toBeInstanceOf(RegExp);
        expect(re.source.length).toBeGreaterThan(0);
      }
    }
  });

  it("covers only N5-N3 (jlpt 5, 4, or 3)", () => {
    for (const point of GRAMMAR_POINTS) {
      expect([5, 4, 3]).toContain(point.jlpt);
    }
  });

  it("has non-empty pattern, titleEn, and formation for every point", () => {
    for (const point of GRAMMAR_POINTS) {
      expect(point.pattern.length).toBeGreaterThan(0);
      expect(point.titleEn.length).toBeGreaterThan(0);
      expect(point.formation.length).toBeGreaterThan(0);
    }
  });

  it("is ordered N5 first, then N4, then N3", () => {
    const bandRank: Record<number, number> = { 5: 0, 4: 1, 3: 2 };
    const ranks = GRAMMAR_POINTS.map((p) => bandRank[p.jlpt]);
    const sorted = [...ranks].sort((a, b) => a - b);
    expect(ranks).toEqual(sorted);
  });

  it("has no bare-particle-style over-broad pattern (single unanchored common particle)", () => {
    const tooLoose = [/^は$/, /^が$/, /^を$/, /^に$/, /^で$/];
    for (const point of GRAMMAR_POINTS) {
      for (const re of point.matchPatterns) {
        for (const loose of tooLoose) {
          expect(re.source).not.toBe(loose.source);
        }
      }
    }
  });
});
