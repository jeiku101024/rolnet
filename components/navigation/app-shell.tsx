"use client";

import type { ReactNode } from "react";
import { BrandLogo } from "@/components/navigation/brand-logo";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { SessionProfile } from "@/lib/auth/guards";
import { isApproved } from "@/lib/permissions/roles";
import { AppSidebar } from "@/components/navigation/app-sidebar";
import { PublicNav } from "@/components/navigation/public-nav";
import { ThemeToggle } from "@/components/navigation/theme-toggle";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";

const publicAuthPaths = new Set(["/login", "/register"]);

export function AppShell({ children, profile }: { children: ReactNode; profile: SessionProfile | null }) {
  const pathname = usePathname();
  const authenticated = Boolean(profile && isApproved(profile.accountStatus) && !publicAuthPaths.has(pathname));

  if (!authenticated || !profile) {
    return (
      <div className="flex min-h-screen min-w-0 flex-col bg-canvas">
        <header className="border-b border-rule bg-surface">
          <div className="layout-shell flex min-h-16 min-w-0 items-center justify-between gap-2 py-2">
            <Link aria-label="ROLNET home" className="touch-target inline-flex shrink-0 items-center" href="/">
              <BrandLogo variant="mark" className="logo-mark" priority />
            </Link>
            <div className="flex min-w-0 items-center gap-1"><PublicNav /><ThemeToggle /></div>
          </div>
        </header>
        <main className="flex min-w-0 flex-1 flex-col">{children}</main>
      </div>
    );
  }

  return (
    <SidebarProvider>
      <AppSidebar profile={profile} />
      <SidebarInset className="min-h-screen bg-canvas">
        <header className="sticky top-0 z-20 border-b border-rule bg-surface/95 backdrop-blur-sm">
          <div className="layout-shell grid min-h-16 grid-cols-[1fr_auto_1fr] items-center gap-3 py-2 md:flex md:h-(--shell-header-height) md:justify-between md:py-0">
            <div className="flex items-center gap-2"><SidebarTrigger /></div>
            <Link aria-label="ROLNET home" className="touch-target inline-flex items-center justify-center md:hidden" href="/">
              <BrandLogo variant="horizontal" className="logo-horizontal" priority />
            </Link>
            <div className="flex items-center justify-end gap-3"><p className="hidden whitespace-nowrap text-body-sm font-medium text-muted lg:block">Records that move the fleet</p><ThemeToggle /></div>
          </div>
        </header>
        <main className="flex min-w-0 flex-1 flex-col">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  );
}
