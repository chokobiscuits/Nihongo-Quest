"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { RankBadge } from "@/components/rank/RankBadge";
import { SUBJECT_THEME } from "@/components/subject/theme";
import { typeToSlug } from "@/components/subject/typeSlug";
import { SubjectType } from "@/generated/prisma/enums";
import type { Rank } from "@/services/xp/rank";
import type { MasteryTier } from "@/services/xp/mastery";
import { cn } from "@/lib/utils";
import {
  DashboardIcon,
  KanaIcon,
  RadicalIcon,
  KanjiIcon,
  VocabIcon,
  GrammarIcon,
  SentenceIcon,
  ReadingIcon,
  LessonIcon,
  ReviewIcon,
  ExamIcon,
  ProgressIcon,
  MasteryIcon,
  AchievementIcon,
  SettingsIcon,
  TutorialIcon,
} from "./NavIcons";

/// Maps a nav href to the SubjectType whose theme color it should borrow
/// when active. Non-subject routes (dashboard, reviews, ...) fall back to
/// the brand color.
/// Derived from typeToSlug rather than written out, so nav hrefs cannot
/// drift from the routes again — they previously used the raw enum name
/// ("/subjects/RADICAL") while the route expects a slug, 404ing every
/// Learn link.
const NAV_THEME_BY_HREF: Partial<Record<string, SubjectType>> = Object.fromEntries(
  [
    SubjectType.KANA,
    SubjectType.RADICAL,
    SubjectType.KANJI,
    SubjectType.VOCAB,
    SubjectType.GRAMMAR,
    SubjectType.SENTENCE,
    SubjectType.READING,
  ].map((t) => [`/subjects/${typeToSlug(t)}`, t]),
);

interface NavItem {
  href: string;
  labelEn: string;
  labelJa: string;
  Icon: (props: { className?: string }) => React.ReactElement;
}

/// Per-type unlock status keyed the same way getTypeUnlockStatuses returns
/// it — only the gated types (KANJI/VOCAB/SENTENCE/GRAMMAR/READING) are
/// present; KANA and RADICAL are always unlocked and never appear here.
export type SidebarTypeUnlockStatuses = Record<
  "KANJI" | "VOCAB" | "SENTENCE" | "GRAMMAR" | "READING",
  { unlocked: boolean; requirement: string | null; have: number; need: number }
>;

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
      { href: `/subjects/${typeToSlug(SubjectType.KANA)}`, labelEn: "Kana", labelJa: "かな", Icon: KanaIcon },
      { href: `/subjects/${typeToSlug(SubjectType.RADICAL)}`, labelEn: "Radicals", labelJa: "部首", Icon: RadicalIcon },
      { href: `/subjects/${typeToSlug(SubjectType.KANJI)}`, labelEn: "Kanji", labelJa: "漢字", Icon: KanjiIcon },
      { href: `/subjects/${typeToSlug(SubjectType.VOCAB)}`, labelEn: "Vocabulary", labelJa: "語彙", Icon: VocabIcon },
      { href: `/subjects/${typeToSlug(SubjectType.GRAMMAR)}`, labelEn: "Grammar", labelJa: "文法", Icon: GrammarIcon },
      { href: `/subjects/${typeToSlug(SubjectType.SENTENCE)}`, labelEn: "Sentences", labelJa: "例文", Icon: SentenceIcon },
      { href: `/subjects/${typeToSlug(SubjectType.READING)}`, labelEn: "Text Readings", labelJa: "読解", Icon: ReadingIcon },
    ],
  },
  {
    caption: "Practice",
    items: [
      // The LEARN group above browses subjects; this is the only nav entry
      // that actually starts a lesson. Without it /lessons was reachable
      // solely through the dashboard's "Study All" button.
      { href: "/lessons", labelEn: "Lessons", labelJa: "レッスン", Icon: LessonIcon },
      { href: "/reviews", labelEn: "Reviews", labelJa: "復習", Icon: ReviewIcon },
      { href: "/exams", labelEn: "Exams", labelJa: "試験", Icon: ExamIcon },
    ],
  },
  {
    items: [
      { href: "/progress", labelEn: "Progress", labelJa: "進捗", Icon: ProgressIcon },
      { href: "/tutorials", labelEn: "Tutorials", labelJa: "チュートリアル", Icon: TutorialIcon },
      { href: "/mastery", labelEn: "Mastery", labelJa: "熟練度", Icon: MasteryIcon },
      { href: "/achievements", labelEn: "Achievements", labelJa: "実績", Icon: AchievementIcon },
      { href: "/settings", labelEn: "Settings", labelJa: "設定", Icon: SettingsIcon },
    ],
  },
];

export interface SidebarNavUser {
  name: string;
  avatarUrl?: string | null;
  masteryTier: MasteryTier;
  rank: Rank;
}

export interface SidebarNavProps {
  user: SidebarNavUser;
  /// Locked-state and requirement text for the Learn nav's gated types
  /// (KANJI/VOCAB/SENTENCE/GRAMMAR/READING). Undefined types render
  /// unlocked, same as KANA/RADICAL, which are never gated.
  typeUnlockStatuses?: SidebarTypeUnlockStatuses;
  className?: string;
}

