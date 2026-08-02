import type { Metadata } from "next";
import { Inter, Noto_Sans_JP, Noto_Serif_JP } from "next/font/google";
import "./globals.css";
import { AppShell } from "@/components/shell/AppShell";
import { getOrCreateProfile } from "@/server/queries/profile";
import { rankForLevel } from "@/services/xp/rank";

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

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const profile = await getOrCreateProfile(APP_USER_ID);
  const rank = rankForLevel(profile.accountLevel);

  return (
    <html
      lang="ja"
      className={`h-full antialiased ${fontLatin.variable} ${fontJa.variable} ${fontJaDisplay.variable}`}
    >
      <body className="min-h-full flex flex-col bg-canvas text-text">
        <AppShell
          user={{
            name: profile.displayName,
            masteryLabel: "Mastery ∞",
            rank,
          }}
        >
          {children}
        </AppShell>
      </body>
    </html>
  );
}
