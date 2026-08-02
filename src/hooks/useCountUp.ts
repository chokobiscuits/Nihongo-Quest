import { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "./useReducedMotion";

/// Ticks a numeral from 0 to `value` over `durationMs` using
/// requestAnimationFrame, easing with `--ease-out`'s cubic-bezier shape
/// approximated in JS. Used for streak counts, XP totals, item counts, and
/// donut percentages — anywhere a numeral should read as "counting up" on
/// mount rather than appearing instantly. Renders the final value
/// immediately under reduced motion.
export function useCountUp(value: number, durationMs = 700): number {
  const reducedMotion = useReducedMotion();
  const [display, setDisplay] = useState(0);
  const startRef = useRef<number | null>(null);
  const frameRef = useRef<number | null>(null);

  useEffect(() => {
    if (reducedMotion) {
      return;
    }

    startRef.current = null;
    if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);

    function tick(timestamp: number) {
      if (startRef.current === null) startRef.current = timestamp;
      const elapsed = timestamp - startRef.current!;
      const t = Math.min(1, elapsed / durationMs);
      // cubic ease-out approximation, matching --ease-out's general shape.
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(Math.round(eased * value));
      if (t < 1) {
        frameRef.current = requestAnimationFrame(tick);
      }
    }

    // Kick off from a fresh rAF rather than a synchronous setState(0) here —
    // the first tick callback naturally paints 0 (t=0 -> eased=0).
    frameRef.current = requestAnimationFrame(tick);
    return () => {
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    };
  }, [value, durationMs, reducedMotion]);

  return reducedMotion ? value : display;
}
