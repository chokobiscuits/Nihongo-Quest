"use client";

import { usePathname } from "next/navigation";
import { SidebarNav } from "./SidebarNav";
import { BottomTabBar } from "./BottomTabBar";
import type { Rank } from "@/services/xp/rank";

// Placeholder user until profile data is wired up in a later pass.
const PLACEHOLDER_USER = {
  name: "Learner",
  masteryLabel: "Level 1",
  rank: { tier: "IRON", division: 4 } satisfies Rank,
};

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="flex min-h-full flex-1">
      <SidebarNav user={PLACEHOLDER_USER} className="md:sticky md:top-0 md:h-dvh" />

      <div className="flex min-w-0 flex-1 justify-center">
        <main className="w-full min-w-0 max-w-[1120px] px-4 py-6 pb-[calc(56px+env(safe-area-inset-bottom)+16px)] md:pb-6 lg:px-6">
          {children}
        </main>

        <aside
          className="hidden xl:block w-[320px] shrink-0 border-l border-line bg-surface sticky top-0 h-dvh overflow-y-auto p-4"
          aria-label="Right rail"
        />
      </div>

      <BottomTabBar activeHref={pathname ?? undefined} />
    </div>
  );
}
