"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useState, useTransition } from "react";
import { cn } from "@/lib/utils";

export interface SubjectFilterBarProps {
  accent: string;
  jlptOptions: number[];
}

const STATE_OPTIONS: { value: string; label: string }[] = [
  { value: "all", label: "All" },
  { value: "learning", label: "Learning" },
  { value: "not-started", label: "Not started" },
  { value: "locked", label: "Locked" },
  { value: "burned", label: "Burned" },
];

/// Compact search + state/JLPT filter row for `/subjects/[type]`. Writes to
/// URL search params so the server component re-fetches filtered data —
/// no client-side data fetching, just navigation.
export function SubjectFilterBar({ accent, jlptOptions }: SubjectFilterBarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [search, setSearch] = useState(searchParams.get("q") ?? "");
  const [, startTransition] = useTransition();

  const state = searchParams.get("state") ?? "all";
  const jlpt = searchParams.get("jlpt") ?? "";

  function updateParam(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(key, value);
    else params.delete(key);
    startTransition(() => {
      router.push(`${pathname}?${params.toString()}`);
    });
  }

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          updateParam("q", search);
        }}
        className="flex h-9 items-center gap-2 rounded-[var(--radius-chip)] border border-line bg-surface px-3 sm:w-64"
      >
        <span aria-hidden className="text-text-faint">
          ⌕
        </span>
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onBlur={() => updateParam("q", search)}
          placeholder="Search characters, readings, meanings"
          className="w-full bg-transparent text-caption text-text outline-none placeholder:text-text-faint"
        />
      </form>

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex h-8 items-center gap-1 rounded-[var(--radius-chip)] border border-line bg-surface p-1">
          {STATE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => updateParam("state", opt.value === "all" ? "" : opt.value)}
              className={cn(
                "rounded-[calc(var(--radius-chip)-2px)] px-2.5 h-6 text-micro font-medium transition-colors duration-[var(--duration-fast)]",
                state === opt.value ? "text-canvas" : "text-text-dim hover:text-text",
              )}
              style={state === opt.value ? { background: accent } : undefined}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {jlptOptions.length > 0 && (
          <select
            value={jlpt}
            onChange={(e) => updateParam("jlpt", e.target.value)}
            className="h-8 rounded-[var(--radius-chip)] border border-line bg-surface px-2 text-micro text-text outline-none"
          >
            <option value="">JLPT: any</option>
            {jlptOptions.map((n) => (
              <option key={n} value={n}>
                N{n}
              </option>
            ))}
          </select>
        )}
      </div>
    </div>
  );
}
