"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { RankBadge } from "@/components/rank/RankBadge";
import { SUBJECT_THEME } from "@/components/subject/theme";
import { SubjectType } from "@/generated/prisma/enums";
import type { Rank } from "@/services/xp/rank";
import type { MasteryTier } from "@/services/xp/mastery";
import { cn } from "@/lib/utils";
import {
  DashboardIcon,
  RadicalIcon,
  KanjiIcon,
  VocabIcon,
  GrammarIcon,
  SentenceIcon,
  ReadingIcon,
  ReviewIcon,
  ExamIcon,
  ProgressIcon,
  AchievementIcon,
  SettingsIcon,
} from "./NavIcons";

/// Maps a nav href to the SubjectType whose theme color it should borrow
/// when active. Non-subject routes (dashboard, reviews, ...) fall back to
/// the brand color.
const NAV_THEME_BY_HREF: Partial<Record<string, SubjectType>> = {
  "/subjects/RADICAL": SubjectType.RADICAL,
  "/subjects/KANJI": SubjectType.KANJI,
  "/subjects/VOCAB": SubjectType.VOCAB,
  "/subjects/GRAMMAR": SubjectType.GRAMMAR,
  "/subjects/SENTENCE": SubjectType.SENTENCE,
  "/subjects/READING": SubjectType.READING,
};

interface NavItem {
  href: string;
  labelEn: string;
  labelJa: string;
  Icon: (props: { className?: string }) => React.ReactElement;
}

interface NavGroup {
  caption?: string;
  items: NavItem[];
}

const NAV_GROUPS: NavGroup[] = [
  {
    items: [{ href: "/", labelEn: "Dashboard", labelJa: "ダッシュボード", Icon: DashboardIcon }],
  },
  {
    caption: "Learn",
    items: [
      { href: "/subjects/RADICAL", labelEn: "Radicals", labelJa: "部首", Icon: RadicalIcon },
      { href: "/subjects/KANJI", labelEn: "Kanji", labelJa: "漢字", Icon: KanjiIcon },
      { href: "/subjects/VOCAB", labelEn: "Vocabulary", labelJa: "語彙", Icon: VocabIcon },
      { href: "/subjects/GRAMMAR", labelEn: "Grammar", labelJa: "文法", Icon: GrammarIcon },
      { href: "/subjects/SENTENCE", labelEn: "Sentences", labelJa: "例文", Icon: SentenceIcon },
      { href: "/subjects/READING", labelEn: "Text Readings", labelJa: "読解", Icon: ReadingIcon },
    ],
  },
  {
    caption: "Practice",
    items: [
      { href: "/reviews", labelEn: "Reviews", labelJa: "復習", Icon: ReviewIcon },
      { href: "/exams", labelEn: "Exams", labelJa: "試験", Icon: ExamIcon },
    ],
  },
  {
    items: [
      { href: "/progress", labelEn: "Progress", labelJa: "進捗", Icon: ProgressIcon },
      { href: "/achievements", labelEn: "Achievements", labelJa: "実績", Icon: AchievementIcon },
      { href: "/settings", labelEn: "Settings", labelJa: "設定", Icon: SettingsIcon },
    ],
  },
];

export interface SidebarNavUser {
  name: string;
  avatarUrl?: string;
  masteryTier: MasteryTier;
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
  const pathname = usePathname();

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
            {group.items.map((item) => {
              const active = pathname === item.href;
              const subjectType = NAV_THEME_BY_HREF[item.href];
              const activeColor = subjectType ? SUBJECT_THEME[subjectType].base : "var(--color-brand)";
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  title={`${item.labelEn} / ${item.labelJa}`}
                  className={cn(
                    "group flex items-center gap-3 rounded-[var(--radius-tile)] px-2.5 py-2 text-sub transition-colors duration-[var(--duration-fast)] ease-[var(--ease-out)]",
                    active ? "text-text" : "text-text-muted",
                    "hover:bg-surface-2 hover:text-text focus-visible:bg-surface-2 focus-visible:text-text",
                    "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus)]",
                    "justify-center lg:justify-start",
                  )}
                >
                  <span
                    aria-hidden
                    className="flex h-5 w-5 shrink-0 items-center justify-center leading-none"
                    style={{ color: active ? activeColor : "var(--color-text-dim)" }}
                  >
                    <item.Icon className="h-[18px] w-[18px]" />
                  </span>
                  <span className="hidden lg:flex flex-col leading-tight">
                    <span lang="en">{item.labelEn}</span>
                    <span lang="ja" className="text-micro text-text-faint">
                      {item.labelJa}
                    </span>
                  </span>
                </Link>
              );
            })}
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
            <span className="truncate text-micro text-text-faint">
              Mastery Lv.{user.masteryTier.level}
              {user.masteryTier.level > 0 && ` ${user.masteryTier.name}`}
            </span>
            <RankBadge tier={user.rank.tier} division={user.rank.division} size="xs" />
          </div>
        </div>
      </div>
    </nav>
  );
}
