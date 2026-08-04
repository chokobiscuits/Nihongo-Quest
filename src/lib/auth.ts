/// Pure token sign/verify logic for the shared-password gate (see
/// middleware.ts). Deliberately framework-free — no `next/headers`, no
/// cookies here — so it's unit-testable without a request context and so
/// middleware.ts stays a thin wrapper around it.
///
/// Uses the Web Crypto API (`crypto.subtle`) rather than `node:crypto`
/// because this module is imported by middleware.ts, which Next runs on the
/// Edge runtime — `node:crypto`'s `createHmac`/`timingSafeEqual` aren't
/// available there. Web Crypto works in both the Edge runtime and Node
/// (Node exposes `globalThis.crypto` too), so the same code path covers
/// middleware, the /api/login route handler, and unit tests.
///
/// The session cookie's value is never the password itself. It's an HMAC-
/// SHA256 of a constant "session" payload, keyed by APP_SESSION_SECRET, so
/// possessing the cookie proves you passed the gate at some point without
/// the cookie itself being able to derive the password.
export const SESSION_COOKIE_NAME = "app_session";
const SESSION_PAYLOAD = "authenticated";

const textEncoder = new TextEncoder();

function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
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

export async function signSessionToken(secret: string): Promise<string> {
  return hmacSha256Hex(secret, SESSION_PAYLOAD);
}

/// Timing-safe(ish) comparison against the expected token — comparing equal-
/// length hex strings byte-by-byte without early exit, since `node:crypto`'s
/// timingSafeEqual isn't available in the Edge runtime this code also runs
/// in (see the module comment above).
export async function verifySessionToken(token: string | undefined | null, secret: string): Promise<boolean> {
  if (!token) return false;
  const expected = await signSessionToken(secret);
  return constantTimeEqual(token, expected);
}

/// Constant-time comparison of two equal-length strings against a fixed-
/// length pass over both buffers with a running XOR. Different lengths still
/// short-circuit to false (unavoidable without hashing first), but timing
/// leaked from a length mismatch alone doesn't help an attacker guess a
/// fixed-format hex token or password of a fixed expected length.
function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

/// Comparison of the submitted password against APP_PASSWORD.
export function verifyPassword(submitted: string, expected: string): boolean {
  return constantTimeEqual(submitted, expected);
}
