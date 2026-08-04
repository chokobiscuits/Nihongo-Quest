import Link from "next/link";
import { getReviewQueue } from "@/server/queries/reviews";
import { ReviewRunner } from "@/components/reviews/ReviewRunner";

import { APP_USER_ID } from "@/lib/appUser";

/// Formats the wait until the next review comes due, e.g. "3h 20m" or
/// "2d 4h". Rounds down to the shown unit; anything under a minute reads as
/// "less than a minute".
function formatWait(from: Date, to: Date): string {
  const ms = to.getTime() - from.getTime();
  if (ms <= 0) return "now";
  const minutes = Math.floor(ms / 60000);
  if (minutes < 1) return "less than a minute";
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    const rem = minutes % 60;
    return rem > 0 ? `${hours}h ${rem}m` : `${hours}h`;
  }
  const days = Math.floor(hours / 24);
  const remHours = hours % 24;
  return remHours > 0 ? `${days}d ${remHours}h` : `${days}d`;
}

export default async function ReviewsPage() {
  const now = new Date();
  const { items, nextDueAt } = await getReviewQueue(APP_USER_ID, now);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="text-h1 font-semibold text-text">
          <span lang="en">Reviews</span> <span lang="ja" className="text-text-muted">復習</span>
        </h1>
        <Link href="/reviews/practice" className="text-body font-medium text-brand-text hover:underline">
          Unranked practice
        </Link>
      </div>

      {items.length === 0 ? (
        <div className="flex flex-col gap-3 rounded-[var(--radius-card)] border border-line bg-surface p-6">
          <p className="text-body font-medium text-text">Nothing due right now.</p>
          <p className="text-caption text-text-dim">
            {nextDueAt
              ? `Next review in ${formatWait(now, nextDueAt)}.`
              : "Learn something new to build up your review queue."}
          </p>
          <div className="mt-1 flex flex-wrap gap-2">
            <Link
              href="/reviews/practice"
              className="inline-flex h-9 items-center rounded-[var(--radius-chip)] bg-brand-button px-4 text-body font-medium text-on-brand"
            >
              Practise unranked
            </Link>
            <Link
              href="/lessons"
              className="inline-flex h-9 items-center rounded-[var(--radius-chip)] border border-line px-4 text-body font-medium text-text-dim"
            >
              Go to Lessons
            </Link>
          </div>
        </div>
      ) : (
        <ReviewRunner items={items} />
      )}
    </div>
  );
}
