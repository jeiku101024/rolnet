"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { NavigationGroup } from "@/lib/navigation/items";
import { isDestinationActive } from "@/lib/navigation/items";
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";

export function NavigationItems({ groups }: { groups: NavigationGroup[] }) {
  const pathname = usePathname();
  const { setOpenMobile } = useSidebar();

  return groups.map((group) => (
    <SidebarGroup key={group.id}>
      <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          {group.destinations.map((destination) => {
            const active = isDestinationActive(pathname, destination);
            const Icon = destination.icon;
            return (
              <SidebarMenuItem key={destination.id}>
                <Link
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "group/nav-link flex min-h-11 w-full items-center gap-3 rounded-md border-l-4 border-transparent px-3 py-2 text-body-sm font-semibold text-muted outline-none transition-colors",
                    "hover:bg-brand-soft hover:text-ink focus-visible:ring-2 focus-visible:ring-focus",
                    active && "border-brand bg-brand-soft text-brand-dark",
                  )}
                  data-active={active ? "true" : "false"}
                  href={destination.href}
                  onClick={() => setOpenMobile(false)}
                >
                  <Icon aria-hidden="true" className="size-5 shrink-0" strokeWidth={2} />
                  <span className="min-w-0 whitespace-normal leading-tight">{destination.label}</span>
                </Link>
              </SidebarMenuItem>
            );
          })}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  ));
}
