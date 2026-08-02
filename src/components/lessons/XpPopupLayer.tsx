"use client";

import { forwardRef, useImperativeHandle, useRef } from "react";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { cn } from "@/lib/utils";

export interface XpPopupLayerHandle {
  /// Spawns a floating `+{amount} XP` popup at a random horizontal jitter
  /// within the layer. Non-blocking: multiple pops can be in flight and
  /// each removes itself from the DOM when its animation ends.
  spawn: (amount: number) => void;
}

export interface XpPopupLayerProps {
  className?: string;
}

const JITTER_RANGE_PX = 12;

/// Absolutely-positioned overlay meant to sit on top of an answer input
/// (parent should be `position: relative`). Spawns are imperative via the
/// ref handle so callers — the lesson quiz today, the review runner later —
/// can fire a popup without re-rendering or holding popup state themselves.
export const XpPopupLayer = forwardRef<XpPopupLayerHandle, XpPopupLayerProps>(function XpPopupLayer(
  { className },
  ref,
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const reducedMotion = useReducedMotion();

  useImperativeHandle(
    ref,
    () => ({
      spawn(amount: number) {
        const container = containerRef.current;
        if (!container) return;

        const el = document.createElement("span");
        el.textContent = `+${amount} XP`;
        el.className = cn("xp-popup text-h3 font-semibold", reducedMotion && "xp-popup-reduced");

        if (!reducedMotion) {
          const jitter = Math.round((Math.random() * 2 - 1) * JITTER_RANGE_PX);
          el.style.setProperty("--xp-jitter", `${jitter}px`);
        }

        // Spawn at the container's top edge (the input's top edge, since
        // the container is expected to be positioned over the input),
        // horizontally centered before jitter shifts it.
        el.style.left = "50%";
        el.style.top = "0";
        el.style.transform = "translate(-50%, -100%)";

        el.addEventListener("animationend", () => el.remove());
        container.appendChild(el);
      },
    }),
    [reducedMotion],
  );

  return <div ref={containerRef} className={cn("pointer-events-none absolute inset-0", className)} aria-hidden />;
});
