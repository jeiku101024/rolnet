import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import type { ReactNode } from "react";
import { AppShell } from "@/components/navigation/app-shell";
import { getSessionProfile } from "@/lib/auth/guards";
import "./globals.css";

export const metadata: Metadata = {
  title: "ROLNET Fleet Ledger",
  description: "Operations ledger for tricycle fleet records.",
  icons: {
    icon: "/brand/rolnet-icon.svg",
    apple: "/brand/apple-touch-icon.png",
  },
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  const profile = await getSessionProfile();
  return (
    <html
      lang="en"
      className={`${GeistSans.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col"><AppShell profile={profile}>{children}</AppShell></body>
    </html>
  );
}
