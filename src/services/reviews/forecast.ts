// Pure review-forecast bucketing. Given the dueAt of every started,
// non-burned UserSubject, this groups them into fixed time buckets so the
// UI can answer "how many reviews are coming, and when" without modeling
// user behavior — no "if you do N reviews/day" projection, just what is
// already scheduled.

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

/// Bucket boundaries, in hours from `now`, in ascending order. Each entry is
/// the *start* of a bucket; the bucket runs up to (but not including) the
/// next entry's start. The final bucket ("later") has no upper bound.
const BUCKET_OFFSETS_HOURS = [0, 4, 8, 24, 48, 7 * 24, 14 * 24, 30 * 24];

// One label per entry in BUCKET_OFFSETS_HOURS, in the same order: index i's
// label describes the bucket that starts at BUCKET_OFFSETS_HOURS[i].
const BUCKET_LABELS: readonly string[] = [
  "Next 4 hours", // [0h, 4h)
  "Next 8 hours", // [4h, 8h)
  "Tomorrow", // [8h, 24h)
  "In 2 days", // [24h, 48h)
  "In a week", // [48h, 7d)
  "In 2 weeks", // [7d, 14d)
  "In a month", // [14d, 30d)
  "Later", // [30d, infinity)
];

export interface ForecastBucket {
  /// Hours from "now" this bucket starts.
  offsetHours: number;
  labelEn: string; // e.g. "Next 4 hours", "Tomorrow", "In 3 days"
  count: number; // items coming due in this bucket
  cumulative: number; // running total including this bucket
}

export interface ForecastInput {
  /// One entry per started, non-burned UserSubject: when it is next due.
  dueAts: Date[];
  now: Date;
}

/// Buckets a set of due dates into fixed forecast windows.
///
/// Bucketing convention: a bucket covers [offsetHours, nextOffsetHours) from
/// `now` — its start is inclusive, its end is exclusive. An item due at
/// exactly the 4-hour mark falls into the 4h bucket (["4h", "8h")), not the
/// preceding one, since the 4h bucket's lower bound includes it. Items
/// already overdue (dueAt <= now) fall into the first bucket alongside items
/// due within the next 4 hours — there is no separate "overdue" bucket.
///
/// Tolerates an empty `dueAts` array and returns every bucket at zero rather
/// than throwing.
export function buildForecast(input: ForecastInput): ForecastBucket[] {
  const { dueAts, now } = input;
  const nowMs = now.getTime();

  const counts = new Array(BUCKET_OFFSETS_HOURS.length).fill(0);

  for (const dueAt of dueAts) {
    const hoursUntilDue = (dueAt.getTime() - nowMs) / HOUR;
    let bucketIndex = BUCKET_OFFSETS_HOURS.length - 1;
    for (let i = 0; i < BUCKET_OFFSETS_HOURS.length; i++) {
      const nextOffset = BUCKET_OFFSETS_HOURS[i + 1];
      if (nextOffset === undefined || hoursUntilDue < nextOffset) {
        bucketIndex = i;
        break;
      }
    }
    counts[bucketIndex] += 1;
  }

  let cumulative = 0;
  return BUCKET_OFFSETS_HOURS.map((offsetHours, i) => {
    cumulative += counts[i];
    return {
      offsetHours,
      labelEn: BUCKET_LABELS[i],
      count: counts[i],
      cumulative,
    };
  });
}
