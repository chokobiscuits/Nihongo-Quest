import { getLeaderboard, type LeaderboardTab } from "@/server/queries/leaderboard";
import { LeaderboardCard } from "@/components/leaderboard/LeaderboardCard";
import { getCurrentUserId } from "@/lib/session";

const VALID_TABS: LeaderboardTab[] = ["weekly", "total", "streak"];

export default async function LeaderboardPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const userId = await getCurrentUserId();
  const { tab } = await searchParams;
  const activeTab: LeaderboardTab = VALID_TABS.includes(tab as LeaderboardTab) ? (tab as LeaderboardTab) : "weekly";

  const leaderboard = await getLeaderboard(userId);

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-h1 font-semibold text-text">
        <span lang="en">Leaderboard</span> <span lang="ja" className="text-text-muted">ランキング</span>
      </h1>

      <LeaderboardCard
        activeTab={activeTab}
        rows={leaderboard[activeTab]}
        viewerId={userId}
        weekStart={leaderboard.weekStart}
        className="max-w-xl"
      />
    </div>
  );
}
