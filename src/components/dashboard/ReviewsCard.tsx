import Link from "next/link";
import { Panel, InsetPanel } from "@/components/panel/Panel";
import { ProgressRing } from "@/components/stats/ProgressRing";
import type { DashboardReviewTypeCount } from "@/server/queries/dashboard";
import { SUBJECT_THEME } from "@/components/subject/theme";
import { SubjectType } from "@/generated/prisma/enums";

export interface ReviewsCardProps {
  reviewsDue: number;
  byType: DashboardReviewTypeCount[];
  className?: string;
}

/// §15 Review widget. Populated: donut + count + per-type legend + "Start
/// Reviews". Empty (0 due): success-tinted checkmark, "No reviews due", and
/// the button becomes "Start Lessons" routing to /lessons instead.
export function ReviewsCard({ reviewsDue, byType, className }: ReviewsCardProps) {
  const hasReviews = reviewsDue > 0;

  return (
    <Panel accent="var(--color-success)" title="Reviews" titleJa="復習" className={className}>
      <div className="flex flex-col items-center gap-4">
        {hasReviews ? (
          <ProgressRing
            segments={byType.map((row) => ({
              value: row.count,
              color: `var(--color-${accentKeyFor(row.type)})`,
              label: row.labelEn,
            }))}
            size={120}
            strokeWidth={12}
            centerLabel={String(reviewsDue)}
            centerSubLabel="items due"
          />
        ) : (
          <div className="flex flex-col items-center gap-2 py-4">
            <span
              aria-hidden
              className="flex h-16 w-16 items-center justify-center rounded-full text-h1"
              style={{ background: "color-mix(in oklch, var(--color-success) 18%, transparent)", color: "var(--color-success)" }}
            >
              ✓
            </span>
            <span className="text-body font-medium text-text" lang="en">
              No reviews due
            </span>
          </div>
        )}

        {hasReviews && (
          <InsetPanel className="flex w-full flex-col gap-2">
            {byType
              .filter((row) => row.count > 0)
              .map((row) => (
                <div key={row.type} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span
                      aria-hidden
                      className="h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ background: `var(--color-${accentKeyFor(row.type)})` }}
                    />
                    <span className="text-caption text-text-muted" lang="en">
                      {row.labelEn}
                    </span>
                  </div>
                  <span className="text-caption font-medium text-text" lang="en">
                    {row.count}
                  </span>
                </div>
              ))}
          </InsetPanel>
        )}

        <Link
          href={hasReviews ? "/reviews" : "/lessons"}
          className="inline-flex h-10 w-full items-center justify-center rounded-[var(--radius-chip)] bg-brand text-sub font-semibold text-text hover:bg-brand-hover transition-colors duration-[var(--duration-fast)]"
        >
          {hasReviews ? "Start Reviews" : "Start Lessons"}
        </Link>
      </div>
    </Panel>
  );
}

function accentKeyFor(type: SubjectType): string {
  return SUBJECT_THEME[type].base.replace("var(--color-", "").replace(")", "");
}
