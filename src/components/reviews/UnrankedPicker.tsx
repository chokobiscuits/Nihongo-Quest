"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { UnrankedOption } from "@/server/queries/reviews";
import { cn } from "@/lib/utils";

export interface UnrankedPickerProps {
  options: UnrankedOption[];
}

const TYPE_LABEL: Record<string, string> = {
  KANA: "Kana",
  RADICAL: "Radicals",
  KANJI: "Kanji",
  VOCAB: "Vocabulary",
  GRAMMAR: "Grammar",
  SENTENCE: "Sentences",
  READING: "Reading",
};

/// Subject/level picker for an unranked practice session. Selection is
/// encoded into the URL rather than posted, so a chosen set is shareable and
/// survives a refresh; the page reads it back and builds the queue
/// server-side.
export function UnrankedPicker({ options }: UnrankedPickerProps) {
  const router = useRouter();
  const [types, setTypes] = useState<string[]>([]);
  const [levels, setLevels] = useState<number[]>([]);

  // Levels offered depend on the selected types: selecting nothing means
  // "everything", so show the union of all available levels.
  const availableLevels = useMemo(() => {
    const relevant = types.length > 0 ? options.filter((o) => types.includes(o.type)) : options;
    return Array.from(new Set(relevant.flatMap((o) => o.levels))).sort((a, b) => a - b);
  }, [options, types]);

  const matching = useMemo(() => {
    const relevant = types.length > 0 ? options.filter((o) => types.includes(o.type)) : options;
    return relevant.reduce((sum, o) => sum + o.count, 0);
  }, [options, types]);

  function toggleType(type: string) {
    setTypes((prev) => {
      const next = prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type];
      // Drop level selections that the new type set can no longer offer.
      const stillAvailable = new Set(
        (next.length > 0 ? options.filter((o) => next.includes(o.type)) : options).flatMap((o) => o.levels),
      );
      setLevels((ls) => ls.filter((l) => stillAvailable.has(l)));
      return next;
    });
  }

  function toggleLevel(level: number) {
    setLevels((prev) => (prev.includes(level) ? prev.filter((l) => l !== level) : [...prev, level]));
  }

  function start() {
    const params = new URLSearchParams();
    if (types.length > 0) params.set("types", types.join(","));
    if (levels.length > 0) params.set("levels", levels.join(","));
    router.push(`/reviews/practice/session?${params.toString()}`);
  }

  if (options.length === 0) {
    return (
      <div className="rounded-[var(--radius-card)] border border-line bg-surface p-6 text-body text-text-dim">
        Nothing to practise yet. Learn some items first and they&apos;ll show up here.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5 rounded-[var(--radius-card)] border border-line bg-surface p-6">
      <div className="flex flex-col gap-2">
        <span className="text-caption uppercase tracking-wide text-text-faint">Subjects</span>
        <div className="flex flex-wrap gap-2">
          {options.map((o) => (
            <button
              key={o.type}
              type="button"
              onClick={() => toggleType(o.type)}
              className={cn(
                "h-9 rounded-[var(--radius-chip)] border px-3 text-body font-medium",
                types.includes(o.type)
                  ? "border-transparent bg-brand-button text-on-brand"
                  : "border-line bg-surface-2 text-text-dim hover:bg-surface-3",
              )}
            >
              {TYPE_LABEL[o.type] ?? o.type} <span className="text-caption opacity-70">{o.count}</span>
            </button>
          ))}
        </div>
        <p className="text-caption text-text-faint">Select none to practise everything.</p>
      </div>

      {availableLevels.length > 0 && (
        <div className="flex flex-col gap-2">
          <span className="text-caption uppercase tracking-wide text-text-faint">Levels</span>
          <div className="flex flex-wrap gap-2">
            {availableLevels.map((l) => (
              <button
                key={l}
                type="button"
                onClick={() => toggleLevel(l)}
                className={cn(
                  "h-9 min-w-9 rounded-[var(--radius-chip)] border px-3 text-body font-medium",
                  levels.includes(l)
                    ? "border-transparent bg-brand-button text-on-brand"
                    : "border-line bg-surface-2 text-text-dim hover:bg-surface-3",
                )}
              >
                {l}
              </button>
            ))}
          </div>
          <p className="text-caption text-text-faint">Select none to practise all levels.</p>
        </div>
      )}

      <div className="flex flex-col gap-2 border-t border-line pt-4">
        <p className="text-caption text-text-dim">
          Up to {matching} item{matching === 1 ? "" : "s"} match. Practice earns no XP or mastery and never changes an
          item&apos;s SRS stage.
        </p>
        <button
          type="button"
          onClick={start}
          className="h-10 w-fit rounded-[var(--radius-chip)] bg-brand-button px-4 text-body font-medium text-on-brand"
        >
          Start practice
        </button>
      </div>
    </div>
  );
}
