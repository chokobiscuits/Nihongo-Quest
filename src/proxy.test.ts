import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";
import { proxy } from "./proxy";
import { SESSION_COOKIE_NAME, signSessionToken } from "@/lib/auth";

const SECRET = "test-session-secret";

function requestFor(pathname: string, cookieValue?: string): NextRequest {
  const url = `https://example.com${pathname}`;
  const headers = cookieValue ? { cookie: `${SESSION_COOKIE_NAME}=${cookieValue}` } : undefined;
  return new NextRequest(url, { headers });
}

describe("proxy (per-user auth gate)", () => {
  const originalSecret = process.env.APP_SESSION_SECRET;

  beforeEach(() => {
    process.env.APP_SESSION_SECRET = SECRET;
  });

  afterEach(() => {
    process.env.APP_SESSION_SECRET = originalSecret;
  });

  it("always allows /login and /api/login through, with no cookie", async () => {
    const loginPage = await proxy(requestFor("/login"));
    expect(loginPage.status).not.toBe(307);
    const loginApi = await proxy(requestFor("/api/login"));
    expect(loginApi.status).not.toBe(307);
  });

  it("redirects to /login when there is no session cookie", async () => {
    const response = await proxy(requestFor("/"));
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toContain("/login");
  });

  it("redirects to /login when the session cookie is forged garbage", async () => {
    const response = await proxy(requestFor("/", "not-a-real-token"));
    expect(response.status).toBe(307);
  });

  it("redirects to /login even with a well-formed token signed by a different secret", async () => {
    const foreignToken = await signSessionToken("a-different-secret", "user-1");
    const response = await proxy(requestFor("/", foreignToken));
    expect(response.status).toBe(307);
  });

  it("passes through with a valid session cookie for any of several distinct users", async () => {
    for (const appUserId of ["owner-user-id", "matthieu-user-id", "lily-user-id", "eliane-user-id"]) {
      const token = await signSessionToken(SECRET, appUserId);
      const response = await proxy(requestFor("/", token));
      expect(response.status).not.toBe(307);
    }
  });

  it("fails closed (redirects) when APP_SESSION_SECRET is unset, even with a cookie present", async () => {
    delete process.env.APP_SESSION_SECRET;
    // A cookie signed under some secret, but the proxy has none configured to
    // check it against — there is no bypass path left once APP_PASSWORD is
    // retired, unlike the old gate which fully skipped the check in this case.
    const response = await proxy(requestFor("/", "irrelevant-token"));
    expect(response.status).toBe(307);
  });

  it("redirects an expired session even though it was validly signed", async () => {
    const expiredToken = await signSessionToken(SECRET, "user-1", -1);
    const response = await proxy(requestFor("/", expiredToken));
    expect(response.status).toBe(307);
  });
});
