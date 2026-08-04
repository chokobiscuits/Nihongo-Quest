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

const APP_USER_ID = process.env.APP_USER_ID ?? "local-user";

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
  title: "Nihon Quest | 日本クエスト",
  description: "A single-user Japanese learning platform.",
  manifest: "/manifest.webmanifest",
};

/// Every page renders inside this layout, and the layout reads the user's
/// profile, mastery and unlock state from the database. That makes the whole
/// app request-time by nature, so opt out of static prerendering explicitly.
/// Without this, `next build` tries to prerender /_not-found, hits the
/// database with no connection available, and fails the build.
export const dynamic = "force-dynamic";

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const profile = await getOrCreateProfile(APP_USER_ID);
  const rank = rankForLevel(profile.accountLevel);
  const masteryXpAgg = await prisma.userSubject.aggregate({
    where: { userId: APP_USER_ID },
    _sum: { masteryXp: true },
  });
  const tier = masteryTier(accountMasteryLevel(masteryXpAgg._sum.masteryXp ?? 0));
  const unlockStatuses = await getTypeUnlockStatuses(APP_USER_ID);

  return (
    <html
      lang="ja"
      className={`h-full antialiased ${fontLatin.variable} ${fontJa.variable} ${fontJaDisplay.variable}`}
    >
      <body className="min-h-full flex flex-col bg-canvas text-text">
        <AppShell
          user={{
            name: profile.displayName,
            avatarUrl: profile.avatarPath ? storage.publicUrl(profile.avatarPath) : null,
            masteryTier: tier,
            rank,
          }}
          typeUnlockStatuses={unlockStatuses}
        >
          {children}
        </AppShell>
      </body>
    </html>
  );
}
