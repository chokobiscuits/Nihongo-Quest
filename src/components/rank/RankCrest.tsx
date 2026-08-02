"use client";

import { useState } from "react";
import Image from "next/image";
import type { RankTier } from "@/services/xp/rank";
import { cn } from "@/lib/utils";
import { useReducedMotion } from "@/hooks/useReducedMotion";

export type RankCrestSize = "xs" | "sm" | "md" | "lg" | "hero";

export interface RankCrestProps {
  tier: RankTier;
  division: number | null;
  size?: RankCrestSize;
  variant?: "solid" | "ghost";
  className?: string;
}

const SIZE_PX: Record<RankCrestSize, number> = {
  xs: 16,
  sm: 24,
  md: 40,
  lg: 96,
  hero: 160,
};

const DIVISION_NUMERAL: Record<number, string> = { 1: "I", 2: "II", 3: "III", 4: "IV" };

// Facet count is the differentiator across tiers, per the tier ladder. Each
// tier shares the same shield/hexagon outline; only the internal facet
// subdivisions and the gradient stops change.
const FACETS: Record<RankTier, number> = {
  IRON: 3,
  BRONZE: 4,
  SILVER: 5,
  GOLD: 6,
  PLATINUM: 7,
  DIAMOND: 8,
  MASTER: 9,
  GRANDMASTER: 10,
  CHALLENGER: 11,
};

const SPARKLES: Record<RankTier, number> = {
  IRON: 0,
  BRONZE: 0,
  SILVER: 0,
  GOLD: 1,
  PLATINUM: 2,
  DIAMOND: 3,
  MASTER: 0,
  GRANDMASTER: 0,
  CHALLENGER: 0,
};

const HAS_GLOW: Record<RankTier, boolean> = {
  IRON: false,
  BRONZE: false,
  SILVER: false,
  GOLD: false,
  PLATINUM: false,
  DIAMOND: true,
  MASTER: true,
  GRANDMASTER: true,
  CHALLENGER: true,
};

const HAS_AURA: Record<RankTier, boolean> = {
  IRON: false,
  BRONZE: false,
  SILVER: false,
  GOLD: false,
  PLATINUM: false,
  DIAMOND: false,
  MASTER: true,
  GRANDMASTER: true,
  CHALLENGER: true,
};

const HAS_WINGS: Record<RankTier, boolean> = {
  IRON: false,
  BRONZE: false,
  SILVER: false,
  GOLD: false,
  PLATINUM: false,
  DIAMOND: false,
  MASTER: false,
  GRANDMASTER: true,
  CHALLENGER: true,
};

const HAS_CROWN: Record<RankTier, boolean> = {
  IRON: false,
  BRONZE: false,
  SILVER: false,
  GOLD: false,
  PLATINUM: false,
  DIAMOND: false,
  MASTER: false,
  GRANDMASTER: false,
  CHALLENGER: true,
};

/// Gradient stops per tier: [dark, token, light]. The middle stop reads the
/// existing `--color-rank-*` token so palette edits in globals.css propagate
/// here without touching this file.
const GRADIENT_STOPS: Record<RankTier, [string, string, string]> = {
  IRON: ["#5c5f68", "var(--color-rank-iron)", "#8d909a"],
  BRONZE: ["#7d5230", "var(--color-rank-bronze)", "#c98f5c"],
  SILVER: ["#78889b", "var(--color-rank-silver)", "#d6e0eb"],
  GOLD: ["#a87f22", "var(--color-rank-gold)", "#f5dd9c"],
  PLATINUM: ["#2f9c92", "var(--color-rank-platinum)", "#a8f0e8"],
  DIAMOND: ["#2d7fc4", "var(--color-rank-diamond)", "#bfe0fc"],
  MASTER: ["#8a34b4", "var(--color-rank-master)", "#e5bcfa"],
  GRANDMASTER: ["#a02830", "var(--color-rank-grandmaster)", "#f7b0b5"],
  // Challenger's fill animates via the same pan used by `.rank-challenger`.
  CHALLENGER: ["#39d0e8", "#f2c14b", "#e86ad0"],
};

