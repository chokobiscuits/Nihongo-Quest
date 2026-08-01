import { stageInfo } from "@/services/srs/stages";
import { cn } from "@/lib/utils";

export interface SrsStageChipProps {
  stage: number;
  className?: string;
}

// Ramp colors by SRS phase. Apprentice (stages 1-4) pink, Guru (5-6) violet,
// Master (7) blue, Enlightened (8) cyan, Burned (9) faint/muted.
function rampVars(stage: number): { bg: string; text: string } {
  if (stage >= 9) return { bg: "color-mix(in oklch, var(--color-text-faint) 16%, transparent)", text: "var(--color-text-faint)" };
  if (stage === 8) return { bg: "#0f2b3d", text: "#7dd3fc" };
  if (stage === 7) return { bg: "#0f2440", text: "#93cdfa" };
  if (stage >= 5) return { bg: "#251f3d", text: "#c4b5fd" };
  if (stage >= 1) return { bg: "#3a1626", text: "#f9a8d4" };
  // Stage 0: Lesson, not yet in the SRS ramp.
  return { bg: "var(--color-surface-2)", text: "var(--color-text-dim)" };
}

/// Displays an SRS stage (0-9) using the stage names verbatim from
/// src/services/srs/stages.ts. Colors follow the Apprentice/Guru/Master/
/// Enlightened/Burned ramp.
export function SrsStageChip({ stage, className }: SrsStageChipProps) {
  const info = stageInfo(stage);
  const { bg, text } = rampVars(stage);

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-[var(--radius-chip)] border border-line-strong px-2.5 h-6 text-caption font-medium",
        className,
      )}
      style={{ backgroundColor: bg, color: text }}
      data-stage={stage}
    >
      {info.name}
    </span>
  );
}
