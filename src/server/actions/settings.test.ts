import { beforeEach, describe, expect, it, vi } from "vitest";

const recordChangelogSeen = vi.fn();
const userProfileUpdate = vi.fn();

vi.mock("@/server/changelog", () => ({
  recordChangelogSeen: (...args: unknown[]) => recordChangelogSeen(...args),
}));
vi.mock("@/lib/db", () => ({ prisma: { userProfile: { update: (...args: unknown[]) => userProfileUpdate(...args) } } }));
vi.mock("@/server/queries/profile", () => ({ getOrCreateProfile: vi.fn(async () => ({ settings: {} })) }));
vi.mock("@/lib/session", () => ({ getCurrentUserId: vi.fn(async () => "session-user") }));
vi.mock("@/lib/storage", () => ({ storage: {} }));
vi.mock("next/headers", () => ({ cookies: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { CHANGELOG } from "@/content/changelog";
import { markChangelogSeen, updatePronunciationAutoplay } from "./settings";

beforeEach(() => {
  recordChangelogSeen.mockReset();
  userProfileUpdate.mockReset();
});

describe("markChangelogSeen", () => {
  it("records a known release id", async () => {
    const id = CHANGELOG[0].id;
    expect(await markChangelogSeen(id)).toEqual({ ok: true });
    // The user comes from the session, never from the caller.
    expect(recordChangelogSeen).toHaveBeenCalledWith(id, "session-user");
  });

  it("rejects unknown ids and non-strings without writing", async () => {
    for (const bad of ["2099-01-01", "", null, undefined, 42, {}, [CHANGELOG[0].id]]) {
      const result = await markChangelogSeen(bad);
      expect(result.ok).toBe(false);
    }
    expect(recordChangelogSeen).not.toHaveBeenCalled();
  });
});

describe("updatePronunciationAutoplay", () => {
  it("accepts booleans", async () => {
    expect(await updatePronunciationAutoplay(false)).toEqual({ ok: true });
    expect(userProfileUpdate).toHaveBeenCalledTimes(1);
    expect(userProfileUpdate.mock.calls[0][0]).toMatchObject({ where: { userId: "session-user" } });
  });

  it("rejects non-booleans without writing", async () => {
    for (const bad of ["true", 1, null, undefined, {}]) {
      const result = await updatePronunciationAutoplay(bad as unknown as boolean);
      expect(result.ok).toBe(false);
    }
    expect(userProfileUpdate).not.toHaveBeenCalled();
  });
});
