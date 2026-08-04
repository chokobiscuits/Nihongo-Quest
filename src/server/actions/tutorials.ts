"use server";

import { acknowledgeTutorial } from "@/server/queries/tutorials";
import { revalidatePath } from "next/cache";

const APP_USER_ID = process.env.APP_USER_ID ?? "local-user";

/// Writes a TutorialCompletion row for the given tutorial and revalidates
/// /lessons so the next required-and-triggered tutorial (or lesson items,
/// once none remain) shows up immediately.
export async function acknowledgeTutorialAction(tutorialId: string, userId: string = APP_USER_ID): Promise<void> {
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
