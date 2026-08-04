import type { Metadata } from "next";
import { Inter, Noto_Sans_JP, Noto_Serif_JP } from "next/font/google";
import "./globals.css";
import { AppShell } from "@/components/shell/AppShell";
import { getOrCreateProfile } from "@/server/queries/profile";
import { rankForLevel } from "@/services/xp/rank";
import { accountMasteryLevel, masteryTier } from "@/services/xp/mastery";
import { prisma } from "@/lib/db";
import { getTypeUnlockStatuses } from "@/server/queries/curriculum";
import { storage } from "@/lib/storage";

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
  return {
    name: profile.displayName,
    avatarUrl: profile.avatarPath ? storage.publicUrl(profile.avatarPath) : null,
    rank: rankForLevel(profile.accountLevel),
    tier: masteryTier(accountMasteryLevel(masteryXpAgg._sum.masteryXp ?? 0)),
    unlockStatuses,
  };
}

/// Used only when the database is unreachable. Everything is gated or zeroed,
/// so a degraded shell never implies progress the user does not have.
const FALLBACK_SHELL: Awaited<ReturnType<typeof loadShellData>> = {
  name: "Learner",
  avatarUrl: null,
  rank: rankForLevel(1),
  tier: masteryTier(0),
  unlockStatuses: {
    KANJI: { type: "KANJI", unlocked: false, requirement: null, have: 0, need: 0 },
    VOCAB: { type: "VOCAB", unlocked: false, requirement: null, have: 0, need: 0 },
    SENTENCE: { type: "SENTENCE", unlocked: false, requirement: null, have: 0, need: 0 },
    GRAMMAR: { type: "GRAMMAR", unlocked: false, requirement: null, have: 0, need: 0 },
    READING: { type: "READING", unlocked: false, requirement: null, have: 0, need: 0 },
  },
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
      </body>
    </html>
  );
}
