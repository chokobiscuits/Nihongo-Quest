import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";
import { SESSION_COOKIE_NAME, verifySessionToken } from "@/lib/auth";

// Fixture mapping, standing in for the `auth_username_map` table + Supabase
// Auth's password store for the 4 provisioned accounts. Each username's
// password is itself.
const ACCOUNTS: Record<string, { appUserId: string; password: string }> = {
  chokobiscuits: { appUserId: "owner-prod-user-id", password: "choko-password" },
  matthieu123: { appUserId: "matthieu-user-id", password: "matthieu-password" },
  lily123: { appUserId: "lily-user-id", password: "lily-password" },
  eliane123: { appUserId: "eliane-user-id", password: "eliane-password" },
};

vi.mock("@/lib/supabaseAdmin", () => {
  return {
    syntheticEmailForUsername: (username: string) => `${username.toLowerCase()}@users.invalid`,
    createSupabaseAdminClient: () => ({
      from: () => ({
        select: () => ({
          ilike: (_col: string, username: string) => ({
            maybeSingle: async () => {
              const account = ACCOUNTS[username.toLowerCase()];
              return account
                ? { data: { app_user_id: account.appUserId }, error: null }
                : { data: null, error: null };
            },
          }),
        }),
      }),
      auth: {
        signInWithPassword: async ({ email, password }: { email: string; password: string }) => {
          const username = email.replace(/@users\.invalid$/, "");
          const account = ACCOUNTS[username];
          if (account && account.password === password) {
            return { data: {}, error: null };
          }
          return { data: null, error: { message: "Invalid login credentials" } };
        },
      },
    }),
  };
});

const { POST } = await import("./route");

function loginRequest(username: string, password: string): NextRequest {
  const form = new URLSearchParams({ username, password });
  return new NextRequest("https://example.com/api/login", {
    method: "POST",
    body: form,
    headers: { "content-type": "application/x-www-form-urlencoded" },
  });
}

describe("POST /api/login", () => {
  const originalSecret = process.env.APP_SESSION_SECRET;

  beforeEach(() => {
    process.env.APP_SESSION_SECRET = "test-session-secret";
  });

  afterEach(() => {
    process.env.APP_SESSION_SECRET = originalSecret;
  });

  it.each([
    ["ChokoBiscuits", "choko-password", "owner-prod-user-id"],
    ["Matthieu123", "matthieu-password", "matthieu-user-id"],
    ["Lily123", "lily-password", "lily-user-id"],
    ["Eliane123", "eliane-password", "eliane-user-id"],
  ])("logs %s in and sets a session cookie carrying their own appUserId", async (username, password, expectedId) => {
    const response = await POST(loginRequest(username, password));
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).not.toContain("/login?error");

    const cookie = response.cookies.get(SESSION_COOKIE_NAME);
    expect(cookie).toBeTruthy();
    const appUserId = await verifySessionToken(cookie!.value, "test-session-secret");
    expect(appUserId).toBe(expectedId);
  });

  it("rejects a known username with the wrong password", async () => {
    const response = await POST(loginRequest("ChokoBiscuits", "wrong-password"));
    expect(response.headers.get("location")).toContain("/login?error=1");
    expect(response.cookies.get(SESSION_COOKIE_NAME)).toBeFalsy();
  });

  it("rejects an unknown username", async () => {
    const response = await POST(loginRequest("NotARealUser", "whatever"));
    expect(response.headers.get("location")).toContain("/login?error=1");
    expect(response.cookies.get(SESSION_COOKIE_NAME)).toBeFalsy();
  });

  it("rejects an empty username or password without calling Supabase", async () => {
    const response = await POST(loginRequest("", ""));
    expect(response.headers.get("location")).toContain("/login?error=1");
  });

  it("issues different sessions for different users that cannot be confused with one another", async () => {
    const matthieu = await POST(loginRequest("Matthieu123", "matthieu-password"));
    const lily = await POST(loginRequest("Lily123", "lily-password"));

    const matthieuId = await verifySessionToken(
      matthieu.cookies.get(SESSION_COOKIE_NAME)!.value,
      "test-session-secret",
    );
    const lilyId = await verifySessionToken(lily.cookies.get(SESSION_COOKIE_NAME)!.value, "test-session-secret");

    expect(matthieuId).toBe("matthieu-user-id");
    expect(lilyId).toBe("lily-user-id");
    expect(matthieuId).not.toBe(lilyId);
  });
});
