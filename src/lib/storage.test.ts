import { describe, expect, it } from "vitest";
import { resolveStorage } from "./storage";

describe("resolveStorage", () => {
  it("falls back to the local-disk driver when Supabase env vars are absent", () => {
    const driver = resolveStorage({});
    expect(driver.publicUrl("avatars/foo.webp")).toBe("/uploads/avatars/foo.webp");
  });

  it("falls back to local disk when only the URL is set, no key", () => {
    const driver = resolveStorage({
      NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
    });
    expect(driver.publicUrl("avatars/foo.webp")).toBe("/uploads/avatars/foo.webp");
  });

  it("selects the Supabase driver when a URL and a service role key are present", () => {
    const driver = resolveStorage({
      NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
      SUPABASE_SERVICE_ROLE_KEY: "service-role-key",
    });
    expect(driver.publicUrl("avatars/foo.webp")).toContain(
      "https://example.supabase.co/storage/v1/object/public/avatars/avatars/foo.webp",
    );
  });

  it("selects the Supabase driver when a URL and an anon key are present", () => {
    const driver = resolveStorage({
      NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon-key",
    });
    expect(driver.publicUrl("avatars/foo.webp")).toContain("example.supabase.co");
  });

  it("honors a custom bucket name", () => {
    const driver = resolveStorage({
      NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon-key",
      SUPABASE_STORAGE_BUCKET: "custom-bucket",
    });
    expect(driver.publicUrl("foo.webp")).toContain("/custom-bucket/foo.webp");
  });
});
