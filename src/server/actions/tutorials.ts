"use server";

import { acknowledgeTutorial, acknowledgeAllTutorials } from "@/server/queries/tutorials";
import { revalidatePath } from "next/cache";
import { getCurrentUserId } from "@/lib/session";

/// Writes a TutorialCompletion row for the given tutorial and revalidates
/// /lessons so the next required-and-triggered tutorial (or lesson items,
/// once none remain) shows up immediately.
export async function acknowledgeTutorialAction(tutorialId: string): Promise<void> {
  const userId = await getCurrentUserId();
  await acknowledgeTutorial(tutorialId, userId);

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
  const count = await acknowledgeAllTutorials(userId);

  try {
    revalidatePath("/lessons");
    revalidatePath("/tutorials");
    revalidatePath("/");
  } catch {
    // No-op outside an active Next.js request scope (scripts/tests).
  }

  return count;
}
