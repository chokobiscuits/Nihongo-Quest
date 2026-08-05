import { describe, expect, it } from "vitest";
import { buildForecast } from "./forecast";

const NOW = new Date("2026-08-05T12:00:00.000Z");
const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

function hoursFromNow(hours: number): Date {
  return new Date(NOW.getTime() + hours * HOUR);
}

describe("buildForecast", () => {
  it("returns all-zero buckets for an empty input, not throwing", () => {
    const buckets = buildForecast({ dueAts: [], now: NOW });
    expect(buckets.length).toBeGreaterThan(0);
    for (const bucket of buckets) {
      expect(bucket.count).toBe(0);
      expect(bucket.cumulative).toBe(0);
    }
  });

  it("puts already-overdue items in the first bucket", () => {
    const overdue = hoursFromNow(-100);
    const buckets = buildForecast({ dueAts: [overdue], now: NOW });
    expect(buckets[0].count).toBe(1);
    expect(buckets[0].labelEn).toBe("Next 4 hours");
    expect(buckets.slice(1).every((b) => b.count === 0)).toBe(true);
  });

  it("an item due at exactly now lands in the first bucket", () => {
    const buckets = buildForecast({ dueAts: [NOW], now: NOW });
    expect(buckets[0].count).toBe(1);
  });

  it("an item due at exactly the 4h boundary goes in the 4h bucket, not the first", () => {
    const atFourHours = hoursFromNow(4);
    const buckets = buildForecast({ dueAts: [atFourHours], now: NOW });
    // Bucket 0 is [0h, 4h), bucket 1 is [4h, 8h) — the boundary belongs to
    // the bucket it starts, per buildForecast's doc comment.
    expect(buckets[0].count).toBe(0);
    expect(buckets[1].count).toBe(1);
    expect(buckets[1].labelEn).toBe("Next 8 hours");
  });

  it("an item due just before the 4h boundary stays in the first bucket", () => {
    const justUnderFourHours = hoursFromNow(3.99);
    const buckets = buildForecast({ dueAts: [justUnderFourHours], now: NOW });
    expect(buckets[0].count).toBe(1);
    expect(buckets[1].count).toBe(0);
  });

  it("buckets an item due within the 'Tomorrow' window ([8h, 24h)) correctly", () => {
    const withinTomorrow = hoursFromNow(12);
    const buckets = buildForecast({ dueAts: [withinTomorrow], now: NOW });
    const tomorrowBucket = buckets.find((b) => b.labelEn === "Tomorrow");
    expect(tomorrowBucket?.count).toBe(1);
  });

  it("an item due at exactly 24h starts the 'In 2 days' bucket, not 'Tomorrow'", () => {
    const atTwentyFourHours = hoursFromNow(24);
    const buckets = buildForecast({ dueAts: [atTwentyFourHours], now: NOW });
    const twoDaysBucket = buckets.find((b) => b.labelEn === "In 2 days");
    expect(twoDaysBucket?.count).toBe(1);
  });

  it("puts far-future items in the final 'later' bucket", () => {
    const farFuture = new Date(NOW.getTime() + 365 * DAY);
    const buckets = buildForecast({ dueAts: [farFuture], now: NOW });
    const last = buckets[buckets.length - 1];
    expect(last.labelEn).toBe("Later");
    expect(last.count).toBe(1);
  });

  it("keeps cumulative totals monotonic and ending at the total count", () => {
    const dueAts = [
      hoursFromNow(-10),
      hoursFromNow(1),
      hoursFromNow(6),
      hoursFromNow(20),
      hoursFromNow(40),
      hoursFromNow(6 * 24),
      hoursFromNow(10 * 24),
      hoursFromNow(25 * 24),
      hoursFromNow(60 * 24),
    ];
    const buckets = buildForecast({ dueAts, now: NOW });

    let prevCumulative = 0;
    for (const bucket of buckets) {
      expect(bucket.cumulative).toBeGreaterThanOrEqual(prevCumulative);
      prevCumulative = bucket.cumulative;
    }
    expect(buckets[buckets.length - 1].cumulative).toBe(dueAts.length);

    const totalCount = buckets.reduce((sum, b) => sum + b.count, 0);
    expect(totalCount).toBe(dueAts.length);
  });
});
