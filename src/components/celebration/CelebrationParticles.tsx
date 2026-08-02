"use client";

import { useState } from "react";

export interface CelebrationParticlesProps {
  /// Particle count. Level Up/Promotion use 28; New Rank uses ~2x.
  count?: number;
  color: string;
  className?: string;
}

// 4-point star, matching the shape used elsewhere for sparkle motifs
// (RankCrest's Sparkle). clip-path star for particles that are marked
// "star"; the rest render as plain circles for visual variety in the burst.
const STAR_CLIP_PATH =
  "polygon(50% 0%, 61% 39%, 100% 50%, 61% 61%, 50% 100%, 39% 61%, 0% 50%, 39% 39%)";

/// Generates a one-shot CSS particle burst: spans with randomized inline
/// custom properties (`--particle-x/y/size/delay/duration`), animated purely
/// via the `.celebration-particle` keyframe — no rAF loop. Caller is
/// responsible for gating this out entirely under reduced motion (do not
/// render this component at all in that case).
export function CelebrationParticles({ count = 28, color, className }: CelebrationParticlesProps) {
  // Randomized once via a lazy initializer (not during render proper) so the
  // burst is generated exactly once per mount — a fresh burst comes from
  // remounting via `key` on the parent, not from re-running this on rerender.
  const [particles] = useState(() =>
    Array.from({ length: count }, (_, i) => {
      const angle = Math.random() * Math.PI * 2;
      const distance = 80 + Math.random() * 140; // 80-220px outward travel
      const size = 3 + Math.random() * 4; // 3-7px
      const duration = 900 + Math.random() * 600; // 900-1500ms
      const delay = Math.random() * 100;
      const isStar = i % 2 === 0;
      return {
        key: i,
        x: Math.cos(angle) * distance,
        y: Math.sin(angle) * distance,
        size,
        duration,
        delay,
        isStar,
      };
    }),
  );

  return (
    <div className={className} aria-hidden>
      {particles.map((p) => (
        <span
          key={p.key}
          className="celebration-particle"
          style={
            {
              "--particle-x": `${p.x}px`,
              "--particle-y": `${p.y}px`,
              "--particle-size": `${p.size}px`,
              "--particle-duration": `${p.duration}ms`,
              "--particle-delay": `${p.delay}ms`,
              "--particle-color": color,
              clipPath: p.isStar ? STAR_CLIP_PATH : undefined,
              borderRadius: p.isStar ? undefined : "50%",
            } as React.CSSProperties
          }
        />
      ))}
    </div>
  );
}
