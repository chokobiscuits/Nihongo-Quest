import type { Metadata } from "next";
import { Inter, Noto_Sans_JP, Noto_Serif_JP } from "next/font/google";
import "./globals.css";
import { AppShell } from "@/components/shell/AppShell";
import { getOrCreateProfile } from "@/server/queries/profile";
import { parseTier } from "@/services/rank/tiers";
import { accountMasteryLevel, masteryTier } from "@/services/xp/mastery";
import { prisma } from "@/lib/db";
import { getTypeUnlockStatuses } from "@/server/queries/curriculum";
import { storage } from "@/lib/storage";
import { SoundProvider } from "@/components/sound/SoundProvider";
import { DEFAULT_SOUND_ENABLED, DEFAULT_SOUND_VOLUME } from "@/lib/sound/manifest";
import { SpeechSettingsProvider } from "@/components/speech/SpeechSettingsProvider";
import { DEFAULT_SPEECH_AUTOPLAY } from "@/components/speech/speechSettings";
import { ChangelogPopup } from "@/components/changelog/ChangelogPopup";
import { CHANGELOG, latestRelease } from "@/content/changelog";
import { shouldShowChangelog } from "@/services/changelog/visibility";
import { hasCompletedAnyTutorial } from "@/server/changelog";

import { APP_USER_ID } from "@/lib/appUser";

const fontLatin = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
  variable: "--font-latin",
});

const fontJa = Noto_Sans_JP({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  display: "swap",
  preload: false,
  variable: "--font-ja",
});

const fontJaDisplay = Noto_Serif_JP({
  subsets: ["latin"],
  weight: ["600"],
  display: "swap",
  preload: false,
  variable: "--font-ja-display",
});

export const metadata: Metadata = {
  title: "Nihongo Quest | 日本語クエスト",
  description: "A single-user Japanese learning platform.",
  manifest: "/manifest.webmanifest",
};

/// Every page renders inside this layout, and the layout reads the user's
/// profile, mastery and unlock state from the database. That makes the whole
/// app request-time by nature, so opt out of static prerendering explicitly.
/// Without this, `next build` tries to prerender /_not-found, hits the
/// database with no connection available, and fails the build.
export const dynamic = "force-dynamic";

async function loadShellData() {
  const profile = await getOrCreateProfile(APP_USER_ID);
  const masteryXpAgg = await prisma.userSubject.aggregate({
    where: { userId: APP_USER_ID },
    _sum: { masteryXp: true },
  });
  const unlockStatuses = await getTypeUnlockStatuses(APP_USER_ID);
  const settings = (profile.settings ?? {}) as {
    soundEnabled?: boolean;
    soundVolume?: number;
    pronunciationAutoplay?: boolean;
    lastSeenChangelogId?: string;
  };
  const latest = latestRelease();
  const showChangelog =
    latest !== null &&
    shouldShowChangelog({
      releaseIds: CHANGELOG.map((release) => release.id),
      lastSeenId: settings.lastSeenChangelogId,
      onboarded: await hasCompletedAnyTutorial(APP_USER_ID),
    });
  return {
    name: profile.displayName,
    avatarUrl: profile.avatarPath ? storage.publicUrl(profile.avatarPath) : null,
    rank: { tier: parseTier(profile.rank), division: profile.rankDivision },
    tier: masteryTier(accountMasteryLevel(masteryXpAgg._sum.masteryXp ?? 0)),
    unlockStatuses,
    // On by default: browsers keep the AudioContext suspended until a
    // deliberate gesture, so there is no surprise noise on load, and
    // off-by-default would leave the feature unfound in settings.
    soundEnabled: settings.soundEnabled ?? DEFAULT_SOUND_ENABLED,
    soundVolume: settings.soundVolume ?? DEFAULT_SOUND_VOLUME,
    pronunciationAutoplay: settings.pronunciationAutoplay ?? DEFAULT_SPEECH_AUTOPLAY,
    // Null in the degraded shell below: with the database down there is no
    // way to record that it was seen, so it would reappear on every load.
    changelogRelease: showChangelog ? latest : null,
  };
}

/// Used only when the database is unreachable. Everything is gated or zeroed,
/// so a degraded shell never implies progress the user does not have.
const FALLBACK_SHELL: Awaited<ReturnType<typeof loadShellData>> = {
  name: "Learner",
  avatarUrl: null,
  rank: { tier: "IRON", division: 4 },
  tier: masteryTier(0),
  unlockStatuses: {
    KANJI: { type: "KANJI", unlocked: false, requirement: null, have: 0, need: 0 },
    VOCAB: { type: "VOCAB", unlocked: false, requirement: null, have: 0, need: 0 },
    SENTENCE: { type: "SENTENCE", unlocked: false, requirement: null, have: 0, need: 0 },
    GRAMMAR: { type: "GRAMMAR", unlocked: false, requirement: null, have: 0, need: 0 },
    READING: { type: "READING", unlocked: false, requirement: null, have: 0, need: 0 },
  },
  // Silent in the degraded shell: we cannot know the user's preference with
  // the DB down, and defaulting to noise on a broken app is the wrong guess.
  soundEnabled: false,
  soundVolume: DEFAULT_SOUND_VOLUME,
  pronunciationAutoplay: false,
  changelogRelease: null,
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // The shell is chrome, not content. If the database is unreachable it must
  // still render, or a connection problem 500s every route including /login,
  // leaving no way in and no visible reason why. Failures are logged so they
  // reach the platform's runtime logs rather than vanishing into a generic
  // error page.
  const shell = await loadShellData().catch((error) => {
    console.error("[layout] shell data failed to load:", error);
    return FALLBACK_SHELL;
  });

  return (
    <html
      lang="ja"
      className={`h-full antialiased ${fontLatin.variable} ${fontJa.variable} ${fontJaDisplay.variable}`}
    >
      <body className="min-h-full flex flex-col bg-canvas text-text">
        <SoundProvider enabled={shell.soundEnabled} volume={shell.soundVolume}>
          <SpeechSettingsProvider autoplay={shell.pronunciationAutoplay}>
            <AppShell
              user={{
                name: shell.name,
                avatarUrl: shell.avatarUrl,
                masteryTier: shell.tier,
                rank: shell.rank,
              }}
              typeUnlockStatuses={shell.unlockStatuses}
            >
              {children}
            </AppShell>
            <ChangelogPopup release={shell.changelogRelease} />
          </SpeechSettingsProvider>
        </SoundProvider>
      </body>
    </html>
  );
}
