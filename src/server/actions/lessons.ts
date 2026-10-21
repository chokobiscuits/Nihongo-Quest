"use server";

import { getCurrentUserId } from "@/lib/session";
import {
  commitLessonSessionImpl,
  type CommitLessonSessionInput,
  type CommitLessonSessionResult,
} from "./lessonsImpl";

export type { LessonQuizAnswerRecord, CommitLessonSessionInput, CommitLessonSessionResult } from "./lessonsImpl";

/// Commits a completed lesson session in one transaction. See ./lessonsImpl
/// for what it actually does — this wrapper's only job is to derive `userId`
/// from the signed-in session rather than trust a caller-supplied one, since
/// every exported function here is a public action endpoint.
export async function commitLessonSession(input: CommitLessonSessionInput): Promise<CommitLessonSessionResult> {
  const userId = await getCurrentUserId();
  return commitLessonSessionImpl(input, userId);
}
