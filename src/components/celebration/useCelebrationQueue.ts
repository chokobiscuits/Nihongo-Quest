import { useState } from "react";
import type { CommitLessonSessionResult } from "@/server/actions/lessons";
import { lpProgress } from "@/components/rank/RankLevelCard";
import type { RankTier } from "@/services/xp/rank";
import type { CelebrationEvent } from "./types";

/// Builds the celebration queue from a commit result. Only ever called
/// after the session has actually committed — never mid-session. Promotion
/// (division change within a tier) and New Rank (tier change) are mutually
/// exclusive outcomes of the same `rankPromoted` flag, distinguished by
/// whether the tier itself moved.
export function celebrationEventsFromCommit(result: CommitLessonSessionResult): CelebrationEvent[] {
  const events: CelebrationEvent[] = [];

  if (result.leveledUp) {
    events.push({ kind: "levelup", level: result.newLevel, xpAwarded: result.xpAwarded });
  }

  if (result.rankPromoted) {
    const tierChanged = result.newRank.tier !== result.previousRank.tier;
    if (tierChanged) {
      const lp = lpProgress(result.newLevel, Number(result.totalXp));
      events.push({
        kind: "newrank",
        tier: result.newRank.tier as RankTier,
        division: result.newRank.division,
        lp,
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
