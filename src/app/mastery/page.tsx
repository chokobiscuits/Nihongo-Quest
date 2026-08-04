import { getProgress } from "@/server/queries/progress";
import { Panel } from "@/components/panel/Panel";
import { MasteryTierLadder } from "@/components/mastery/MasteryTierLadder";
import { InfiniteMasteryCard } from "@/components/dashboard/InfiniteMasteryCard";
import { MasteryIcon } from "@/components/shell/NavIcons";

export default async function MasteryPage() {
  const progress = await getProgress();
  const { account } = progress;

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-h1 font-semibold text-text">
        <span lang="en">Mastery</span> <span lang="ja" className="text-text-muted">熟練度</span>
      </h1>

      <Panel accent="var(--color-rank-gold)" icon={<MasteryIcon />} title="Tier Ladder" titleJa="階級">
        <MasteryTierLadder
          currentTier={account.masteryTier}
          xpIntoLevel={account.masteryXpIntoLevel}
          xpForNextLevel={account.masteryXpForNextLevel}
        />
      </Panel>

      <InfiniteMasteryCard />

      <Panel accent="var(--color-brand)" title="How mastery works" titleJa="仕組み">
        <div className="flex flex-col gap-3 text-body text-text-dim">
          <p lang="en">
            Every correct review answer earns mastery XP for that item, weighted by its SRS stage. A
            correct answer at Apprentice I is worth less than one at Enlightened, since higher stages
            are harder to earn and riskier to lose. Mastery XP never decreases: it tracks cumulative
            familiarity with an item, not current recall confidence.
          </p>
          <p lang="en">
            Your account mastery level is the sum of every item&apos;s mastery XP, run through the same
            curve at a wider scale. It is <strong className="text-text">unbounded</strong>: there is no
            maximum level and no cap on how mastered an item, or your whole account, can become.
          </p>
          <p lang="en">
            The rank ladder above (Novice through Proficient, then Expert, Master, Sage) ends at
            Transcendent, but mastery itself keeps climbing past it. Once you reach Transcendent, your
            level number continues rising for as long as you keep reviewing. The ∞ is the point, not a
            wall.
          </p>
        </div>
      </Panel>
    </div>
  );
}
