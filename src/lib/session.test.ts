import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { SESSION_COOKIE_NAME, signSessionToken } from "@/lib/auth";

let cookieValue: string | undefined;
let redirectedTo: string | undefined;

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => (name === SESSION_COOKIE_NAME && cookieValue ? { value: cookieValue } : undefined),
  }),
}));

vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    redirectedTo = url;
    // next/navigation's redirect() throws a special control-flow signal that
    // the framework catches further up — callers of getCurrentUserId rely on
    // it never returning normally, so the mock must behave the same way.
    throw new Error(`NEXT_REDIRECT:${url}`);
  },
}));

const { getCurrentUserId, getCurrentUserIdOrNull } = await import("./session");

describe("getCurrentUserIdOrNull", () => {
  const originalSecret = process.env.APP_SESSION_SECRET;

  beforeEach(() => {
    process.env.APP_SESSION_SECRET = "test-session-secret";
    cookieValue = undefined;
    redirectedTo = undefined;
  });

  afterEach(() => {
    process.env.APP_SESSION_SECRET = originalSecret;
  });

  it("returns null with no cookie", async () => {
    expect(await getCurrentUserIdOrNull()).toBeNull();
  });

  it("returns null when APP_SESSION_SECRET is unset, even with a valid-looking cookie", async () => {
    cookieValue = await signSessionToken("test-session-secret", "user-1");
    delete process.env.APP_SESSION_SECRET;
    expect(await getCurrentUserIdOrNull()).toBeNull();
  });

  it("returns the signed appUserId for a valid cookie", async () => {
    cookieValue = await signSessionToken("test-session-secret", "user-42");
    expect(await getCurrentUserIdOrNull()).toBe("user-42");
  });

  it("never falls back to a shared default user id for two different sessions", async () => {
    cookieValue = await signSessionToken("test-session-secret", "account-a");
    expect(await getCurrentUserIdOrNull()).toBe("account-a");

    cookieValue = await signSessionToken("test-session-secret", "account-b");
    expect(await getCurrentUserIdOrNull()).toBe("account-b");
  });
});

describe("getCurrentUserId", () => {
  const originalSecret = process.env.APP_SESSION_SECRET;

  beforeEach(() => {
    process.env.APP_SESSION_SECRET = "test-session-secret";
    cookieValue = undefined;
    redirectedTo = undefined;
  });

  afterEach(() => {
    process.env.APP_SESSION_SECRET = originalSecret;
  });

  it("redirects to /login with no cookie, rather than returning a default user", async () => {
    await expect(getCurrentUserId()).rejects.toThrow("NEXT_REDIRECT:/login");
    expect(redirectedTo).toBe("/login");
  });

  it("returns the signed appUserId for a valid cookie", async () => {
    cookieValue = await signSessionToken("test-session-secret", "user-99");
    expect(await getCurrentUserId()).toBe("user-99");
  });
});
