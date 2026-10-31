"use server";

import { acknowledgeTutorial, acknowledgeAllTutorials } from "@/server/queries/tutorials";
import { revalidatePath } from "next/cache";
import { hasCompletedAnyTutorial, stampChangelogSeenIfUnset } from "@/server/changelog";
import { getCurrentUserId } from "@/lib/session";

/// The first completion ever is what ends first-run onboarding. A brand-new
/// account should start caught up on the changelog rather than be shown a
/// what's-new popup straight after its welcome, so record the newest release
/// as seen. Accounts that already had completions are never touched, which
/// is what lets an existing user still get the popup after an update. A
/// failure here must not fail the acknowledgement itself.
async function stampNewAccountChangelog(userId: string): Promise<void> {
  try {
    await stampChangelogSeenIfUnset(userId);
  } catch (error) {
    console.warn("[tutorials] could not stamp the changelog as seen:", error);
  }
}

/// Writes a TutorialCompletion row for the given tutorial and revalidates
/// /lessons so the next required-and-triggered tutorial (or lesson items,
/// once none remain) shows up immediately.
export async function acknowledgeTutorialAction(tutorialId: string): Promise<void> {
  const userId = await getCurrentUserId();
  const firstEver = !(await hasCompletedAnyTutorial(userId));
  await acknowledgeTutorial(tutorialId, userId);
  if (firstEver) await stampNewAccountChangelog(userId);

  try {
    revalidatePath("/lessons");
    revalidatePath("/tutorials");
    revalidatePath(`/tutorials/${tutorialId}`);
    revalidatePath("/");
  } catch {
    // No-op outside an active Next.js request scope (scripts/tests).
  }
}

/// Marks every tutorial complete at once. This exists because the app has
/// one user who already reads Japanese: being gated behind six required
/// explainers they do not need is friction, not onboarding. Individual
/// tutorials stay readable afterwards, and nothing is deleted, so this is
/// reversible by clearing completions.
export async function acknowledgeAllTutorialsAction(): Promise<number> {
  const userId = await getCurrentUserId();
  const firstEver = !(await hasCompletedAnyTutorial(userId));
  const count = await acknowledgeAllTutorials(userId);
  if (firstEver) await stampNewAccountChangelog(userId);

  try {
    revalidatePath("/lessons");
    revalidatePath("/tutorials");
    revalidatePath("/");
  } catch {
    // No-op outside an active Next.js request scope (scripts/tests).
  }

  return count;
}
