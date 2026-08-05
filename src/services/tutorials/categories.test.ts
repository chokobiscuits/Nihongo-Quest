import { describe, expect, it } from "vitest";
import { TUTORIALS } from "../../../scripts/seed/lib/tutorials";
import {
  categorizeTutorials,
  categoryForTutorial,
  TUTORIAL_CATEGORIES,
  TUTORIAL_CATEGORY_INFO,
} from "./categories";

function tut(slug: string, completed = false) {
  return { slug, completed };
}

describe("categoryForTutorial", () => {
  it("maps app-mechanics slugs to APP, including the SRS ones", () => {
    // SRS rules are this app's decisions, not facts about Japanese, so they
    // belong with the app mechanics rather than the language.
    for (const slug of [
      "how-this-app-works",
      "how-to-answer",
      "what-is-guru",
      "srs-ladder",
      "mastery-vs-srs-stage",
      "kana-skip-flow",
      "lessons-and-reviews",
    ]) {
      expect(categoryForTutorial(slug)).toBe("APP");
    }
  });

  it("maps furigana to LANGUAGE, not REFERENCE", () => {
    // Furigana is a feature of written Japanese, not of this app.
    expect(categoryForTutorial("furigana-explained")).toBe("LANGUAGE");
  });

  it("maps the JLPT to REFERENCE", () => {
    expect(categoryForTutorial("jlpt-explained")).toBe("REFERENCE");
  });

  it("falls back to UNCATEGORIZED for an unknown slug", () => {
    expect(categoryForTutorial("not-a-real-tutorial")).toBe("UNCATEGORIZED");
  });
});

describe("categorizeTutorials", () => {
  it("returns categories in TUTORIAL_CATEGORIES order regardless of input order", () => {
    const groups = categorizeTutorials([
      tut("jlpt-explained"),
      tut("reading-japanese"),
      tut("how-this-app-works"),
    ]);
    expect(groups.map((g) => g.category.id)).toEqual(["APP", "LANGUAGE", "REFERENCE"]);
  });

  it("preserves input order within a category", () => {
    const groups = categorizeTutorials([
      tut("srs-ladder"),
      tut("how-this-app-works"),
      tut("what-is-guru"),
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0].tutorials.map((t) => t.slug)).toEqual([
      "srs-ladder",
      "how-this-app-works",
      "what-is-guru",
    ]);
  });

  it("counts completions per category, not globally", () => {
    const groups = categorizeTutorials([
      tut("how-this-app-works", true),
      tut("srs-ladder", false),
      tut("reading-japanese", true),
      tut("okurigana", true),
    ]);
    const byId = new Map(groups.map((g) => [g.category.id, g]));
    expect(byId.get("APP")!.completedCount).toBe(1);
    expect(byId.get("APP")!.tutorials).toHaveLength(2);
    expect(byId.get("LANGUAGE")!.completedCount).toBe(2);
  });

  it("omits empty categories", () => {
    const groups = categorizeTutorials([tut("okurigana")]);
    expect(groups).toHaveLength(1);
    expect(groups[0].category.id).toBe("LANGUAGE");
  });

  it("returns an empty array for no tutorials", () => {
    expect(categorizeTutorials([])).toEqual([]);
  });

  it("surfaces unmapped slugs in the UNCATEGORIZED group rather than dropping them", () => {
    const groups = categorizeTutorials([tut("okurigana"), tut("brand-new-tutorial")]);
    const uncategorized = groups.find((g) => g.category.id === "UNCATEGORIZED");
    expect(uncategorized).toBeDefined();
    expect(uncategorized!.tutorials.map((t) => t.slug)).toEqual(["brand-new-tutorial"]);
  });
});

describe("category coverage of seeded tutorials", () => {
  // The guard that matters: category lives in a separate map from the seed
  // constant, so a tutorial added to one and not the other would silently
  // land in UNCATEGORIZED. This fails the moment that happens.
  it("assigns a real category to every seeded tutorial", () => {
    const unmapped = TUTORIALS.filter((t) => categoryForTutorial(t.slug) === "UNCATEGORIZED");
    expect(unmapped.map((t) => t.slug)).toEqual([]);
  });

  it("has info for every category id", () => {
    for (const id of TUTORIAL_CATEGORIES) {
      expect(TUTORIAL_CATEGORY_INFO[id]).toBeDefined();
      expect(TUTORIAL_CATEGORY_INFO[id].titleEn.length).toBeGreaterThan(0);
    }
  });
});
