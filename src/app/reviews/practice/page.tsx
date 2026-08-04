import Link from "next/link";
import { getUnrankedOptions } from "@/server/queries/reviews";
import { UnrankedPicker } from "@/components/reviews/UnrankedPicker";

import { APP_USER_ID } from "@/lib/appUser";

export default async function UnrankedPracticePage() {
  const options = await getUnrankedOptions(APP_USER_ID);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="text-h1 font-semibold text-text">
          <span lang="en">Practice</span> <span lang="ja" className="text-text-muted">自主練</span>
        </h1>
        <Link href="/reviews" className="text-body font-medium text-brand-text hover:underline">
          Ranked reviews
        </Link>
      </div>
      <p className="text-body text-text-dim">
        Drill anything you&apos;ve unlocked, whenever you like. Unranked practice earns no XP or mastery and never
        changes an item&apos;s SRS stage, so nothing here can help or hurt your progress.
      </p>
      <UnrankedPicker options={options} />
    </div>
  );
}
