"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { RankCrest } from "@/components/rank/RankCrest";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { cn } from "@/lib/utils";
import { CelebrationParticles } from "./CelebrationParticles";
import { CelebrationNumeral } from "./CelebrationNumeral";
import { sortCelebrationEvents, type CelebrationEvent } from "./types";

export interface CelebrationModalProps {
  events: CelebrationEvent[];
  onDismissAll: () => void;
  /// Element to return focus to once every queued event is dismissed.
  triggerRef?: React.RefObject<HTMLElement | null>;
}

const TIER_LABEL: Record<string, string> = {
  IRON: "Iron",
  BRONZE: "Bronze",
  SILVER: "Silver",
  GOLD: "Gold",
  PLATINUM: "Platinum",
  DIAMOND: "Diamond",
  MASTER: "Master",
  GRANDMASTER: "Grandmaster",
  CHALLENGER: "Challenger",
};

const DIVISION_NUMERAL: Record<number, string> = { 1: "I", 2: "II", 3: "III", 4: "IV" };

function rankLine(tier: string, division: number | null): string {
  return division !== null ? `${TIER_LABEL[tier]} ${DIVISION_NUMERAL[division]}` : TIER_LABEL[tier];
}

/// Sequences one or more celebration events (level up, promotion, new rank)
/// behind a single overlay: the overlay itself is held between items while
/// only the hero card cross-fades. Fires only after a lesson/review session
/// has already committed — this component is a pure consumer of results
/// that already happened, never itself a source of truth.
export function CelebrationModal({ events, onDismissAll, triggerRef }: CelebrationModalProps) {
  const reducedMotion = useReducedMotion();
  const ordered = useMemo(() => sortCelebrationEvents(events), [events]);
  const [index, setIndex] = useState(0);
  const [transitioning, setTransitioning] = useState(false);
  const dismissButtonRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  const current = ordered[index];
  const isLast = index === ordered.length - 1;
  const showPips = ordered.length > 1;
  const showSkip = ordered.length > 1 && index >= 1;

  useEffect(() => {
    const timer = setTimeout(() => dismissButtonRef.current?.focus(), reducedMotion ? 0 : 700);
    return () => clearTimeout(timer);
  }, [index, reducedMotion]);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        finish();
      }
      if (e.key === "Tab") {
        // Single focusable element (the dismiss/skip button) — a full trap
        // just keeps focus pinned there rather than escaping to the page.
        e.preventDefault();
        dismissButtonRef.current?.focus();
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index]);

  function finish() {
    onDismissAll();
    triggerRef?.current?.focus();
  }

  function advance() {
    if (isLast) {
      finish();
      return;
    }
    if (reducedMotion) {
      setIndex((i) => i + 1);
      return;
    }
    // Cross-fade only the card: 200ms out, 120ms gap, 240ms in.
    setTransitioning(true);
    setTimeout(() => {
      setIndex((i) => i + 1);
      setTimeout(() => setTransitioning(false), 20);
    }, 320);
  }

  if (!current) return null;

  const headingId = "celebration-heading";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center celebration-overlay"
      style={{ background: "oklch(0.08 0.02 295 / 0.88)", backdropFilter: "blur(6px)" }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={headingId}
        className="relative flex flex-col items-center px-6 py-8"
      >
        {!transitioning && (
          <CelebrationCard
            key={index}
            event={current}
            headingId={headingId}
            reducedMotion={reducedMotion}
            dismissButtonRef={dismissButtonRef}
            onPrimary={advance}
            isLast={isLast}
          />
        )}

        {(showPips || showSkip) && (
          <div className="mt-6 flex items-center gap-4">
            {showPips && (
              <span className="text-caption tabular-nums text-text-dim" lang="en">
                {index + 1} / {ordered.length}
              </span>
            )}
            {showSkip && (
              <button
                type="button"
                onClick={finish}
                className="text-caption text-text-faint underline-offset-2 hover:text-text hover:underline"
              >
                Skip all
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function CelebrationCard({
  event,
  headingId,
  reducedMotion,
  dismissButtonRef,
  onPrimary,
  isLast,
}: {
  event: CelebrationEvent;
  headingId: string;
  reducedMotion: boolean;
  dismissButtonRef: React.RefObject<HTMLButtonElement | null>;
  onPrimary: () => void;
  isLast: boolean;
}) {
  const heroClass = reducedMotion ? "opacity-100" : "celebration-hero";
  const glowClass = reducedMotion ? "opacity-70" : "celebration-glow";
  const bodyLineClass = () => (reducedMotion ? "" : "celebration-body-line");
  const bodyLineStyle = (delayMs: number): React.CSSProperties =>
    reducedMotion ? {} : { animationDelay: `${delayMs}ms` };
  const dismissClass = reducedMotion ? "opacity-100" : "celebration-dismiss";

  if (event.kind === "levelup") {
    return (
      <div className="relative flex flex-col items-center gap-5 text-center">
        <div
          className={cn("absolute left-1/2 top-[70px] -translate-x-1/2 rounded-full", glowClass)}
          style={{
            width: 320,
            height: 320,
            background:
              "radial-gradient(circle, color-mix(in oklch, var(--color-brand) 70%, transparent), transparent 70%)",
          }}
          aria-hidden
        />

        <div className={cn("relative flex flex-col items-center gap-4", heroClass)}>
          <div className="relative">
            {!reducedMotion && <CelebrationParticles count={28} color="var(--color-brand)" className="absolute inset-0" />}
            <div
              className="flex items-center justify-center rounded-full"
              style={{
                width: 200,
                height: 200,
                background: "linear-gradient(155deg, var(--color-brand-hover), var(--color-brand) 60%, var(--color-brand-bg))",
                boxShadow: "0 0 60px -10px color-mix(in oklch, var(--color-brand) 70%, transparent)",
              }}
            >
              <span className="text-glyph font-bold text-white">{event.level}</span>
            </div>
          </div>

          <h2 id={headingId} className={cn("text-h1 font-semibold text-text", bodyLineClass())} style={bodyLineStyle(480)} lang="en">
            Level Up!
          </h2>
          <p className={cn("text-body text-text-muted", bodyLineClass())} style={bodyLineStyle(550)}>
            <CelebrationNumeral value={event.xpAwarded} prefix="+" suffix=" XP" />
          </p>
        </div>

        <button
          ref={dismissButtonRef}
          type="button"
          onClick={onPrimary}
          className={cn(
            "rounded-[var(--radius-chip)] bg-brand px-8 h-11 text-body font-semibold text-text hover:bg-brand-hover transition-colors duration-[var(--duration-fast)]",
            dismissClass,
          )}
        >
          {isLast ? "Awesome!" : "Awesome!"}
        </button>
      </div>
    );
  }

  if (event.kind === "promotion") {
    return (
      <div className="relative flex flex-col items-center gap-5 text-center">
        <div
          className={cn("absolute left-1/2 top-[50px] -translate-x-1/2 rounded-full", glowClass)}
          style={{
            width: 300,
            height: 300,
            background: `radial-gradient(circle, color-mix(in oklch, var(--color-rank-${event.newTier.toLowerCase()}) 70%, transparent), transparent 70%)`,
          }}
          aria-hidden
        />

        <div className={cn("relative flex flex-col items-center gap-4", heroClass)}>
          <div className="flex items-center gap-4">
            <div className="flex flex-col items-center gap-1" style={{ opacity: 0.4, transform: "scale(0.9)" }}>
              <RankCrest tier={event.previousTier} division={event.previousDivision} size="lg" />
            </div>
            <span aria-hidden className="text-h2 text-text-faint">→</span>
            <div className="relative flex flex-col items-center gap-1">
              {!reducedMotion && (
                <CelebrationParticles count={28} color={`var(--color-rank-${event.newTier.toLowerCase()})`} className="absolute inset-0" />
              )}
              <div
                className={reducedMotion ? "" : "celebration-hero"}
                style={reducedMotion ? undefined : { animationDelay: "400ms" }}
              >
                <RankCrest tier={event.newTier} division={event.newDivision} size="lg" />
              </div>
            </div>
          </div>

          <h2 id={headingId} className={cn("text-h1 font-semibold text-text", bodyLineClass())} style={bodyLineStyle(480)} lang="en">
            Promotion!
          </h2>
          <p className={cn("text-body text-text-muted", bodyLineClass())} style={bodyLineStyle(550)} lang="en">
            {rankLine(event.previousTier, event.previousDivision)} → {rankLine(event.newTier, event.newDivision)}
          </p>
        </div>

        <button
          ref={dismissButtonRef}
          type="button"
          onClick={onPrimary}
          className={cn(
            "rounded-[var(--radius-chip)] bg-brand px-8 h-11 text-body font-semibold text-text hover:bg-brand-hover transition-colors duration-[var(--duration-fast)]",
            dismissClass,
          )}
        >
          Let&apos;s go!
        </button>
      </div>
    );
  }

  // New Rank (tier change): biggest moment, ~2x the particles/duration.
  return (
    <div className="relative flex flex-col items-center gap-5 text-center">
      <div
        className={cn("absolute left-1/2 top-[70px] -translate-x-1/2 rounded-full", glowClass)}
        style={{
          width: 360,
          height: 360,
          background: `radial-gradient(circle, color-mix(in oklch, var(--color-rank-${event.tier.toLowerCase()}) 75%, transparent), transparent 70%)`,
        }}
        aria-hidden
      />

      <div className={cn("relative flex flex-col items-center gap-4", heroClass)}>
        <div className="relative">
          {!reducedMotion && (
            <CelebrationParticles
              count={56}
              color={`var(--color-rank-${event.tier.toLowerCase()})`}
              className="absolute inset-0"
            />
          )}
          <RankCrest tier={event.tier} division={event.division} size="hero" />
        </div>

        <h2 id={headingId} className={cn("text-h1 font-semibold text-text", bodyLineClass())} style={bodyLineStyle(480)} lang="en">
          New Rank!
        </h2>
        <p className={cn("text-body font-semibold text-text", bodyLineClass())} style={bodyLineStyle(550)} lang="en">
          {rankLine(event.tier, event.division)}
        </p>
        <p
          className={cn("text-h1 tabular-nums", bodyLineClass())}
          style={{ ...bodyLineStyle(620), color: `var(--color-rank-${event.tier.toLowerCase()})` }}
        >
          <CelebrationNumeral value={event.lp} suffix=" LP" />
        </p>
      </div>

      <button
        ref={dismissButtonRef}
        type="button"
        onClick={onPrimary}
        className={cn("rounded-[var(--radius-chip)] px-8 h-11 text-body font-semibold transition-opacity duration-[var(--duration-fast)] hover:opacity-90", dismissClass)}
        style={{
          background: "linear-gradient(135deg,#f3d98b,var(--color-rank-gold),#b98626)",
          color: "#1a1420",
        }}
      >
        Keep going!
      </button>
    </div>
  );
}
