import type { RankTier } from "@/services/rank/tiers";

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

/// Rank can fall now that it is LP-driven rather than a projection of an
/// ever-increasing level, so a demotion needs its own event.
export interface DemotionEvent {
  kind: "demotion";
  previousTier: RankTier;
  previousDivision: number | null;
  newTier: RankTier;
  newDivision: number | null;
  /// Negative.
  lpDelta: number;
}

export interface AchievementEvent {
  kind: "achievement";
  id: string;
  titleJa: string;
  titleEn: string;
  description: string;
  accent: string;
}

export type CelebrationEvent =
  | LevelUpEvent
  | DemotionEvent
  | AchievementEvent
  | PromotionEvent
  | NewRankEvent;

/// Fixed queue order: Level Up -> Demotion -> Promotion -> New Rank, so the
/// session always ends on its biggest moment. Demotion sits early so a
/// session that both lost a division and gained a level still closes on the
/// level-up rather than the setback.
///
/// Every kind MUST appear here — a missing entry yields undefined
/// comparisons and a silently broken sort.
const KIND_ORDER: Record<CelebrationEvent["kind"], number> = {
  levelup: 0,
  demotion: 1,
  achievement: 2,
  promotion: 3,
  newrank: 4,
};

export function sortCelebrationEvents(events: CelebrationEvent[]): CelebrationEvent[] {
  return [...events].sort((a, b) => KIND_ORDER[a.kind] - KIND_ORDER[b.kind]);
}
