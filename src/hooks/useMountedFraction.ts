import { useEffect, useState } from "react";
import { useReducedMotion } from "./useReducedMotion";

/// Returns 0 on first render, then the target `fraction` (0-1) once mounted,
/// so a CSS `transition-[width]` on the consumer sweeps the bar/ring from
/// empty to its value. `delayMs` staggers multiple bars down a page. At
/// target 0 the caller should still render a nonzero minimum width so the
/// sweep is visible (see e.g. DashboardHeader's `isNewAccount` clamp).
export function useMountedFraction(fraction: number, delayMs = 0): number {
  const reducedMotion = useReducedMotion();
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    if (reducedMotion) return;
    const timer = setTimeout(() => setRevealed(true), delayMs);
    return () => clearTimeout(timer);
  }, [delayMs, reducedMotion]);

  return reducedMotion || revealed ? fraction : 0;
}
