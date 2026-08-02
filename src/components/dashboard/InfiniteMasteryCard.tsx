"use client";

// §9 Infinite Mastery card: purple-to-indigo night scene with a torii
// silhouette, moon, and a scattering of stars — 4 of which twinkle on
// staggered delays. Account mastery has no ceiling, so this card exists to
// say that plainly rather than imply a hidden cap the way a percent bar
// would.

const STAR_POSITIONS = [
  { x: 18, y: 22 }, { x: 42, y: 14 }, { x: 66, y: 26 }, { x: 84, y: 18 },
  { x: 12, y: 42 }, { x: 30, y: 34 }, { x: 58, y: 40 }, { x: 92, y: 38 },
  { x: 8, y: 60 }, { x: 76, y: 12 }, { x: 50, y: 54 }, { x: 96, y: 58 },
];

// Indices (into STAR_POSITIONS) that get the twinkle animation, each on its
// own delay so the sparkle reads as scattered rather than synchronized.
const TWINKLE_INDICES = [1, 4, 7, 10];
const TWINKLE_DELAYS_S = [0, 1, 2, 3];

export function InfiniteMasteryCard({ className }: { className?: string }) {
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

        {/* Stars */}
        {STAR_POSITIONS.map((p, i) => {
          const twinkleIndex = TWINKLE_INDICES.indexOf(i);
          const isTwinkling = twinkleIndex !== -1;
          return (
            <circle
              key={i}
              cx={p.x}
              cy={p.y}
              r={0.7}
              fill="#ffffff"
              className={isTwinkling ? "mastery-star" : undefined}
              style={isTwinkling ? { animationDelay: `${TWINKLE_DELAYS_S[twinkleIndex]}s` } : { opacity: 0.55 }}
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
        <span className="text-glyph font-bold text-white" style={{ textShadow: "0 0 24px rgba(167,139,250,0.6)" }}>
          ∞
        </span>
        <span className="text-h3 font-semibold text-white" lang="en">
          Mastery Level ∞
        </span>
        <span className="text-sub text-white/70" lang="en">
          There is no limit. Only growth.
        </span>
      </div>
    </div>
  );
}
