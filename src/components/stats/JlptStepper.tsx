import { cn } from "@/lib/utils";

export type JlptLevel = "N5" | "N4" | "N3" | "N2" | "N1";

const LEVELS: JlptLevel[] = ["N5", "N4", "N3", "N2", "N1"];

export interface JlptStepperProps {
  currentLevel: JlptLevel;
  /// Levels the user has fully completed (rendered as filled/checked steps).
  completedLevels?: JlptLevel[];
  className?: string;
}

/// Horizontal stepper of JLPT levels N5 -> N1, marking completed and current.
export function JlptStepper({ currentLevel, completedLevels = [], className }: JlptStepperProps) {
  return (
    <ol className={cn("flex items-center", className)}>
      {LEVELS.map((level, index) => {
        const completed = completedLevels.includes(level);
        const current = level === currentLevel;
        return (
          <li key={level} className="flex items-center">
            <div
              className={cn(
                "flex h-9 w-9 items-center justify-center rounded-full border text-caption font-semibold",
                completed && "border-success bg-surface-2 text-success",
                current && !completed && "border-brand bg-brand-bg text-brand-text",
                !completed && !current && "border-line bg-surface text-text-faint",
              )}
              aria-current={current ? "step" : undefined}
            >
              <span lang="en">{level}</span>
            </div>
            {index < LEVELS.length - 1 && (
              <div
                className={cn(
                  "h-px w-6",
                  completed ? "bg-success" : "bg-line",
                )}
                aria-hidden
              />
            )}
          </li>
        );
      })}
    </ol>
  );
}
