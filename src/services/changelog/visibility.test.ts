import { describe, expect, it } from "vitest";
import { isChangelogSuppressedPath, shouldShowChangelog } from "./visibility";

const IDS = ["2026-10-31", "2026-08-05", "2026-08-04"];

describe("shouldShowChangelog", () => {
  it("never shows during onboarding, even for an account with no recorded release", () => {
    expect(shouldShowChangelog({ releaseIds: IDS, lastSeenId: undefined, onboarded: false })).toBe(false);
    expect(shouldShowChangelog({ releaseIds: IDS, lastSeenId: null, onboarded: false })).toBe(false);
  });

  it("does not show a freshly reset account (onboarding again) an older unseen release", () => {
    expect(shouldShowChangelog({ releaseIds: IDS, lastSeenId: "2026-08-05", onboarded: false })).toBe(false);
  });

  it("shows an onboarded account that has never seen a changelog", () => {
    expect(shouldShowChangelog({ releaseIds: IDS, lastSeenId: undefined, onboarded: true })).toBe(true);
    expect(shouldShowChangelog({ releaseIds: IDS, lastSeenId: null, onboarded: true })).toBe(true);
  });

  it("shows when the last seen release is older than the newest", () => {
    expect(shouldShowChangelog({ releaseIds: IDS, lastSeenId: "2026-08-05", onboarded: true })).toBe(true);
    expect(shouldShowChangelog({ releaseIds: IDS, lastSeenId: "2026-08-04", onboarded: true })).toBe(true);
  });

  it("does not show when the newest release was already seen", () => {
    expect(shouldShowChangelog({ releaseIds: IDS, lastSeenId: "2026-10-31", onboarded: true })).toBe(false);
  });

  it("does not show over an id this build does not know", () => {
    expect(shouldShowChangelog({ releaseIds: IDS, lastSeenId: "2099-01-01", onboarded: true })).toBe(false);
    expect(shouldShowChangelog({ releaseIds: IDS, lastSeenId: "", onboarded: true })).toBe(false);
  });

  it("shows nothing when there are no releases", () => {
    expect(shouldShowChangelog({ releaseIds: [], lastSeenId: undefined, onboarded: true })).toBe(false);
  });
});

describe("isChangelogSuppressedPath", () => {
  it("waits on session, tutorial, login and changelog routes", () => {
    for (const path of ["/lessons", "/lessons/anything", "/reviews", "/reviews/practice/session", "/tutorials", "/tutorials/welcome", "/login", "/changelog"]) {
      expect(isChangelogSuppressedPath(path)).toBe(true);
    }
  });

  it("allows calm routes", () => {
    for (const path of ["/", "/progress", "/settings", "/subjects/kanji", "/achievements", "/lessonsx"]) {
      expect(isChangelogSuppressedPath(path)).toBe(false);
    }
  });

  it("does not suppress when the path is unknown", () => {
    expect(isChangelogSuppressedPath(null)).toBe(false);
    expect(isChangelogSuppressedPath(undefined)).toBe(false);
  });
});
