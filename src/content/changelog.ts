/// One user-facing release note. `id` is the release date (or date plus a
/// suffix if there are two on a day) and doubles as the value stored in
/// `UserProfile.settings.lastSeenChangelogId`, so never reuse or rewrite one.
export interface ChangelogRelease {
  id: string;
  /// ISO date, YYYY-MM-DD.
  date: string;
  title: string;
  /// Short, user-facing bullets. The what's-new popup shows only these.
  highlights: string[];
  /// Optional longer note, shown on the changelog page only.
  details?: string;
}

/// The single source of truth for the changelog page and the what's-new
/// popup. Newest first: the first entry is the one the popup announces, so
/// add a new release at the top. Internal work (build fixes, tooling, docs,
/// refactors) does not belong here.
export const CHANGELOG: ChangelogRelease[] = [
  {
    id: "2026-10-31",
    date: "2026-10-31",
    title: "Pronunciation",
    highlights: [
      "Speaker buttons next to readings in lessons, on subject pages and on the kana pages.",
      "Natural voice audio (VOICEVOX:冥鳴ひまり) that works in every browser, falling back to your browser's own Japanese voice when a clip is not available.",
      "Pronunciation plays automatically after you answer in reviews and lesson quizzes, without giving away a reading question that is still to come.",
      "Turn auto-play on or off under Settings > Pronunciation.",
    ],
    details:
      "Audio for kana, kanji readings, vocabulary and example sentences is pre-generated, so it sounds the same on every device. Items that do not have a clip yet use your browser's Japanese voice if it has one.",
  },
  {
    id: "2026-08-05",
    date: "2026-08-05",
    title: "Onboarding, sounds and more sentences",
    highlights: [
      "A first-run welcome for new accounts, and you can start lessons for a single subject type.",
      "A sound kit: answer sounds that climb with your streak, plus level-up and rank fanfares, with a volume control in Settings.",
      "Tutorials for how the app works, every tutorial now written out with furigana, and the library grouped into sections.",
      "Twice as many example sentences, picked by length so early sentences stay short.",
      "Complete beginner vocabulary coverage (126 of 126 words).",
      "Review forecast and accuracy cards on the Progress page, and JLPT progress now counts grammar.",
      "Items you have never missed no longer lose as much when they slip from Guru or higher.",
    ],
  },
  {
    id: "2026-08-04",
    date: "2026-08-04",
    title: "Ranks, practice and mnemonics",
    highlights: [
      "Reviews are split into ranked reviews (due items only) and unranked practice, which earns capped XP and includes burned items.",
      "Rank now has its own LP system, separate from level, and levels no longer stop at a hard cap.",
      "Achievement pop-ups with 14 early achievements, a \"Close to ranking up\" section on the Mastery page, and the real mastery level on the Infinite Mastery card.",
      "Kana became its own skippable stage, and \"I already know kana\" burns every kana.",
      "Hand-written mnemonics for every radical and the level 1 to 3 kanji, and explanations for all 107 grammar points.",
      "Lessons are reachable without \"Study All\", you can reset all progress with a typed confirmation, and the app is now called Nihongo Quest.",
    ],
  },
];

/// The release the what's-new popup announces, or null if the list is empty.
export function latestRelease(): ChangelogRelease | null {
  return CHANGELOG[0] ?? null;
}

/// Runtime check for ids arriving from the client, which TypeScript cannot
/// vouch for.
export function isKnownReleaseId(id: unknown): id is string {
  return typeof id === "string" && CHANGELOG.some((release) => release.id === id);
}
