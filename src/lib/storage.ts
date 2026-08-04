import { mkdir, writeFile, unlink } from "node:fs/promises";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

/// Storage abstraction for user-uploaded files (currently just avatars).
///
/// Two drivers implement this interface: `LocalDiskStorage` (writes under
/// `public/uploads/`, fine for local dev but does NOT persist on Vercel or
/// any ephemeral/read-only filesystem deployment target) and
/// `SupabaseStorage` (uploads to a Supabase Storage bucket, the one that
/// actually persists in production). `resolveStorage()` below picks whichever
/// one is usable based on env vars present at runtime — callers only ever
/// depend on this interface, never on which driver backs it.
export interface Storage {
  /// Writes `data` under `relativePath` (relative to the storage root) and
  /// returns the path to persist in the DB — always the same `relativePath`
  /// passed in, so callers control the naming scheme.
  put(relativePath: string, data: Buffer): Promise<string>;
  /// Removes a previously-stored file. No-ops if the file doesn't exist.
  remove(relativePath: string): Promise<void>;
  /// The public URL (as used in <img src>) for a stored relative path.
  publicUrl(relativePath: string): string;
}

const UPLOADS_ROOT = path.join(process.cwd(), "public", "uploads");

class LocalDiskStorage implements Storage {
  async put(relativePath: string, data: Buffer): Promise<string> {
    const fullPath = path.join(UPLOADS_ROOT, relativePath);
    await mkdir(path.dirname(fullPath), { recursive: true });
    await writeFile(fullPath, data);
    return relativePath;
  }

  async remove(relativePath: string): Promise<void> {
    const fullPath = path.join(UPLOADS_ROOT, relativePath);
    try {
      await unlink(fullPath);
    } catch {
      // Already gone — fine, remove() is idempotent.
    }
  }

  publicUrl(relativePath: string): string {
    return `/uploads/${relativePath}`;
  }
}

/// Uploads to a Supabase Storage bucket (default `avatars`, overridable via
/// SUPABASE_STORAGE_BUCKET). Selected instead of the local-disk driver
/// whenever NEXT_PUBLIC_SUPABASE_URL and a key are both present — see
/// `resolveStorage()`. The bucket is expected to be public, so `publicUrl()`
/// returns Supabase's public object URL directly.
class SupabaseStorage implements Storage {
  private client: ReturnType<typeof createClient>;
  private bucket: string;

  constructor(url: string, key: string, bucket: string) {
    this.client = createClient(url, key);
    this.bucket = bucket;
  }

  async put(relativePath: string, data: Buffer): Promise<string> {
    const { error } = await this.client.storage
      .from(this.bucket)
      .upload(relativePath, data, { upsert: true });
    if (error) {
      throw new Error(`Supabase storage upload failed: ${error.message}`);
    }
    return relativePath;
  }

  async remove(relativePath: string): Promise<void> {
    // Idempotent by design — Supabase's remove() doesn't error on a missing
    // object, it just reports nothing removed.
    await this.client.storage.from(this.bucket).remove([relativePath]);
  }

  publicUrl(relativePath: string): string {
    const { data } = this.client.storage.from(this.bucket).getPublicUrl(relativePath);
    return data.publicUrl;
  }
}

const DEFAULT_BUCKET = "avatars";

/// Picks the storage driver at runtime rather than import time, so tests can
/// exercise both branches by toggling env vars. Prefers Supabase whenever a
/// URL and a key (service role, falling back to anon) are both set; falls
/// back to local disk otherwise, which keeps local dev working exactly as
/// before with no env vars required.
export function resolveStorage(env: Partial<NodeJS.ProcessEnv> = process.env): Storage {
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const key = env.SUPABASE_SERVICE_ROLE_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (url && key) {
    const bucket = env.SUPABASE_STORAGE_BUCKET || DEFAULT_BUCKET;
    return new SupabaseStorage(url, key, bucket);
  }
  return new LocalDiskStorage();
}

export const storage: Storage = resolveStorage();
