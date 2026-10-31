"use server";

import { getCurrentUserId } from "@/lib/session";
import {
  commitReviewSessionImpl,
  commitUnrankedReviewSessionImpl,
  type CommitReviewSessionInput,
  type CommitReviewSessionResult,
  type CommitUnrankedSessionResult,
} from "./reviewsImpl";

export type {
  ReviewAnswerRecord,
  CommitReviewSessionInput,
  ReviewItemOutcome,
  CommitReviewSessionResult,
  CommitUnrankedSessionResult,
} from "./reviewsImpl";

/// Commits a completed review session in one transaction. Mirrors
/// commitLessonSession's shape: nothing is written until the whole session is
/// done, so an abandoned session leaves no trace. Every question answered —
/// correct or (final) incorrect — is logged; an item's SRS transition is
/// computed once, from its net incorrectCount for the whole item across
/// however many sub-answers it took to finally clear both kinds.
///
/// The actual logic lives in ./reviewsImpl — this wrapper's only job is to
/// derive `userId` from the signed-in session rather than trust a caller-
/// supplied one, since every exported function here is a public action
/// endpoint.
export async function commitReviewSession(input: CommitReviewSessionInput): Promise<CommitReviewSessionResult> {
  const userId = await getCurrentUserId();
  return commitReviewSessionImpl(input, userId);
}

/// Commits an UNRANKED (practice) session. See ./reviewsImpl's
/// commitUnrankedReviewSessionImpl for what it does and deliberately does
/// not do.
export async function commitUnrankedReviewSession(
  input: CommitReviewSessionInput,
): Promise<CommitUnrankedSessionResult> {
  const userId = await getCurrentUserId();
  return commitUnrankedReviewSessionImpl(input, userId);
}