const GATED_TYPES = new Set<SubjectType>([SubjectType.KANJI, SubjectType.VOCAB, SubjectType.SENTENCE, SubjectType.GRAMMAR, SubjectType.READING]);

/// Primary navigation. Full 240px sidebar at lg+ (1024px), 72px icon rail
/// with tooltips at md (768-1023px), hidden entirely below md (BottomTabBar
/// takes over). The collapsed/expanded states are pure CSS breakpoints so
/// there is no layout flash on resize.
export function SidebarNav({ user, typeUnlockStatuses, className }: SidebarNavProps) {
  const pathname = usePathname();
  const listRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<Map<string, HTMLAnchorElement>>(new Map());
  const [barStyle, setBarStyle] = useState<{ top: number; height: number; visible: boolean }>({
    top: 0,
    height: 0,
    visible: false,
  });

  // Slide the accent bar to whichever nav item is active. Recomputed on
  // pathname change (navigation) and on mount; positions are measured
  // against the scrollable list container so `top` stays correct even if
  // the list scrolls.
  useEffect(() => {
    const list = listRef.current;
    const activeEl = itemRefs.current.get(pathname);
    if (!list || !activeEl) {
      setBarStyle((prev) => ({ ...prev, visible: false }));
      return;
    }
    const listRect = list.getBoundingClientRect();
    const itemRect = activeEl.getBoundingClientRect();
    setBarStyle({
      top: itemRect.top - listRect.top + list.scrollTop,
      height: itemRect.height,
      visible: true,
    });
  }, [pathname]);

  const activeAccent = (() => {
    const subjectType = NAV_THEME_BY_HREF[pathname];
    return subjectType ? SUBJECT_THEME[subjectType].base : "var(--color-brand)";
  })();

  return (
    <nav
      className={cn(
        "hidden md:flex flex-col justify-between border-r border-line bg-surface w-[72px] lg:w-[240px]",
        className,
      )}
      aria-label="Primary"
    >
      <div ref={listRef} className="relative flex flex-col gap-4 overflow-y-auto py-4">
        {barStyle.visible && (
          <div
            aria-hidden
            className="sidebar-active-bar"
            style={{ top: barStyle.top, height: barStyle.height, "--accent": activeAccent } as React.CSSProperties}
          />
        )}
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
              // Soft gating: locked Learn types stay clickable — the lock
              // icon and title are informational only, never a disabled
              // link. Only KANJI/VOCAB/SENTENCE/GRAMMAR/READING are ever
              // gated; KANA/RADICAL always render unlocked.
              const status = subjectType && GATED_TYPES.has(subjectType) ? typeUnlockStatuses?.[subjectType as keyof SidebarTypeUnlockStatuses] : undefined;
              const locked = Boolean(status && !status.unlocked);
              const title = locked && status?.requirement
                ? `${item.labelEn} / ${item.labelJa} — locked: ${status.requirement} (${status.have} of ${status.need})`
                : `${item.labelEn} / ${item.labelJa}`;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  ref={(el) => {
                    if (el) itemRefs.current.set(item.href, el);
                    else itemRefs.current.delete(item.href);
                  }}
                  title={title}
                  className={cn(
                    "group flex items-center gap-3 rounded-[var(--radius-tile)] px-2.5 py-2 text-sub transition-colors duration-[var(--duration-fast)] ease-[var(--ease-out)]",
                    active ? "text-text" : locked ? "text-text-faint" : "text-text-muted",
                    "hover:bg-surface-2 hover:text-text focus-visible:bg-surface-2 focus-visible:text-text",
                    "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus)]",
                    "justify-center lg:justify-start",
                  )}
                >
                  <span
                    aria-hidden
                    className="flex h-5 w-5 shrink-0 items-center justify-center leading-none"
                    style={{ color: active ? activeColor : "var(--color-text-dim)", opacity: locked ? 0.5 : 1 }}
                  >
                    <item.Icon className="h-[18px] w-[18px]" />
                  </span>
                  <span className="hidden lg:flex flex-col leading-tight">
                    <span lang="en" className="inline-flex items-center gap-1">
                      {item.labelEn}
                      {locked && (
                        <span aria-hidden className="text-micro opacity-60">
                          🔒
                        </span>
                      )}
                    </span>
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
          className="h-9 w-9 rounded-full bg-surface-3 bg-cover bg-center lg:hidden"
          style={user.avatarUrl ? { backgroundImage: `url(${user.avatarUrl})` } : undefined}
          title={user.name}
          aria-label={user.name}
        />
        <div className="hidden lg:flex items-center gap-3 rounded-[var(--radius-tile)] bg-surface-2 p-2.5">
          <div
            className="h-9 w-9 shrink-0 rounded-full bg-surface-3 bg-cover bg-center"
            style={user.avatarUrl ? { backgroundImage: `url(${user.avatarUrl})` } : undefined}
            aria-hidden
          />
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
