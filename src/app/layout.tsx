import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Choko Japan",
  description: "A single-user Japanese learning platform.",
  manifest: "/manifest.webmanifest",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
