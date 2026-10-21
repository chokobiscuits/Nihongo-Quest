/// Pure token sign/verify logic for the per-user session cookie (see
/// src/proxy.ts). Deliberately framework-free — no `next/headers`, no
/// cookies here — so it's unit-testable without a request context and so
/// proxy.ts stays a thin wrapper around it.
///
/// Uses the Web Crypto API (`crypto.subtle`) rather than `node:crypto`
/// because this module is imported by proxy.ts, which Next runs on the
/// Edge runtime — `node:crypto`'s `createHmac`/`timingSafeEqual` aren't
/// available there. Web Crypto works in both the Edge runtime and Node
/// (Node exposes `globalThis.crypto` too), so the same code path covers
/// the proxy, the /api/login route handler, and unit tests.
///
/// The session cookie's value is `${base64url(payload)}.${hmacHex}`, where
/// payload is `{appUserId, exp}` as JSON. The signature proves the payload
/// was issued by us (not forged or edited client-side) without needing a
/// database lookup to validate a session — `exp` is checked locally too, so
/// an expired cookie is rejected without ever reaching the signature check.
export const SESSION_COOKIE_NAME = "app_session";

export interface SessionPayload {
  /// The signed-in user's UserProfile.userId (Prisma primary key) — never a
  /// Supabase Auth id. See docs/multi-user-auth-migration.md: Prisma bypasses
  /// RLS and the data layer only ever needs this id, not a Supabase session.
  appUserId: string;
  /// Unix seconds. Checked with `<=` against the current time, so a token
  /// expires at the instant it claims to, not one second later.
  exp: number;
}

const textEncoder = new TextEncoder();

function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function base64UrlEncode(input: string): string {
  const bytes = textEncoder.encode(input);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64UrlDecode(input: string): string {
  const padded = input.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(input.length / 4) * 4, "=");
  const binary = atob(padded);
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

async function hmacSha256Hex(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    textEncoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, textEncoder.encode(message));
  return toHex(signature);
}

/// Signs a session for `appUserId`, expiring `ttlSeconds` from now (default
/// 30 days — this is a personal app with no reason to force frequent
/// re-auth).
export async function signSessionToken(
  secret: string,
  appUserId: string,
  ttlSeconds = 30 * 24 * 60 * 60,
): Promise<string> {
  const payload: SessionPayload = {
    appUserId,
    exp: Math.floor(Date.now() / 1000) + ttlSeconds,
  };
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const signature = await hmacSha256Hex(secret, encodedPayload);
  return `${encodedPayload}.${signature}`;
}

/// Verifies the token's signature and expiry, returning the signed-in
/// user's id, or null if the token is missing, malformed, forged, or
/// expired. Never throws — every failure mode collapses to "not logged in".
export async function verifySessionToken(
  token: string | undefined | null,
  secret: string,
): Promise<string | null> {
  if (!token) return null;
  const separatorIndex = token.lastIndexOf(".");
  if (separatorIndex === -1) return null;

  const encodedPayload = token.slice(0, separatorIndex);
  const signature = token.slice(separatorIndex + 1);

  const expectedSignature = await hmacSha256Hex(secret, encodedPayload);
  if (!constantTimeEqual(signature, expectedSignature)) return null;

  let payload: SessionPayload;
  try {
    payload = JSON.parse(base64UrlDecode(encodedPayload)) as SessionPayload;
  } catch {
    return null;
  }

  if (typeof payload.appUserId !== "string" || !payload.appUserId) return null;
  if (typeof payload.exp !== "number" || payload.exp <= Math.floor(Date.now() / 1000)) return null;

  return payload.appUserId;
}

/// Constant-time comparison of two equal-length strings against a fixed-
/// length pass over both buffers with a running XOR. Different lengths still
/// short-circuit to false (unavoidable without hashing first), but timing
/// leaked from a length mismatch alone doesn't help an attacker guess a
/// fixed-format hex signature.
function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}
