import { getDashboard } from "@/server/queries/dashboard";
import { getProgress } from "@/server/queries/progress";
import { redirect } from "next/navigation";
import { getFirstRunTutorial, getTriggeredOptionalTutorials } from "@/server/queries/tutorials";
import { TutorialTipsCard } from "@/components/dashboard/TutorialTipsCard";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { DayStreakCard } from "@/components/dashboard/DayStreakCard";
import { ContinueLearningSection } from "@/components/dashboard/ContinueLearningSection";
import { ProgressOverviewCard } from "@/components/dashboard/ProgressOverviewCard";
import { JlptProgressCard } from "@/components/dashboard/JlptProgressCard";
import type { JlptLevel } from "@/components/stats/JlptStepper";
import { ReviewsCard } from "@/components/dashboard/ReviewsCard";
import { AchievementsCard } from "@/components/dashboard/AchievementsCard";
import { RankLevelCard } from "@/components/rank/RankLevelCard";

import { APP_USER_ID } from "@/lib/appUser";

const JLPT_LEVELS: JlptLevel[] = ["N5", "N4", "N3", "N2", "N1"];

/// The dashboard's JLPT card was hardcoded to N5 at 0%. Derive it from the
/// same rows /progress uses: your current band is the lowest one you have
/// not finished, and the bar is your progress through it. A level counts as
/// complete at 90%, matching the curriculum advancement rule elsewhere.
function jlptCardProps(rows: { level: number; passed: number; total: number }[]) {
  const byLevel = new Map(rows.map((r) => [r.level, r]));
  const completed: JlptLevel[] = [];
  let current: JlptLevel = "N5";
  let fraction = 0;

  // rows use 5..1 for N5..N1, so walk them easiest-first.
  for (const n of [5, 4, 3, 2, 1]) {
    const row = byLevel.get(n);
    const label = `N${n}` as JlptLevel;
    const done = row && row.total > 0 ? row.passed / row.total : 0;
    if (done >= 0.9) {
      completed.push(label);
      continue;
    }
    current = label;
    fraction = done;
    break;
  }
  // Every band complete: sit on N1 at full progress rather than falling off
  // the end of the stepper.
  if (completed.length === JLPT_LEVELS.length) {
    current = "N1";
    fraction = 1;
  }
  return { currentLevel: current, completedLevels: completed, progressFraction: fraction };
}

export default async function HomePage() {
  // A brand-new or freshly reset account gets sent to onboarding instead of
  // a dashboard of zeros. On a DB failure fall through to the dashboard —
  // which will fail on its own terms — rather than bouncing the user to a
  // tutorial route that cannot load either. redirect() throws a control-flow
  // signal, so it must sit outside the catch.
  const firstRun = await getFirstRunTutorial(APP_USER_ID).catch(() => null);
  if (firstRun) redirect(`/tutorials/${firstRun.slug}?welcome=1`);

  const [dashboard, tutorialTips, progress] = await Promise.all([
    getDashboard(APP_USER_ID),
    getTriggeredOptionalTutorials(APP_USER_ID),
    getProgress(APP_USER_ID),
  ]);
  const jlpt = jlptCardProps(progress.jlpt);

  return (
    <div className="flex flex-col gap-4 xl:grid xl:grid-cols-[minmax(0,1fr)_320px] xl:items-start xl:gap-4">
      {/* Main column */}
      <div className="flex min-w-0 flex-col gap-4">
        <DashboardHeader
          displayName={dashboard.displayName}
          avatarUrl={dashboard.avatarUrl}
          accountLevel={dashboard.accountLevel}
          currentStreak={dashboard.currentStreak}
          masteryTier={dashboard.masteryTier}
          rank={dashboard.rank}
          xpIntoCurrentLevel={dashboard.xpIntoCurrentLevel}
          xpForCurrentLevel={dashboard.xpForCurrentLevel}
        />

        {/* Right-rail cards move into a 4-up row below xl */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:hidden">
          <DayStreakCard currentStreak={dashboard.currentStreak} days={dashboard.streakDays} />
          <RankLevelCard rank={dashboard.rank} lp={dashboard.lp} />
          <ProgressOverviewCard rows={dashboard.progress} />
          <JlptProgressCard
            currentLevel={jlpt.currentLevel}
            completedLevels={jlpt.completedLevels}
            progressFraction={jlpt.progressFraction}
          />
        </div>

        <TutorialTipsCard tutorials={tutorialTips} />

        <ContinueLearningSection cards={dashboard.continueCards} />

        <ReviewsCard reviewsDue={dashboard.reviewsDue} byType={dashboard.reviewsByType} />

        <AchievementsCard achievements={dashboard.achievements} />
      </div>

      {/* Sticky right rail, ≥1280px only */}
      <div className="hidden xl:flex xl:flex-col xl:gap-4 xl:sticky xl:top-6">
        <DayStreakCard currentStreak={dashboard.currentStreak} days={dashboard.streakDays} />
        <RankLevelCard rank={dashboard.rank} lp={dashboard.lp} />
        <ProgressOverviewCard rows={dashboard.progress} />
        <JlptProgressCard
          currentLevel={jlpt.currentLevel}
          completedLevels={jlpt.completedLevels}
          progressFraction={jlpt.progressFraction}
        />
      </div>

    </div>
  );
}
