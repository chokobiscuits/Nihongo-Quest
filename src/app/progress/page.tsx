import { getProgress } from "@/server/queries/progress";
import { OverallProgressCard } from "@/components/progress/OverallProgressCard";
import { SrsDistributionCard } from "@/components/progress/SrsDistributionCard";
import { JlptBreakdownCard } from "@/components/progress/JlptBreakdownCard";
import { LevelProgressCard } from "@/components/progress/LevelProgressCard";
import { ActivityHeatmap } from "@/components/progress/ActivityHeatmap";
import { AccountSummaryCard } from "@/components/progress/AccountSummaryCard";

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
        <JlptBreakdownCard rows={progress.jlpt} note={progress.jlptTaggedNote} />
        <LevelProgressCard level={progress.level} />
        <ActivityHeatmap days={progress.activity} className="xl:col-span-2" />
        <AccountSummaryCard account={progress.account} className="xl:col-span-2" />
      </div>
    </div>
  );
}
