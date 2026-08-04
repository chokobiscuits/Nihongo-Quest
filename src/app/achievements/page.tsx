import { getAchievements } from "@/server/queries/achievements";
import { Panel } from "@/components/panel/Panel";
import { AchievementRow } from "@/components/achievements/AchievementRow";

export default async function AchievementsPage() {
  const { unlocked, locked } = await getAchievements();

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-h1 font-semibold text-text">
        <span lang="en">Achievements</span> <span lang="ja" className="text-text-muted">実績</span>
      </h1>
      <p className="text-body text-text-dim" lang="en">
        {unlocked.length} of {unlocked.length + locked.length} unlocked
      </p>

      <Panel accent="var(--color-rank-gold)" title="Unlocked" titleJa="達成済み">
        {unlocked.length === 0 ? (
          <p className="py-2 text-caption text-text-faint" lang="en">
            None yet, every row below is reachable, with real progress tracked toward it.
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {unlocked.map((row) => (
              <AchievementRow key={row.definition.id} row={row} />
            ))}
          </div>
        )}
      </Panel>

      <Panel accent="var(--color-text-faint)" title="Locked" titleJa="未達成">
        <div className="flex flex-col gap-2">
          {locked.map((row) => (
            <AchievementRow key={row.definition.id} row={row} />
          ))}
        </div>
      </Panel>
    </div>
  );
}
