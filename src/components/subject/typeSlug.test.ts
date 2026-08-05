import { describe, expect, it } from "vitest";
import { SubjectType } from "@/generated/prisma/enums";
import { ALL_TYPE_SLUGS, slugToType, typeToSlug } from "./typeSlug";

/// These two functions are the whole URL contract behind /lessons?type= and
/// /subjects/[type]. A silent gap in either direction downgrades a filtered
/// lesson to an unfiltered one, so the round-trip is worth pinning.
describe("typeSlug", () => {
  const allTypes = Object.values(SubjectType);

  it("round-trips every SubjectType through its slug", () => {
    for (const type of allTypes) {
      expect(slugToType(typeToSlug(type))).toBe(type);
    }
  });

  it("gives every SubjectType a distinct slug", () => {
    const slugs = allTypes.map(typeToSlug);
    expect(new Set(slugs).size).toBe(allTypes.length);
  });

  it("returns null for unknown slugs", () => {
    for (const bad of ["", "kanjis", "KANJI", "vocab", "nonsense", "__proto__"]) {
      expect(slugToType(bad)).toBeNull();
    }
  });

  it("exposes exactly the recognised slugs as ALL_TYPE_SLUGS", () => {
    expect([...ALL_TYPE_SLUGS].sort()).toEqual(allTypes.map(typeToSlug).sort());
  });

  it("keeps every advertised slug resolvable", () => {
    for (const slug of ALL_TYPE_SLUGS) {
      expect(slugToType(slug)).not.toBeNull();
    }
  });
});
