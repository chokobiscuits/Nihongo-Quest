"use server";

import { getCurrentUserId } from "@/lib/session";
import { resetProgressImpl, type ResetProgressResult } from "./resetImpl";

export type { ResetProgressResult } from "./resetImpl";

/// Wipes every trace of learning progress for the signed-in user. See
/// ./resetImpl for the full behavior — this wrapper's only job is to derive
/// `userId` from the signed-in session rather than trust a caller-supplied
/// one, since every exported function here is a public action endpoint.
/// This is irreversible: there is no backup and no undo.
export async function resetProgress(confirmation: string): Promise<ResetProgressResult> {
  const userId = await getCurrentUserId();
  return resetProgressImpl(confirmation, userId);
}