/// Shield/hexagon outline shared by every tier, in a 0-100 viewBox.
const SHIELD_PATH =
  "M50 4 L90 20 L90 52 C90 76 72 92 50 98 C28 92 10 76 10 52 L10 20 Z";

// Facet division lines fan out from the crest apex to points spaced evenly
// around the shield's perimeter, so higher facet counts read as a denser gem
// rather than a different shape.
function facetLines(count: number): { x: number; y: number }[] {
  const perimeterPoints: { x: number; y: number }[] = [];
  const t = (frac: number) => {
    // Rough parametric walk around the shield outline for facet endpoints —
    // doesn't need to be exact, just evenly distributed and visually plausible.
    const angle = frac * Math.PI * 2 - Math.PI / 2;
    const rx = 40;
    const ry = 46;
    return { x: 50 + rx * Math.cos(angle), y: 52 + ry * Math.sin(angle) };
  };
  for (let i = 0; i < count; i++) {
    perimeterPoints.push(t(i / count));
  }
  return perimeterPoints;
}

const SPARKLE_POSITIONS = [
  { x: 68, y: 26 },
  { x: 30, y: 34 },
  { x: 58, y: 66 },
  { x: 36, y: 58 },
];

function Sparkle({ x, y, sizePx }: { x: number; y: number; sizePx: number }) {
  return (
    <path
      d={`M${x} ${y - sizePx} L${x + sizePx * 0.3} ${y - sizePx * 0.3} L${x + sizePx} ${y} L${x + sizePx * 0.3} ${y + sizePx * 0.3} L${x} ${y + sizePx} L${x - sizePx * 0.3} ${y + sizePx * 0.3} L${x - sizePx} ${y} L${x - sizePx * 0.3} ${y - sizePx * 0.3} Z`}
      fill="oklch(1 0 0 / 0.85)"
    />
  );
}

