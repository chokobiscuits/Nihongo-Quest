"use server";

import { getCurrentUserId } from "@/lib/session";
import { skipKanaImpl, unskipKanaImpl, type SkipKanaResult, type UnskipKanaResult } from "./kanaImpl";

export type { SkipKanaResult, UnskipKanaResult } from "./kanaImpl";

/// "I already know kana": marks EVERY kana subject as Burned. See ./kanaImpl
/// for the full behavior — this wrapper's only job is to derive `userId`
/// from the signed-in session rather than trust a caller-supplied one, since
/// every exported function here is a public action endpoint.
export async function skipKana(): Promise<SkipKanaResult> {
  const userId = await getCurrentUserId();
  return skipKanaImpl(userId);
}

/// Reverses skipKana. See ./kanaImpl for the full behavior.
export async function unskipKana(): Promise<UnskipKanaResult> {
  const userId = await getCurrentUserId();
  return unskipKanaImpl(userId);
}
