"use client";

import type { ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { SessionProfile } from "@/lib/auth/guards";
import { isApproved } from "@/lib/permissions/roles";
import { AppSidebar } from "@/components/navigation/app-sidebar";
import { PublicNav } from "@/components/navigation/public-nav";
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
              <Image className="logo-mark sm:hidden" src="/brand/rolnet-mark.svg" alt="ROLNET" width={255} height={166} priority />
              <Image className="logo-full-header hidden sm:block" src="/brand/rolnet-logo.svg" alt="ROLNET" width={300} height={225} priority />
            </Link>
            <PublicNav />
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
          <div className="layout-shell flex min-h-16 items-center justify-between gap-3 py-2">
            <div className="flex items-center gap-2">
              <SidebarTrigger />
              <Link aria-label="ROLNET home" className="touch-target inline-flex items-center md:hidden" href="/">
                <Image className="logo-mark" src="/brand/rolnet-mark.svg" alt="ROLNET" width={255} height={166} priority />
              </Link>
            </div>
            <p className="hidden text-body-sm font-medium text-muted sm:block">Records that move the fleet</p>
          </div>
        </header>
        <main className="flex min-w-0 flex-1 flex-col">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  );
}