/// Inline SVG shield crest used for the nine rank tiers, plus a `ghost`
/// silhouette variant for the tier ladder. Facet count differentiates
/// tiers (see the FACETS table); complexity scales with `size` so a
/// low-tier badge at 16px isn't mud and a hero-size crest earns its detail.
export function RankCrest({ tier, division, size = "md", variant = "solid", className }: RankCrestProps) {
  const reducedMotion = useReducedMotion();
  const px = SIZE_PX[size];
  const gradientId = `rank-crest-${tier.toLowerCase()}-${variant}`;
  const isChallenger = tier === "CHALLENGER";
  const tierKey = tier.toLowerCase();

  // Prefer a user-supplied crest PNG at /crests/{tier}.png; fall back to the
  // inline SVG below when it 404s (the art isn't landed yet). `solid` only —
  // `ghost` silhouettes always use the SVG since there's no locked-crest art.
  const [pngFailed, setPngFailed] = useState(false);
  if (variant === "solid" && !pngFailed) {
    return (
      <span
        className={cn("relative inline-block", className)}
        style={{ width: px, height: px }}
      >
        <Image
          src={`/crests/${tierKey}.png`}
          alt={`${tier}${division ? ` ${DIVISION_NUMERAL[division]}` : ""} rank crest`}
          width={px}
          height={px}
          unoptimized
          onError={() => setPngFailed(true)}
        />
      </span>
    );
  }

  const isSimple = size === "xs" || size === "sm";
  const isHero = size === "hero";
  const facetCount = FACETS[tier];
  const sparkleCount = SPARKLES[tier];
  const glow = HAS_GLOW[tier];
  const aura = HAS_AURA[tier];
  const wings = HAS_WINGS[tier];
  const crown = HAS_CROWN[tier];

  if (variant === "ghost") {
    return (
      <svg
        width={px}
        height={px}
        viewBox="0 0 100 100"
        className={className}
        role="img"
        aria-label={`${tier} rank (locked)`}
      >
        <path
          d={SHIELD_PATH}
          fill="var(--color-surface-3)"
          stroke={`var(--color-rank-${tierKey === "challenger" ? "grandmaster" : tierKey})`}
          strokeWidth={1}
        />
      </svg>
    );
  }

  const [c1, c2, c3] = GRADIENT_STOPS[tier];

  return (
    <svg
      width={px}
      height={px}
      viewBox="0 0 100 100"
      className={cn(aura && "overflow-visible", className)}
      role="img"
      aria-label={`${tier}${division ? ` ${DIVISION_NUMERAL[division]}` : ""} rank crest`}
      data-tier={tier}
      data-facets={facetCount}
    >
      <defs>
        <linearGradient
          id={gradientId}
          x1="0%"
          y1="0%"
          x2="100%"
          y2="100%"
          gradientUnits="objectBoundingBox"
        >
          <stop offset="0%" stopColor={c1} />
          <stop offset="55%" stopColor={c2} />
          <stop offset="100%" stopColor={c3} />
          {isChallenger && !reducedMotion && (
            <animateTransform
              attributeName="gradientTransform"
              type="translate"
              values="0 0; 0.3 0; 0 0"
              dur="6s"
              repeatCount="indefinite"
            />
          )}
        </linearGradient>
        {isHero && (
          <linearGradient id={`${gradientId}-sweep`} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="white" stopOpacity="0" />
            <stop offset="50%" stopColor="white" stopOpacity="0.55" />
            <stop offset="100%" stopColor="white" stopOpacity="0" />
          </linearGradient>
        )}
      </defs>

      {aura && (
        <path
          d={SHIELD_PATH}
          fill="none"
          stroke={c2}
          strokeWidth={4}
          opacity={0.35}
          transform="scale(1.06)"
          style={{ transformOrigin: "50px 52px" }}
        />
      )}

      {wings && (
        <>
          <polygon points="10,30 -6,42 10,58" fill={c2} opacity={0.7} />
          <polygon points="90,30 106,42 90,58" fill={c2} opacity={0.7} />
        </>
      )}

      <path
        d={SHIELD_PATH}
        fill={`url(#${gradientId})`}
        stroke="oklch(0 0 0 / 0.25)"
        strokeWidth={1}
        style={
          glow
            ? { filter: `drop-shadow(0 0 6px color-mix(in oklch, ${c2} 60%, transparent))` }
            : undefined
        }
      />

      {!isSimple &&
        facetLines(facetCount).map((p, i) => (
          <line
            key={i}
            x1={50}
            y1={20}
            x2={p.x}
            y2={p.y}
            stroke={isHero ? "oklch(1 0 0 / 0.22)" : "oklch(0 0 0 / 0.18)"}
            strokeWidth={0.6}
          />
        ))}

      {!isSimple &&
        SPARKLE_POSITIONS.slice(0, sparkleCount).map((p, i) => (
          <Sparkle key={i} x={p.x} y={p.y} sizePx={3.5} />
        ))}

      {crown && (
        <polygon
          points="38,10 44,-2 50,8 56,-2 62,10 50,14"
          fill={c3}
          stroke="oklch(0 0 0 / 0.25)"
          strokeWidth={0.6}
        />
      )}

      {isHero && !reducedMotion && (
        <g>
          <clipPath id={`${gradientId}-clip`}>
            <path d={SHIELD_PATH} />
          </clipPath>
          <rect
            x="0"
            y="0"
            width="100"
            height="100"
            fill={`url(#${gradientId}-sweep)`}
            clipPath={`url(#${gradientId}-clip)`}
          >
            <animateTransform
              attributeName="transform"
              type="translate"
              values="-100 0; 100 0"
              dur="3s"
              repeatCount="indefinite"
            />
          </rect>
        </g>
      )}

      {!isSimple && division !== null && (
        <g>
          <rect x="38" y="4" width="24" height="12" rx="2" fill="oklch(0 0 0 / 0.35)" />
          <text
            x="50"
            y="13"
            textAnchor="middle"
            fontSize="9"
            fontWeight={700}
            fill="oklch(1 0 0 / 0.92)"
          >
            {DIVISION_NUMERAL[division]}
          </text>
        </g>
      )}
    </svg>
  );
}
