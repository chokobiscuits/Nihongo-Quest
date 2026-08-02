"use client";

import { Panel } from "@/components/panel/Panel";
import { JlptStepper, type JlptLevel } from "@/components/stats/JlptStepper";
import { useMountedFraction } from "@/hooks/useMountedFraction";

export interface JlptProgressCardProps {
  currentLevel: JlptLevel;
  completedLevels?: JlptLevel[];
  progressFraction: number;
  className?: string;
}

const LEVELS: JlptLevel[] = ["N5", "N4", "N3", "N2", "N1"];

/// §8 JLPT Progress: the shared JlptStepper plus a "Next Target" label and
/// progress bar toward it. New accounts start at N5 with nothing completed.
export function JlptProgressCard({
  currentLevel,
  completedLevels = [],
  progressFraction,
  className,
}: JlptProgressCardProps) {
  const currentIndex = LEVELS.indexOf(currentLevel);
  const nextLevel = LEVELS[currentIndex + 1];
  const sweptFraction = useMountedFraction(progressFraction, 240);

  return (
    <Panel accent="var(--color-vocab)" title="JLPT Progress" titleJa="JLPT進捗" className={className}>
      <div className="flex flex-col gap-4">
        <JlptStepper currentLevel={currentLevel} completedLevels={completedLevels} className="justify-between" />

        <div className="flex flex-col gap-1.5">
          <span className="text-caption text-text-dim" lang="en">
            {nextLevel ? `Next Target: ${nextLevel}` : "Top level reached"}
          </span>
          <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-surface-3">
            <div
              className="progress-sweep h-full rounded-full bg-vocab"
              style={{ width: `${Math.max(sweptFraction * 100, sweptFraction > 0 ? 0 : 1.5)}%` }}
            />
          </div>
        </div>
      </div>
    </Panel>
  );
}
