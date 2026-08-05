import { getProgress } from "@/server/queries/progress";
import { OverallProgressCard } from "@/components/progress/OverallProgressCard";
import { SrsDistributionCard } from "@/components/progress/SrsDistributionCard";
import { JlptBreakdownCard } from "@/components/progress/JlptBreakdownCard";
import { LevelProgressCard } from "@/components/progress/LevelProgressCard";
import { ActivityHeatmap } from "@/components/progress/ActivityHeatmap";
import { AccountSummaryCard } from "@/components/progress/AccountSummaryCard";
import { ReviewForecastCard, MOCK_FORECAST } from "@/components/progress/ReviewForecastCard";
import { ReviewStatsCard, MOCK_REVIEW_STATS } from "@/components/progress/ReviewStatsCard";

export default async function ProgressPage() {
  const progress = await getProgress();

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-h1 font-semibold text-text">
        <span lang="en">Progress</span> <span lang="ja" className="text-text-muted">進捗</span>
      </h1>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <OverallProgressCard rows={progress.overall} />
        <SrsDistributionCard rows={progress.srsDistribution} total={progress.srsDistributionTotal} />
        {/*
          MOCKUP: these two render hardcoded sample data, not live queries.
          getReviewForecast / getReviewStats exist in server/queries/progress.ts
          and their pure services are tested, but there is not yet enough
          ReviewLog history for either card to show anything. Swap MOCK_* for
          the real query results and drop isMock to go live -- both components
          already take the real service shapes.
        */}
        <ReviewForecastCard buckets={MOCK_FORECAST} isMock />
        <ReviewStatsCard stats={MOCK_REVIEW_STATS} isMock />
        <JlptBreakdownCard rows={progress.jlpt} note={progress.jlptTaggedNote} />
        <LevelProgressCard level={progress.level} />
        <ActivityHeatmap days={progress.activity} className="xl:col-span-2" />
        <AccountSummaryCard account={progress.account} className="xl:col-span-2" />
      </div>
    </div>
  );
}
