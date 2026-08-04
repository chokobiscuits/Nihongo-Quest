import Link from "next/link";
import { cn } from "@/lib/utils";

interface TabItem {
  href: string;
  labelJa: string;
  icon: string;
}

const TABS: TabItem[] = [
  { href: "/", labelJa: "ホーム", icon: "◆" },
  // Lessons sits beside Reviews: on mobile this and the dashboard cards are
  // the only ways to reach /lessons at all.
  { href: "/lessons", labelJa: "レッスン", icon: "学" },
  { href: "/reviews", labelJa: "レビュー", icon: "循" },
  { href: "/progress", labelJa: "進捗", icon: "growth" },
  { href: "/settings", labelJa: "設定", icon: "設" },
];

export interface BottomTabBarProps {
  activeHref?: string;
  className?: string;
}

/// Fixed bottom tab bar shown below the md breakpoint. Height is 56px plus
/// the safe-area inset so it clears home-indicator gesture areas on iOS.
export function BottomTabBar({ activeHref, className }: BottomTabBarProps) {
  return (
    <nav
      className={cn(
        "md:hidden fixed inset-x-0 bottom-0 z-40 flex border-t border-line bg-surface",
        className,
      )}
      style={{
        height: "calc(56px + env(safe-area-inset-bottom))",
        paddingBottom: "env(safe-area-inset-bottom)",
      }}
      aria-label="Primary"
    >
      {TABS.map((tab) => {
        const active = tab.href === activeHref;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={cn(
              "flex flex-1 flex-col items-center justify-center gap-0.5 text-micro",
              active ? "text-brand-text" : "text-text-faint",
            )}
            aria-current={active ? "page" : undefined}
          >
            <span aria-hidden className="text-h3 leading-none">
              {tab.icon}
            </span>
            <span lang="ja">{tab.labelJa}</span>
          </Link>
        );
      })}
    </nav>
  );
}
