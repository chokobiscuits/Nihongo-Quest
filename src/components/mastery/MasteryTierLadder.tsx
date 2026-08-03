import { MASTERY_TIER_BANDS, type MasteryTier } from "@/services/xp/mastery";
import { MasteryBadge } from "@/components/rank/MasteryBadge";
import { cn } from "@/lib/utils";

export interface MasteryTierLadderProps {
  /// The user's current account mastery tier — highlighted in the ladder,
  /// with progress shown toward whichever band comes next.
  currentTier: MasteryTier;
  /// XP already earned within the current account mastery level.
  xpIntoLevel: number;
  /// XP required to close out the current account mastery level.
  xpForNextLevel: number;
}

/// §19 tier ladder: Novice through Proficient are numbered 1-5, Expert/
/// Master/Sage/Transcendent widen as bands (they're the same ladder, just
/// wider steps at the top since mastery keeps climbing forever past it).
/// The user's current band is highlighted; every other band renders at rest.
export function MasteryTierLadder({ currentTier, xpIntoLevel, xpForNextLevel }: MasteryTierLadderProps) {
  // Skip "Unranked" (level 0) in the ladder proper — it's a fallback state,
  // not a tier a user levels toward. A user still at Unranked has no band to
  // highlight yet, so Novice (the first real tier) is highlighted instead as
  // "next up", with the progress bar still reading their real progress
  // toward it.
  const bands = MASTERY_TIER_BANDS.filter((b) => b.name !== "Unranked");
  const isUnranked = currentTier.level === 0;
  const highlightName = isUnranked ? bands[0]?.name : currentTier.name;
  const pct = xpForNextLevel > 0 ? Math.min(100, Math.round((xpIntoLevel / xpForNextLevel) * 100)) : 100;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start gap-4">
        {bands.map((band) => {
          const isCurrent = band.name === highlightName;
          return (
            <div
              key={band.name}
              className={cn(
                "flex flex-col items-center gap-2 rounded-[var(--radius-tile)] border p-3 transition-colors",
                isCurrent ? "border-[var(--accent)] bg-surface-2" : "border-line bg-surface",
              )}
              style={isCurrent ? ({ "--accent": `var(${band.colorToken})` } as React.CSSProperties) : undefined}
            >
              <MasteryBadge tier={{ name: band.name, level: band.min, colorToken: band.colorToken }} size="lg" />
              {isCurrent && (
                <span className="text-micro font-medium text-text-dim" lang="en">
                  {isUnranked ? "Next up" : "You are here"}
                </span>
              )}
            </div>
          );
        })}
        <div className="flex flex-col items-center gap-2 rounded-[var(--radius-tile)] border border-line bg-surface p-3">
          <span
            className="inline-flex h-16 w-16 items-center justify-center rounded-full border-4 text-h1 font-semibold"
            style={{ borderColor: "var(--color-rank-master)", color: "var(--color-rank-master)" }}
            aria-hidden
          >
            ∞
          </span>
          <span className="text-sub font-medium" style={{ color: "var(--color-rank-master)" }} lang="en">
            Transcendent
          </span>
        </div>
      </div>

      <div className="rounded-[var(--radius-tile)] border border-line bg-surface-2 p-3">
        <div className="flex items-center justify-between text-caption text-text-dim">
          <span lang="en">
            {isUnranked ? "Unranked" : `Lv.${currentTier.level} ${currentTier.name}`}
          </span>
          <span lang="en">
            {xpIntoLevel} / {xpForNextLevel} XP to next level
          </span>
        </div>
        <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-surface-3">
          <div
            className="h-full rounded-full"
            style={{ width: `${pct}%`, background: `var(${currentTier.colorToken})` }}
          />
        </div>
      </div>
    </div>
  );
}
