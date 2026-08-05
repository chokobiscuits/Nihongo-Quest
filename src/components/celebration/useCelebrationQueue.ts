import { useState } from "react";
import type { RankTier } from "@/services/rank/tiers";
import type { CelebrationEvent } from "./types";

/// The subset of a commit result the celebration queue reads. Both
/// commitLessonSession and commitReviewSession satisfy this; it used to be
/// typed as the lesson result specifically and worked on review results only
/// by structural luck.
export interface ProgressionCommitResult {
  leveledUp: boolean;
  newLevel: number;
  xpAwarded: number;
  previousRank: { tier: string; division: number | null };
  newRank: { tier: string; division: number | null };
  rankPromoted: boolean;
  /// Reviews can also lose rank. Lessons never do, so this is optional.
  rankDemoted?: boolean;
  lpDelta?: number;
  lpAfter?: number;
  /// Achievements crossed by this session, if the commit path reports them.
  newAchievements?: {
    id: string;
    titleJa: string;
    titleEn: string;
    description: string;
    accent: string;
  }[];
}

/// Builds the celebration queue from a commit result. Only ever called
/// after the session has actually committed — never mid-session.
///
/// Promotion (division change within a tier) and New Rank (tier change) are
/// mutually exclusive, distinguished by whether the tier itself moved.
/// Demotion is its own event: rank can now fall, which it could not when
/// rank was a projection of an ever-increasing level.
export function celebrationEventsFromCommit(result: ProgressionCommitResult): CelebrationEvent[] {
  const events: CelebrationEvent[] = [];

  if (result.leveledUp) {
    events.push({ kind: "levelup", level: result.newLevel, xpAwarded: result.xpAwarded });
  }

  if (result.rankDemoted) {
    events.push({
      kind: "demotion",
      previousTier: result.previousRank.tier as RankTier,
      previousDivision: result.previousRank.division,
      newTier: result.newRank.tier as RankTier,
      newDivision: result.newRank.division,
      lpDelta: result.lpDelta ?? 0,
    });
  }

  for (const achievement of result.newAchievements ?? []) {
    events.push({ kind: "achievement", ...achievement });
  }

  if (result.rankPromoted) {
    const tierChanged = result.newRank.tier !== result.previousRank.tier;
    if (tierChanged) {
      events.push({
        kind: "newrank",
        tier: result.newRank.tier as RankTier,
        division: result.newRank.division,
        lp: result.lpAfter ?? 0,
      });
    } else {
      events.push({
        kind: "promotion",
        previousTier: result.previousRank.tier as RankTier,
        previousDivision: result.previousRank.division,
        newTier: result.newRank.tier as RankTier,
        newDivision: result.newRank.division,
      });
    }
  }

  return events;
}

export interface CelebrationQueueState {
  events: CelebrationEvent[];
  active: boolean;
}

/// Holds the currently-queued celebration events for display. `enqueue`
/// replaces the queue wholesale (one commit -> one queue) and `dismiss`
/// clears it, closing the modal.
export function useCelebrationQueue() {
  const [state, setState] = useState<CelebrationQueueState>({ events: [], active: false });

  function enqueue(events: CelebrationEvent[]) {
    if (events.length === 0) return;
    setState({ events, active: true });
  }

  function dismiss() {
    setState({ events: [], active: false });
  }

  return { ...state, enqueue, dismiss };
}
