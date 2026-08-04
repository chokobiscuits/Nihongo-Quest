"use client";

import { usePathname } from "next/navigation";
import { SidebarNav, type SidebarNavUser, type SidebarTypeUnlockStatuses } from "./SidebarNav";
import { BottomTabBar } from "./BottomTabBar";

export interface AppShellProps {
  user?: SidebarNavUser;
  typeUnlockStatuses?: SidebarTypeUnlockStatuses;
  children: React.ReactNode;
}

// Fallback user shown before profile data is available (e.g. route segments
// that don't pass `user`, or during a loading boundary).
const PLACEHOLDER_USER: SidebarNavUser = {
  name: "Learner",
  masteryTier: { name: "Unranked", level: 0, colorToken: "--color-text-faint" },
  rank: { tier: "IRON", division: 4 },
};

export function AppShell({ user, typeUnlockStatuses, children }: AppShellProps) {
  const pathname = usePathname();

  return (
    <div className="flex min-h-full flex-1">
      <SidebarNav
        user={user ?? PLACEHOLDER_USER}
        typeUnlockStatuses={typeUnlockStatuses}
        className="md:sticky md:top-0 md:h-dvh"
      />

      <div className="flex min-w-0 flex-1 justify-center">
        <main className="w-full min-w-0 max-w-[1440px] px-4 py-6 pb-[calc(56px+env(safe-area-inset-bottom)+16px)] md:pb-6 lg:px-6">
          {children}
        </main>
      </div>

      <BottomTabBar activeHref={pathname ?? undefined} />
    </div>
  );
}
