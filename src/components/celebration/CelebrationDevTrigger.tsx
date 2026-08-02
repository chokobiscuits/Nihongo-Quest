"use client";

// ============================================================================
// TEMPORARY DEV-ONLY SCAFFOLDING — REMOVE BEFORE SHIP.
//
// A level-1 account cannot organically reach a level-up, promotion, or rank
// change, which makes the celebration modals unreviewable without this.
// Visit `/?celebrate=levelup`, `/?celebrate=promotion`, or
// `/?celebrate=newrank` to preview each variant. Delete this file and its
// usage in src/app/page.tsx once celebrations have been reviewed against a
// real commit result.
// ============================================================================

import { useSearchParams } from "next/navigation";
import { CelebrationModal } from "./CelebrationModal";
import type { CelebrationEvent } from "./types";

const PREVIEW_EVENTS: Record<string, CelebrationEvent[]> = {
  levelup: [{ kind: "levelup", level: 12, xpAwarded: 340 }],
  promotion: [
    {
      kind: "promotion",
      previousTier: "PLATINUM",
      previousDivision: 2,
      newTier: "PLATINUM",
      newDivision: 1,
    },
  ],
  newrank: [{ kind: "newrank", tier: "DIAMOND", division: 4, lp: 0 }],
  // Full queue preview: exercises the pip counter and "Skip all" control.
  all: [
    { kind: "levelup", level: 12, xpAwarded: 340 },
    { kind: "promotion", previousTier: "PLATINUM", previousDivision: 2, newTier: "PLATINUM", newDivision: 1 },
    { kind: "newrank", tier: "DIAMOND", division: 4, lp: 0 },
  ],
};

export function CelebrationDevTrigger() {
  const searchParams = useSearchParams();
  const key = searchParams.get("celebrate");
  const events = key ? PREVIEW_EVENTS[key] : undefined;

  if (!events) return null;

  return <CelebrationModal events={events} onDismissAll={() => {}} />;
}
