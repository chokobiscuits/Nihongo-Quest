import Link from "next/link";
import { RankBadge } from "@/components/rank/RankBadge";
import type { Rank } from "@/services/xp/rank";
import { cn } from "@/lib/utils";

interface NavItem {
  href: string;
  labelEn: string;
  labelJa: string;
  icon: string;
}

interface NavGroup {
  caption?: string;
  items: NavItem[];
}

const NAV_GROUPS: NavGroup[] = [
  {
    items: [{ href: "/", labelEn: "Dashboard", labelJa: "ダッシュボード", icon: "◆" }],
  },
  {
    caption: "Learn",
    items: [
      { href: "/subjects/RADICAL", labelEn: "Radicals", labelJa: "部首", icon: "⼀" },
      { href: "/subjects/KANJI", labelEn: "Kanji", labelJa: "漢字", icon: "字" },
      { href: "/subjects/VOCAB", labelEn: "Vocabulary", labelJa: "単語", icon: "語" },
      { href: "/subjects/GRAMMAR", labelEn: "Grammar", labelJa: "文法", icon: "法" },
      { href: "/subjects/SENTENCE", labelEn: "Sentences", labelJa: "例文", icon: "文" },
      { href: "/subjects/READING", labelEn: "Text Readings", labelJa: "読解", icon: "読" },
    ],
  },
  {
    caption: "Practice",
    items: [
      { href: "/reviews", labelEn: "Reviews", labelJa: "復習", icon: "循" },
      { href: "/exams", labelEn: "Exams", labelJa: "試験", icon: "験" },
    ],
  },
  {
    items: [
      { href: "/progress", labelEn: "Progress", labelJa: "進捗", icon: "growth" },
      { href: "/achievements", labelEn: "Achievements", labelJa: "実績", icon: "賞" },
      { href: "/settings", labelEn: "Settings", labelJa: "設定", icon: "設" },
    ],
  },
];

export interface SidebarNavUser {
  name: string;
  avatarUrl?: string;
  masteryLabel: string;
  rank: Rank;
}

export interface SidebarNavProps {
  user: SidebarNavUser;
  className?: string;
}

/// Primary navigation. Full 240px sidebar at lg+ (1024px), 72px icon rail
/// with tooltips at md (768-1023px), hidden entirely below md (BottomTabBar
/// takes over). The collapsed/expanded states are pure CSS breakpoints so
/// there is no layout flash on resize.
export function SidebarNav({ user, className }: SidebarNavProps) {
  return (
    <nav
      className={cn(
        "hidden md:flex flex-col justify-between border-r border-line bg-surface w-[72px] lg:w-[240px]",
        className,
      )}
      aria-label="Primary"
    >
      <div className="flex flex-col gap-4 overflow-y-auto py-4">
        {NAV_GROUPS.map((group, index) => (
          <div key={index} className="flex flex-col gap-1 px-2">
            {group.caption && (
              <span className="hidden lg:block px-2 pt-2 pb-1 text-caption uppercase tracking-wide text-text-faint" lang="en">
                {group.caption}
              </span>
            )}
            {group.items.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                title={`${item.labelEn} / ${item.labelJa}`}
                className={cn(
                  "group flex items-center gap-3 rounded-[var(--radius-tile)] px-2.5 py-2 text-sub text-text-muted transition-colors duration-[var(--duration-fast)] ease-[var(--ease-out)]",
                  "hover:bg-surface-2 hover:text-text focus-visible:bg-surface-2 focus-visible:text-text",
                  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus)]",
                  "justify-center lg:justify-start",
                )}
              >
                <span aria-hidden className="text-h3 leading-none">
                  {item.icon}
                </span>
                <span className="hidden lg:flex flex-col leading-tight">
                  <span lang="en">{item.labelEn}</span>
                  <span lang="ja" className="text-micro text-text-faint">
                    {item.labelJa}
                  </span>
                </span>
              </Link>
            ))}
          </div>
        ))}
      </div>

      <div className="border-t border-line p-3 flex justify-center lg:block">
        <div
          className="h-9 w-9 rounded-full bg-surface-3 lg:hidden"
          title={user.name}
          aria-label={user.name}
        />
        <div className="hidden lg:flex items-center gap-3 rounded-[var(--radius-tile)] bg-surface-2 p-2.5">
          <div className="h-9 w-9 shrink-0 rounded-full bg-surface-3" aria-hidden />
          <div className="flex min-w-0 flex-col gap-0.5">
            <span className="truncate text-sub font-medium text-text">{user.name}</span>
            <span className="truncate text-micro text-text-faint">{user.masteryLabel}</span>
            <RankBadge tier={user.rank.tier} division={user.rank.division} size="xs" />
          </div>
        </div>
      </div>
    </nav>
  );
}
