import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { Suspense, type ReactNode } from "react";
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

// The session is read from cookies, which is runtime data under Cache Components. Reading it inside
// a Suspense boundary keeps the html/body shell prerenderable and makes every page render at
// request time, so pages may read the clock (fleet date, report month) after their session check.
async function SessionShell({ children }: { children: ReactNode }) {
  const profile = await getSessionProfile();
  return <AppShell profile={profile}>{children}</AppShell>;
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="en"
      className={`${GeistSans.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <Suspense fallback={<div className="min-h-screen bg-canvas" />}>
          <SessionShell>{children}</SessionShell>
        </Suspense>
      </body>
    </html>
  );
}
