import type { SVGProps } from "react";

/// Outline line icons for the sidebar, ~18px on an 18x18 grid, 1.5px stroke.
/// Kept together in one file since they are only ever used by SidebarNav /
/// BottomTabBar and share the same stroke conventions.
type IconProps = SVGProps<SVGSVGElement>;

const BASE_PROPS = {
  width: 18,
  height: 18,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.5,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

export function DashboardIcon(props: IconProps) {
  return (
    <svg {...BASE_PROPS} {...props}>
      <path d="M3 11.5 12 4l9 7.5" />
      <path d="M5 10v9a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1v-9" />
    </svg>
  );
}

export function KanaIcon(props: IconProps) {
  return (
    <svg {...BASE_PROPS} {...props}>
      <path d="M7 5c3 0 7 1 7 5s-4 5-7 5" />
      <path d="M9 15c0 2 2 4 5 4" />
      <path d="M15 9h5" />
    </svg>
  );
}

export function RadicalIcon(props: IconProps) {
  return (
    <svg {...BASE_PROPS} {...props}>
      <circle cx="12" cy="12" r="8" />
      <path d="M12 4v16M4 12h16" />
    </svg>
  );
}

export function KanjiIcon(props: IconProps) {
  return (
    <svg {...BASE_PROPS} {...props}>
      <rect x="4" y="4" width="16" height="16" rx="2" />
      <path d="M4 12h16M12 4v16" />
    </svg>
  );
}

export function VocabIcon(props: IconProps) {
  return (
    <svg {...BASE_PROPS} {...props}>
      <path d="M4 19.5V6a2 2 0 0 1 2-2h13v14H6a2 2 0 0 0-2 2Z" />
      <path d="M6 19.5A2 2 0 0 1 6 15.5h13" />
    </svg>
  );
}

export function GrammarIcon(props: IconProps) {
  return (
    <svg {...BASE_PROPS} {...props}>
      <path d="M6 3h9l5 5v13H6z" />
      <path d="M15 3v5h5M9 12h6M9 16h6" />
    </svg>
  );
}

export function SentenceIcon(props: IconProps) {
  return (
    <svg {...BASE_PROPS} {...props}>
      <path d="M21 12a8 8 0 1 1-3.6-6.66L21 4l-1 4.5" />
      <path d="M8 11h6M8 14h4" />
    </svg>
  );
}

export function ReadingIcon(props: IconProps) {
  return (
    <svg {...BASE_PROPS} {...props}>
      <path d="M12 6c-1.5-1.2-3.6-2-6-2v14c2.4 0 4.5.8 6 2 1.5-1.2 3.6-2 6-2V4c-2.4 0-4.5.8-6 2Z" />
      <path d="M12 6v14" />
    </svg>
  );
}

/// Graduation cap: learning something new. Deliberately not a book — the
/// ReadingIcon above already owns that shape — and not a cycle, which is
/// ReviewIcon's.
export function LessonIcon(props: IconProps) {
  return (
    <svg {...BASE_PROPS} {...props}>
      <path d="M12 4 2.5 9 12 14l9.5-5L12 4Z" />
      <path d="M6.5 11.2V16c0 1.4 2.5 2.5 5.5 2.5s5.5-1.1 5.5-2.5v-4.8" />
      <path d="M21.5 9v5" />
    </svg>
  );
}

export function ReviewIcon(props: IconProps) {
  return (
    <svg {...BASE_PROPS} {...props}>
      <path d="M3 12a9 9 0 0 1 15.3-6.4L21 8" />
      <path d="M21 4v4h-4" />
      <path d="M21 12a9 9 0 0 1-15.3 6.4L3 16" />
      <path d="M3 20v-4h4" />
    </svg>
  );
}

export function ExamIcon(props: IconProps) {
  return (
    <svg {...BASE_PROPS} {...props}>
      <rect x="4" y="3" width="16" height="18" rx="2" />
      <path d="m8.5 12 2 2 4.5-4.5" />
    </svg>
  );
}

export function ProgressIcon(props: IconProps) {
  return (
    <svg {...BASE_PROPS} {...props}>
      <path d="M4 19h16" />
      <path d="M7 19v-5M12 19V8M17 19v-9" />
    </svg>
  );
}

export function AchievementIcon(props: IconProps) {
  return (
    <svg {...BASE_PROPS} {...props}>
      <circle cx="12" cy="8" r="5" />
      <path d="m8.5 12.5-1.5 7 5-2.5 5 2.5-1.5-7" />
    </svg>
  );
}

export function MasteryIcon(props: IconProps) {
  return (
    <svg {...BASE_PROPS} {...props}>
      <circle cx="12" cy="12" r="8" />
      <path d="M9.5 12.5 11 14l3.5-4" />
    </svg>
  );
}

export function TutorialIcon(props: IconProps) {
  return (
    <svg {...BASE_PROPS} {...props}>
      <path d="M4 19.5V5.5a2 2 0 0 1 2-2h12v15H6a2 2 0 0 0-2 2Z" />
      <path d="M18 21H6a2 2 0 0 1 0-4h12" />
      <path d="M8.5 8h7M8.5 11.5h5" />
    </svg>
  );
}

export function SettingsIcon(props: IconProps) {
  return (
    <svg {...BASE_PROPS} {...props}>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 13a7.97 7.97 0 0 0 0-2l2.1-1.6-2-3.4-2.5 1a8 8 0 0 0-1.7-1L14.9 3h-3.8l-.4 2.9a8 8 0 0 0-1.7 1l-2.5-1-2 3.4L6.6 11a7.97 7.97 0 0 0 0 2l-2.1 1.6 2 3.4 2.5-1a8 8 0 0 0 1.7 1l.4 2.9h3.8l.4-2.9a8 8 0 0 0 1.7-1l2.5 1 2-3.4Z" />
    </svg>
  );
}
