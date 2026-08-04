"use server";

import sharp from "sharp";
import { randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import { prisma } from "@/lib/db";
import { getOrCreateProfile } from "@/server/queries/profile";
import { storage } from "@/lib/storage";
import { SESSION_COOKIE_NAME } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import type { InputJsonValue } from "@/generated/prisma/internal/prismaNamespace";

import { APP_USER_ID } from "@/lib/appUser";

const MAX_AVATAR_BYTES = 2 * 1024 * 1024; // ~2MB
const AVATAR_SIZE_PX = 512;
const ALLOWED_IMAGE_TYPES = new Set(["image/png", "image/jpeg", "image/webp", "image/gif"]);
const MAX_DISPLAY_NAME_LENGTH = 40;
const MIN_LESSON_BATCH_SIZE = 1;
const MAX_LESSON_BATCH_SIZE = 20;

export interface SettingsActionResult {
  ok: boolean;
  error?: string;
}

/// Reads the full settings JSON blob so partial updates below never clobber
/// a sibling key (lessonBatchSize vs furiganaOverride, etc).
async function readSettings(userId: string): Promise<Record<string, unknown>> {
  const profile = await getOrCreateProfile(userId);
  const settings = profile.settings;
  return settings && typeof settings === "object" ? { ...(settings as Record<string, unknown>) } : {};
}

/// Persists `UserProfile.displayName`. Server-side validated: non-empty,
/// trimmed, capped length — never trusts whatever the client sent.
export async function updateDisplayName(
  displayName: string,
  userId: string = APP_USER_ID,
): Promise<SettingsActionResult> {
  const trimmed = displayName.trim();
  if (trimmed.length === 0) {
    return { ok: false, error: "Display name cannot be empty." };
  }
  if (trimmed.length > MAX_DISPLAY_NAME_LENGTH) {
    return { ok: false, error: `Display name must be ${MAX_DISPLAY_NAME_LENGTH} characters or fewer.` };
  }

  await getOrCreateProfile(userId);
  await prisma.userProfile.update({ where: { userId }, data: { displayName: trimmed } });
  revalidateProfileViews();
  return { ok: true };
}

/// Persists `UserProfile.settings.lessonBatchSize`, read by getLessonBatch
/// (src/server/queries/lessons.ts). Clamped server-side to a sane range.
export async function updateLessonBatchSize(
  size: number,
  userId: string = APP_USER_ID,
): Promise<SettingsActionResult> {
  if (!Number.isFinite(size) || !Number.isInteger(size)) {
    return { ok: false, error: "Lesson batch size must be a whole number." };
  }
  if (size < MIN_LESSON_BATCH_SIZE || size > MAX_LESSON_BATCH_SIZE) {
    return { ok: false, error: `Lesson batch size must be between ${MIN_LESSON_BATCH_SIZE} and ${MAX_LESSON_BATCH_SIZE}.` };
  }

  const settings = await readSettings(userId);
  settings.lessonBatchSize = size;
  await prisma.userProfile.update({ where: { userId }, data: { settings: settings as InputJsonValue } });
  revalidateProfileViews();
  return { ok: true };
}

/// Persists `UserProfile.settings.furiganaOverride` (true / false / null),
/// read by src/services/progress/visibility.ts's shouldShowFurigana.
export async function updateFuriganaOverride(
  override: boolean | null,
  userId: string = APP_USER_ID,
): Promise<SettingsActionResult> {
  const settings = await readSettings(userId);
  settings.furiganaOverride = override;
  await prisma.userProfile.update({ where: { userId }, data: { settings: settings as InputJsonValue } });
  revalidateProfileViews();
  return { ok: true };
}

// IANA timezone names this app's settings page offers — a deliberately short
// list of commonly-relevant zones rather than the full ~400-entry IANA
// database, validated against `Intl` regardless so any valid IANA id works.
export async function updateTimezone(
  timezone: string,
  userId: string = APP_USER_ID,
): Promise<SettingsActionResult> {
  try {
    // Throws RangeError for an invalid IANA timezone identifier.
    new Intl.DateTimeFormat("en-US", { timeZone: timezone });
  } catch {
    return { ok: false, error: "Invalid timezone." };
  }

  await getOrCreateProfile(userId);
  await prisma.userProfile.update({ where: { userId }, data: { timezone } });
  revalidateProfileViews();
  return { ok: true };
}

export interface UploadAvatarResult extends SettingsActionResult {
  avatarPath?: string;
  avatarUrl?: string;
}

/// Validates, normalizes (square 512px webp via sharp), and stores an
/// uploaded avatar image, replacing any previous one. Accepts a plain
/// ArrayBuffer/Buffer + declared mime type rather than a `File` — Server
/// Actions can receive `FormData` with a File entry, but the caller here
/// passes the already-extracted bytes so this function stays framework-free
/// and unit-testable in isolation.
export async function uploadAvatar(
  fileBytes: ArrayBuffer,
  declaredType: string,
  userId: string = APP_USER_ID,
): Promise<UploadAvatarResult> {
  if (!ALLOWED_IMAGE_TYPES.has(declaredType)) {
    return { ok: false, error: "Only PNG, JPEG, WebP, or GIF images are allowed." };
  }
  if (fileBytes.byteLength === 0) {
    return { ok: false, error: "Uploaded file is empty." };
  }
  if (fileBytes.byteLength > MAX_AVATAR_BYTES) {
    return { ok: false, error: "Image must be 2MB or smaller." };
  }

  const inputBuffer = Buffer.from(fileBytes);

  let outputBuffer: Buffer;
  try {
    outputBuffer = await sharp(inputBuffer)
      .resize(AVATAR_SIZE_PX, AVATAR_SIZE_PX, { fit: "cover" })
      .webp({ quality: 85 })
      .toBuffer();
  } catch {
    return { ok: false, error: "Could not process image, file may be corrupt or not a real image." };
  }

  const profile = await getOrCreateProfile(userId);
  const relativePath = `avatars/${userId}-${randomUUID()}.webp`;
  await storage.put(relativePath, outputBuffer);

  // Clean up the previous avatar file so uploads/removals don't accumulate
  // orphaned files under public/uploads/avatars.
  if (profile.avatarPath) {
    await storage.remove(profile.avatarPath);
  }

  await prisma.userProfile.update({ where: { userId }, data: { avatarPath: relativePath } });
  revalidateProfileViews();
  return { ok: true, avatarPath: relativePath, avatarUrl: storage.publicUrl(relativePath) };
}

/// Removes the current avatar, both the stored file and the DB reference.
export async function removeAvatar(userId: string = APP_USER_ID): Promise<SettingsActionResult> {
  const profile = await getOrCreateProfile(userId);
  if (profile.avatarPath) {
    await storage.remove(profile.avatarPath);
  }
  await prisma.userProfile.update({ where: { userId }, data: { avatarPath: null } });
  revalidateProfileViews();
  return { ok: true };
}

/// Clears the shared-password session cookie set by /api/login. A no-op if
/// the password gate isn't configured (APP_PASSWORD unset), since there's
/// no session to clear in that case.
export async function logout(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE_NAME);
}

function revalidateProfileViews() {
  try {
    revalidatePath("/settings");
    revalidatePath("/");
  } catch {
    // No active Next.js request scope (e.g. tests/scripts) — the DB write
    // above is what actually matters.
  }
}
