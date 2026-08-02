import Link from "next/link";
import { getOrCreateProfile } from "@/server/queries/profile";
import { RankLevelCard } from "@/components/rank/RankLevelCard";
import type { RankTier } from "@/services/xp/rank";
import { totalXpToReach } from "@/services/xp/curve";

const APP_USER_ID = process.env.APP_USER_ID ?? "local-user";

// TEMPORARY DEV SCAFFOLDING — fidelity-probe only. Lets the Rank & Level
// card be previewed at tiers other than the real account's (Iron IV) via
// ?rank=<tier><division>, e.g. ?rank=gold2, ?rank=diamond3, or ?rank=challenger.
// Remove this block once the card ships and the dashboard is built out.
const PREVIEW_PRESETS: Record<string, { level: number; totalXp: number }> = {
  iron4: levelPreset(1),
  gold2: levelPreset(29),
  diamond3: levelPreset(55),
  challenger: levelPreset(100),
};

function levelPreset(level: number) {
  return { level, totalXp: totalXpToReach(level) };
}

const DEV_PREVIEW_TIERS: RankTier[] = ["IRON", "GOLD", "DIAMOND", "CHALLENGER"];

function devPreviewHref(key: string) {
  return `/?rank=${key}`;
}

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ rank?: string }>;
}) {
  const profile = await getOrCreateProfile(APP_USER_ID);
  const { rank: previewKey } = await searchParams;

  const preview = previewKey ? PREVIEW_PRESETS[previewKey] : undefined;
  const accountLevel = preview?.level ?? profile.accountLevel;
  const totalXp = preview?.totalXp ?? Number(profile.totalXp);

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-h1 font-semibold text-text">
        <span lang="en">Nihon Quest</span> <span lang="ja" className="text-text-muted">日本クエスト</span>
      </h1>

      {/* TEMPORARY: tier preview row, dev-only scaffolding for the fidelity
          probe. Delete alongside PREVIEW_PRESETS above once retired. */}
      <div className="flex flex-wrap items-center gap-2 rounded-[var(--radius-tile)] border border-line bg-surface-2 p-2">
        <span className="text-micro text-text-faint">Preview tier:</span>
        <Link
          href="/"
          className="rounded-[var(--radius-chip)] border border-line px-2.5 py-1 text-caption text-text-dim hover:border-line-strong hover:text-text"
        >
          Real (Iron IV)
        </Link>
        {DEV_PREVIEW_TIERS.map((tier) => {
          const key = tier === "CHALLENGER" ? "challenger" : `${tier.toLowerCase()}${tier === "IRON" ? 4 : tier === "GOLD" ? 2 : 3}`;
          return (
            <Link
              key={tier}
              href={devPreviewHref(key)}
              className="rounded-[var(--radius-chip)] border border-line px-2.5 py-1 text-caption text-text-dim hover:border-line-strong hover:text-text"
            >
              {tier}
            </Link>
          );
        })}
      </div>

      <div className="max-w-[360px]">
        <RankLevelCard accountLevel={accountLevel} totalXp={totalXp} />
      </div>
    </div>
  );
}
