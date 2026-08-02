import type { RankTier } from "@/services/xp/rank";

export interface LevelUpEvent {
  kind: "levelup";
  level: number;
  xpAwarded: number;
}

export interface PromotionEvent {
  kind: "promotion";
  previousTier: RankTier;
  previousDivision: number | null;
  newTier: RankTier;
  newDivision: number | null;
}

export interface NewRankEvent {
  kind: "newrank";
  tier: RankTier;
  division: number | null;
  lp: number;
}

export type CelebrationEvent = LevelUpEvent | PromotionEvent | NewRankEvent;

/// Fixed queue order per spec: Level Up -> Promotion -> New Rank, so the
/// session always ends on its biggest moment.
const KIND_ORDER: Record<CelebrationEvent["kind"], number> = {
  levelup: 0,
  promotion: 1,
  newrank: 2,
};

export function sortCelebrationEvents(events: CelebrationEvent[]): CelebrationEvent[] {
  return [...events].sort((a, b) => KIND_ORDER[a.kind] - KIND_ORDER[b.kind]);
}
