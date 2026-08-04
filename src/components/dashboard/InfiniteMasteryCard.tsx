"use client";

// §9 Infinite Mastery card: purple-to-indigo night scene with a torii
// silhouette, moon, and a scattering of stars — 4 of which twinkle on
// staggered delays.
//
// Shows the user's actual account mastery level and tier, with progress
// toward the next level. The ∞ motif remains because account mastery has no
// ceiling: the progress bar fills toward the next level, never toward a
// final one, and the card says so rather than implying a hidden cap.
// Rendered without props it degrades to the pure-decoration form it had
// before, which is what /mastery's closing flourish uses.

// Positions kept clear of the centered content block (roughly x: 15-85,
// y: 28-78, where the ∞ glyph / "Mastery Level ∞" / tagline text sits) so a
// star can never render on top of the text — they're pinned to the margins
// and the strip above/below the text instead. Each carries its own radius
// (2-4px in the card's own coordinate scale, see the r= usage below) and
// base opacity so the field reads as varied rather than uniform dots.
const STAR_POSITIONS = [
  { x: 6, y: 12, r: 1.1, opacity: 0.5 },
  { x: 30, y: 8, r: 0.8, opacity: 0.35 },
  { x: 55, y: 10, r: 1.3, opacity: 0.6 },
  { x: 8, y: 30, r: 0.9, opacity: 0.4 },
  { x: 4, y: 55, r: 1.0, opacity: 0.5 },
  { x: 6, y: 82, r: 0.8, opacity: 0.35 },
  { x: 94, y: 30, r: 1.2, opacity: 0.55 },
  { x: 96, y: 50, r: 0.9, opacity: 0.4 },
  { x: 92, y: 72, r: 1.1, opacity: 0.5 },
  { x: 40, y: 90, r: 0.8, opacity: 0.35 },
  { x: 65, y: 92, r: 1.0, opacity: 0.45 },
  { x: 18, y: 6, r: 1.2, opacity: 0.55 },
];

// Indices (into STAR_POSITIONS) that get the twinkle animation, each on its
// own delay so the sparkle reads as scattered rather than synchronized.
const TWINKLE_INDICES = [1, 4, 7, 10];
const TWINKLE_DELAYS_S = [0, 1, 2, 3];

export interface InfiniteMasteryCardProps {
  className?: string;
  /// Current account mastery level. Omit for the decorative-only variant.
  level?: number;
  /// Tier name for `level` (e.g. "Adept"), from masteryTier().
  tierName?: string;
  /// Mastery XP earned within the current level, and the total needed to
  /// reach the next one. Drives the progress bar.
  xpIntoLevel?: number;
  xpForNextLevel?: number;
}

export function InfiniteMasteryCard({
  className,
  level,
  tierName,
  xpIntoLevel,
  xpForNextLevel,
}: InfiniteMasteryCardProps) {
  const hasStats = level !== undefined;
  const pct =
    xpIntoLevel !== undefined && xpForNextLevel !== undefined && xpForNextLevel > 0
      ? Math.min(100, Math.max(0, Math.round((xpIntoLevel / xpForNextLevel) * 100)))
      : null;
  return (
    <div
      className={className}
      style={{
        position: "relative",
        overflow: "hidden",
        borderRadius: "var(--radius-card)",
        border: "1px solid var(--color-line)",
        minHeight: 220,
        background: "linear-gradient(160deg, #2a1a4d 0%, #1c1440 55%, #120c2e 100%)",
      }}
    >
      <svg
        viewBox="0 0 100 100"
        preserveAspectRatio="xMidYMid slice"
        className="absolute inset-0 h-full w-full"
        aria-hidden
      >
        {/* Moon */}
        <circle cx="78" cy="20" r="10" fill="#e9e2ff" opacity={0.9} />
        <circle cx="82" cy="17" r="10" fill="#1c1440" opacity={0.55} />

        {/* Stars — kept off to the margins so they never sit under the
            centered text block; see STAR_POSITIONS' comment. */}
        {STAR_POSITIONS.map((p, i) => {
          const twinkleIndex = TWINKLE_INDICES.indexOf(i);
          const isTwinkling = twinkleIndex !== -1;
          return (
            <circle
              key={i}
              cx={p.x}
              cy={p.y}
              r={p.r}
              fill="#ffffff"
              className={isTwinkling ? "mastery-star" : undefined}
              style={isTwinkling ? { animationDelay: `${TWINKLE_DELAYS_S[twinkleIndex]}s` } : { opacity: p.opacity }}
            />
          );
        })}

        {/* Torii silhouette, bottom-center */}
        <g fill="#0d0824" opacity={0.9}>
          <rect x="20" y="70" width="60" height="4" rx="1" />
          <rect x="24" y="76" width="52" height="2.5" rx="1" />
          <rect x="30" y="70" width="4" height="30" />
          <rect x="66" y="70" width="4" height="30" />
        </g>
      </svg>

      <div className="relative flex h-full flex-col items-center justify-center gap-2 px-6 py-10 text-center">
        {hasStats ? (
          <>
            <span
              className="text-glyph font-bold text-white"
              style={{ textShadow: "0 0 24px rgba(167,139,250,0.6)" }}
            >
              {level}
            </span>
            <span className="text-h3 font-semibold text-white" lang="en">
              Mastery Level {level}
              {tierName ? <span className="text-white/70"> · {tierName}</span> : null}
            </span>

            {pct !== null && (
              <div className="mt-1 flex w-full max-w-xs flex-col gap-1">
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/15">
                  <div
                    className="h-full rounded-full bg-white/85"
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <span className="text-caption text-white/60" lang="en">
                  {xpIntoLevel!.toLocaleString()} / {xpForNextLevel!.toLocaleString()} to level {level! + 1}
                </span>
              </div>
            )}

            <span className="mt-1 text-caption text-white/55" lang="en">
              No ceiling — mastery keeps climbing. ∞
            </span>
          </>
        ) : (
          <>
            <span className="text-glyph font-bold text-white" style={{ textShadow: "0 0 24px rgba(167,139,250,0.6)" }}>
              ∞
            </span>
            <span className="text-h3 font-semibold text-white" lang="en">
              Mastery Level ∞
            </span>
            <span className="text-sub text-white/70" lang="en">
              There is no limit. Only growth.
            </span>
          </>
        )}
      </div>
    </div>
  );
}
