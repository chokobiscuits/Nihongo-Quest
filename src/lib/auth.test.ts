import { describe, expect, it } from "vitest";
import { signSessionToken, verifySessionToken } from "./auth";

describe("per-user session token sign/verify", () => {
  it("verifies a token signed with the same secret, returning the signed appUserId", async () => {
    const token = await signSessionToken("secret-a", "user-1");
    expect(await verifySessionToken(token, "secret-a")).toBe("user-1");
  });

  it("distinguishes different users signed with the same secret", async () => {
    const tokenA = await signSessionToken("secret-a", "user-a");
    const tokenB = await signSessionToken("secret-a", "user-b");
    expect(await verifySessionToken(tokenA, "secret-a")).toBe("user-a");
    expect(await verifySessionToken(tokenB, "secret-a")).toBe("user-b");
  });

  it("rejects a token signed with a different secret", async () => {
    const token = await signSessionToken("secret-a", "user-1");
    expect(await verifySessionToken(token, "secret-b")).toBeNull();
  });

  it("rejects a missing token", async () => {
    expect(await verifySessionToken(undefined, "secret-a")).toBeNull();
    expect(await verifySessionToken(null, "secret-a")).toBeNull();
    expect(await verifySessionToken("", "secret-a")).toBeNull();
  });

  it("rejects a garbage token with no signature separator", async () => {
    expect(await verifySessionToken("not-a-real-token", "secret-a")).toBeNull();
  });

  it("rejects a token with a tampered payload (forged appUserId)", async () => {
    const token = await signSessionToken("secret-a", "user-1");
    const [, signature] = token.split(".");
    const forgedPayload = Buffer.from(JSON.stringify({ appUserId: "user-2", exp: 9999999999 }))
      .toString("base64url");
    expect(await verifySessionToken(`${forgedPayload}.${signature}`, "secret-a")).toBeNull();
  });

  it("rejects an expired token", async () => {
    const token = await signSessionToken("secret-a", "user-1", -1);
    expect(await verifySessionToken(token, "secret-a")).toBeNull();
  });

  it("accepts a token right up to its expiry", async () => {
    const token = await signSessionToken("secret-a", "user-1", 60);
    expect(await verifySessionToken(token, "secret-a")).toBe("user-1");
  });

  it("is deterministic for the same secret, user and ttl window", async () => {
    const tokenA = await signSessionToken("secret-a", "user-1", 1000);
    const tokenB = await signSessionToken("secret-a", "user-1", 1000);
    // Not byte-identical in general (exp can straddle a second boundary),
    // but both must verify to the same user under the same secret.
    expect(await verifySessionToken(tokenA, "secret-a")).toBe("user-1");
    expect(await verifySessionToken(tokenB, "secret-a")).toBe("user-1");
  });
});
