import Link from "next/link";
import { Panel, InsetPanel } from "@/components/panel/Panel";
import { LeaderboardIcon } from "@/components/shell/NavIcons";
import type { LeaderboardRow } from "@/services/leaderboard/rank";
import type { LeaderboardTab } from "@/server/queries/leaderboard";
import { cn } from "@/lib/utils";

const TABS: { tab: LeaderboardTab; labelEn: string; labelJa: string }[] = [
  { tab: "weekly", labelEn: "Weekly XP", labelJa: "週間XP" },
  { tab: "total", labelEn: "All-Time XP", labelJa: "累計XP" },
  { tab: "streak", labelEn: "Streak", labelJa: "連続記録" },
];

const UNIT_SUFFIX: Record<LeaderboardTab, string> = {
  weekly: "XP",
  total: "XP",
  streak: "days",
};

export interface LeaderboardCardProps {
  activeTab: LeaderboardTab;
  rows: LeaderboardRow[];
  viewerId: string;
  weekStart: Date;
  className?: string;
}

/// Ranked list of all 4 accounts for one metric at a time, switched via
/// `?tab=`. Names and avatars are always visible — this is a shared
/// household leaderboard, not an anonymized one.
export function LeaderboardCard({ activeTab, rows, viewerId, weekStart, className }: LeaderboardCardProps) {
  const activeLabel = TABS.find((t) => t.tab === activeTab)!;

  return (
    <Panel
      accent="var(--color-brand)"
      icon={<LeaderboardIcon className="h-4 w-4" />}
      title="Leaderboard"
      titleJa="ランキング"
      className={className}
      action={
        activeTab === "weekly" ? (
          <span lang="en">Week of {weekStart.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" })}</span>
        ) : undefined
      }
    >
      <div className="flex flex-col gap-3">
        <div className="flex gap-1 rounded-[var(--radius-chip)] border border-line bg-surface-2 p-1">
          {TABS.map(({ tab, labelEn, labelJa }) => (
            <Link
              key={tab}
              href={`/leaderboard?tab=${tab}`}
              className={cn(
                "flex flex-1 flex-col items-center rounded-[calc(var(--radius-chip)-2px)] px-2 py-1.5 text-center leading-tight transition-colors duration-[var(--duration-fast)]",
                tab === activeTab ? "bg-surface text-text shadow-sm" : "text-text-dim hover:text-text",
              )}
              aria-current={tab === activeTab ? "page" : undefined}
            >
              <span className="text-caption font-medium" lang="en">
                {labelEn}
              </span>
              <span className="text-micro text-text-faint" lang="ja">
                {labelJa}
              </span>
            </Link>
          ))}
        </div>

        {rows.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-1 rounded-[var(--radius-tile)] border border-dashed border-line p-8">
            <span className="text-body text-text-dim" lang="en">
              No accounts yet.
            </span>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {rows.map((row) => (
              <LeaderboardRowItem key={row.userId} row={row} isViewer={row.userId === viewerId} unit={UNIT_SUFFIX[activeTab]} />
            ))}
          </div>
        )}
      </div>

      <span className="sr-only" lang="en">
        {activeLabel.labelEn}
      </span>
    </Panel>
  );
}

function LeaderboardRowItem({ row, isViewer, unit }: { row: LeaderboardRow; isViewer: boolean; unit: string }) {
  return (
    <InsetPanel
      className={cn(
        "flex items-center gap-3",
        isViewer && "border-brand/50 bg-[color-mix(in_oklch,var(--color-brand)_10%,var(--color-surface-2))]",
      )}
    >
      <span
        className={cn(
          "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-caption font-semibold tabular-nums",
          row.rank === 1 ? "bg-warn/20 text-warn" : "bg-surface-3 text-text-dim",
        )}
        aria-hidden
      >
        {row.rank}
      </span>
      <div
        className="h-9 w-9 shrink-0 rounded-full border border-line-strong bg-surface-3 bg-cover bg-center"
        style={row.avatarUrl ? { backgroundImage: `url(${row.avatarUrl})` } : undefined}
        aria-hidden
      />
      <div className="flex min-w-0 flex-1 flex-col leading-tight">
        <span className="truncate text-sub font-medium text-text">
          {row.displayName}
          {isViewer && (
            <span className="ml-1.5 text-micro text-text-faint" lang="en">
              (you)
            </span>
          )}
        </span>
      </div>
      <span className="shrink-0 text-sub font-semibold tabular-nums text-text" lang="en">
        {row.value.toLocaleString()} <span className="text-micro font-normal text-text-faint">{unit}</span>
      </span>
    </InsetPanel>
  );
}
