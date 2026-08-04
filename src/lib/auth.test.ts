import { describe, expect, it } from "vitest";
import { signSessionToken, verifySessionToken, verifyPassword } from "./auth";

describe("session token sign/verify", () => {
  it("verifies a token signed with the same secret", async () => {
    const token = await signSessionToken("secret-a");
    expect(await verifySessionToken(token, "secret-a")).toBe(true);
  });

  it("rejects a token signed with a different secret", async () => {
    const token = await signSessionToken("secret-a");
    expect(await verifySessionToken(token, "secret-b")).toBe(false);
  });

  it("rejects a missing token", async () => {
    expect(await verifySessionToken(undefined, "secret-a")).toBe(false);
    expect(await verifySessionToken(null, "secret-a")).toBe(false);
    expect(await verifySessionToken("", "secret-a")).toBe(false);
  });

  it("rejects a garbage token of a different length", async () => {
    expect(await verifySessionToken("not-a-real-token", "secret-a")).toBe(false);
  });

  it("is deterministic for the same secret", async () => {
    expect(await signSessionToken("secret-a")).toBe(await signSessionToken("secret-a"));
  });
});

describe("verifyPassword", () => {
  it("accepts the correct password", () => {
    expect(verifyPassword("hunter2", "hunter2")).toBe(true);
  });

  it("rejects an incorrect password of the same length", () => {
    expect(verifyPassword("hunter3", "hunter2")).toBe(false);
  });

  it("rejects an incorrect password of a different length", () => {
    expect(verifyPassword("short", "a-much-longer-password")).toBe(false);
    expect(verifyPassword("a-much-longer-password", "short")).toBe(false);
  });

  it("rejects an empty guess against a non-empty password", () => {
    expect(verifyPassword("", "hunter2")).toBe(false);
  });
});
