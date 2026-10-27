"use client";

import Image from "next/image";
import Link from "next/link";
import type { SessionProfile } from "@/lib/auth/guards";
import { getNavigationGroups } from "@/lib/navigation/items";
import { NavigationItems } from "@/components/navigation/navigation-items";
import { LogoutButton } from "@/components/navigation/logout-button";
import { Sidebar, SidebarContent, SidebarFooter, SidebarHeader } from "@/components/ui/sidebar";

export function AppSidebar({ profile }: { profile: SessionProfile }) {
  const groups = getNavigationGroups(profile);
  const homeHref = groups[0]?.destinations[0]?.href ?? "/";

  return (
    <Sidebar>
      <SidebarHeader className="pr-14 md:pr-4">
        <Link aria-label="ROLNET home" className="touch-target inline-flex items-center" href={homeHref}>
          <Image className="logo-full-header" src="/brand/rolnet-logo.svg" alt="ROLNET" width={300} height={225} priority />
        </Link>
        <p className="text-label font-semibold text-muted">Fleet operations ledger</p>
      </SidebarHeader>
      <SidebarContent>
        <NavigationItems groups={groups} />
      </SidebarContent>
      <SidebarFooter>
        <div className="mb-3 min-w-0">
          <p className="truncate text-body-sm font-bold text-ink">{profile.displayName.trim() || "ROLNET account"}</p>
          <p className="text-label capitalize text-muted">{profile.role}</p>
        </div>
        <LogoutButton />
      </SidebarFooter>
    </Sidebar>
  );
}
