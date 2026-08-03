import { Suspense } from "react";
import { getDashboard } from "@/server/queries/dashboard";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { DayStreakCard } from "@/components/dashboard/DayStreakCard";
import { ContinueLearningSection } from "@/components/dashboard/ContinueLearningSection";
import { ProgressOverviewCard } from "@/components/dashboard/ProgressOverviewCard";
import { JlptProgressCard } from "@/components/dashboard/JlptProgressCard";
import { ReviewsCard } from "@/components/dashboard/ReviewsCard";
import { AchievementsCard } from "@/components/dashboard/AchievementsCard";
import { RankLevelCard } from "@/components/rank/RankLevelCard";
import { InfiniteMasteryCard } from "@/components/dashboard/InfiniteMasteryCard";
import { CelebrationDevTrigger } from "@/components/celebration/CelebrationDevTrigger";

const APP_USER_ID = process.env.APP_USER_ID ?? "local-user";

export default async function HomePage() {
  const dashboard = await getDashboard(APP_USER_ID);

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
          <RankLevelCard accountLevel={dashboard.accountLevel} totalXp={dashboard.totalXp} />
          <ProgressOverviewCard rows={dashboard.progress} />
          <JlptProgressCard currentLevel="N5" progressFraction={0} />
        </div>

        <ContinueLearningSection cards={dashboard.continueCards} />

        <InfiniteMasteryCard />

        <ReviewsCard reviewsDue={dashboard.reviewsDue} byType={dashboard.reviewsByType} />

        <AchievementsCard achievements={dashboard.achievements} />
      </div>

      {/* Sticky right rail, ≥1280px only */}
      <div className="hidden xl:flex xl:flex-col xl:gap-4 xl:sticky xl:top-6">
        <DayStreakCard currentStreak={dashboard.currentStreak} days={dashboard.streakDays} />
        <RankLevelCard accountLevel={dashboard.accountLevel} totalXp={dashboard.totalXp} />
        <ProgressOverviewCard rows={dashboard.progress} />
        <JlptProgressCard currentLevel="N5" progressFraction={0} />
      </div>

      {/* DEV-ONLY SCAFFOLDING — remove before ship. Lets reviewers preview
          celebration modals via ?celebrate=levelup|promotion|newrank since a
          real level-1 account can't reach any of these events organically. */}
      <Suspense fallback={null}>
        <CelebrationDevTrigger />
      </Suspense>
    </div>
  );
}
