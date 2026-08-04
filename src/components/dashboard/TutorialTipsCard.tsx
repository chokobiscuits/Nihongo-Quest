"use client";

import { useState } from "react";
import Link from "next/link";
import { Panel } from "@/components/panel/Panel";
import { TutorialIcon } from "@/components/shell/NavIcons";
import type { TutorialSummary } from "@/server/queries/tutorials";

export interface TutorialTipsCardProps {
  tutorials: TutorialSummary[];
}

/// Dashboard surface for OPTIONAL tutorials that are currently triggered but
/// not yet completed — never blocking, unlike the required-tutorial gate on
/// /lessons. Each row is dismissible for the session (local state only); the
/// tutorial stays available in the /tutorials library either way, and only
/// visiting it and completing the flow writes a real TutorialCompletion.
export function TutorialTipsCard({ tutorials }: TutorialTipsCardProps) {
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const visible = tutorials.filter((t) => !dismissed.has(t.id));

  if (visible.length === 0) return null;

  return (
    <Panel accent="var(--color-brand)" icon={<TutorialIcon />} title="Tips available" titleJa="ヒント">
      <div className="flex flex-col gap-2">
        {visible.map((t) => (
          <div
            key={t.id}
            className="flex items-center justify-between gap-3 rounded-[var(--radius-tile)] border border-line bg-surface-2 px-3 py-2"
          >
            <Link href={`/tutorials/${t.slug}`} className="min-w-0 flex-1 hover:text-text">
              <span className="block truncate text-sub font-medium text-text" lang="en">
                {t.titleEn}
              </span>
              <span className="block truncate text-micro text-text-faint" lang="ja">
                {t.titleJa}
              </span>
            </Link>
            <button
              type="button"
              onClick={() => setDismissed((prev) => new Set(prev).add(t.id))}
              className="shrink-0 rounded-[var(--radius-chip)] px-2 py-1 text-caption text-text-dim hover:bg-surface-3 hover:text-text"
              aria-label={`Dismiss ${t.titleEn}`}
            >
              Dismiss
            </button>
          </div>
        ))}
      </div>
    </Panel>
  );
}
