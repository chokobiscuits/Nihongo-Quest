import { mkdir, writeFile, unlink } from "node:fs/promises";
import path from "node:path";

/// Storage abstraction for user-uploaded files (currently just avatars).
///
/// IMPORTANT: this driver writes to local disk under `public/uploads/`,
/// which does NOT persist on Vercel (or any ephemeral/read-only filesystem
/// deployment target). It exists so avatar upload works today in local dev
/// against the live DB. A Supabase Storage driver implementing the same
/// `Storage` interface should swap in before deploying — swap the export at
/// the bottom of this file, nothing else in the app needs to change since
/// callers only depend on this interface.
export interface Storage {
  /// Writes `data` under `relativePath` (relative to the storage root) and
  /// returns the path to persist in the DB — always the same `relativePath`
  /// passed in, so callers control the naming scheme.
  put(relativePath: string, data: Buffer): Promise<string>;
  /// Removes a previously-stored file. No-ops if the file doesn't exist.
  remove(relativePath: string): Promise<void>;
  /// The public URL path (as used in <img src>) for a stored relative path.
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

export const storage: Storage = new LocalDiskStorage();
