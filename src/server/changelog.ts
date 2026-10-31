import { prisma } from "@/lib/db";
import { latestRelease } from "@/content/changelog";
import { getOrCreateProfile } from "@/server/queries/profile";
import type { InputJsonValue } from "@/generated/prisma/internal/prismaNamespace";

/// Server-side helpers for `UserProfile.settings.lastSeenChangelogId`. Not a
/// "use server" module, so nothing here is callable from the client; the
/// validated entry point is `markChangelogSeen` in actions/settings.ts.

async function readSettings(userId: string): Promise<Record<string, unknown>> {
  const profile = await getOrCreateProfile(userId);
  const settings = profile.settings;
  return settings && typeof settings === "object" ? { ...(settings as Record<string, unknown>) } : {};
}

/// Stores `id` as the last changelog release the user has seen. The caller is
/// responsible for having validated `id` against the known releases.
export async function recordChangelogSeen(id: string, userId: string): Promise<void> {
  const settings = await readSettings(userId);
  settings.lastSeenChangelogId = id;
  await prisma.userProfile.update({ where: { userId }, data: { settings: settings as InputJsonValue } });
}

/// Marks the newest release as seen, but only when nothing is recorded yet.
/// Called when a brand-new account finishes first-run onboarding, so it
/// starts out caught up instead of being told about releases that predate it.
export async function stampChangelogSeenIfUnset(userId: string): Promise<void> {
  const latest = latestRelease();
  if (!latest) return;
  const settings = await readSettings(userId);
  if (typeof settings.lastSeenChangelogId === "string") return;
  settings.lastSeenChangelogId = latest.id;
  await prisma.userProfile.update({ where: { userId }, data: { settings: settings as InputJsonValue } });
}

/// True once the account has completed any tutorial, which is what ends
/// first-run onboarding (see getFirstRunTutorial).
export async function hasCompletedAnyTutorial(userId: string): Promise<boolean> {
  return (await prisma.tutorialCompletion.count({ where: { userId } })) > 0;
}
