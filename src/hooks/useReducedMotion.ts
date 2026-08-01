import { useEffect, useState } from "react";

/// Tracks `prefers-reduced-motion: reduce`. CSS media queries can suppress
/// animation styling on their own, but they can't stop a component from
/// mounting particle DOM nodes in the first place — components that spawn
/// celebratory particles must check this hook before doing so.
function getInitialReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(getInitialReducedMotion);

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const listener = (event: MediaQueryListEvent) => setReduced(event.matches);
    query.addEventListener("change", listener);
    return () => query.removeEventListener("change", listener);
  }, []);

  return reduced;
}
