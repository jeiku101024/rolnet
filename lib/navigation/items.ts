import type { LucideIcon } from "lucide-react";
import {
  BusFront,
  FileChartColumn,
  Files,
  Gauge,
  HandCoins,
  History,
  ReceiptText,
  UserCog,
  UsersRound,
  Wrench,
} from "lucide-react";
import { hasPermission, isApproved, type Permission } from "@/lib/permissions/roles";
import { pageContext } from "@/lib/navigation/page-context";
import type { AppRole, ProfileStatus } from "@/types/database";

export type NavigationGroupId = "overview" | "fleet" | "operations" | "administration";

export type NavigationAccessContext = {
  role: AppRole;
  accountStatus: ProfileStatus;
};

export type NavigationDestination = {
  id: keyof typeof pageContext;
  label: string;
  href: `/${string}`;
  icon: LucideIcon;
  group: NavigationGroupId;
  order: number;
  access: "approved" | Permission;
  matchDescendants: true;
};

export type NavigationGroup = {
  id: NavigationGroupId;
  label: string;
  order: number;
  destinations: NavigationDestination[];
};

const groupDefinitions: ReadonlyArray<Omit<NavigationGroup, "destinations">> = [
  { id: "overview", label: "Overview", order: 1 },
  { id: "fleet", label: "Fleet", order: 2 },
  { id: "operations", label: "Operations", order: 3 },
  { id: "administration", label: "Administration", order: 4 },
];

export const navigationDestinations: readonly NavigationDestination[] = [
  { id: "dashboard", label: pageContext.dashboard.title, href: "/dashboard", icon: Gauge, group: "overview", order: 1, access: "view_dashboard", matchDescendants: true },
  { id: "units", label: pageContext.units.title, href: "/units", icon: BusFront, group: "fleet", order: 1, access: "approved", matchDescendants: true },
  { id: "drivers", label: pageContext.drivers.title, href: "/drivers", icon: UsersRound, group: "fleet", order: 2, access: "approved", matchDescendants: true },
  { id: "remittances", label: pageContext.remittances.title, href: "/remittances", icon: HandCoins, group: "operations", order: 1, access: "approved", matchDescendants: true },
  { id: "expenses", label: pageContext.expenses.title, href: "/expenses", icon: ReceiptText, group: "operations", order: 2, access: "approved", matchDescendants: true },
  { id: "maintenance", label: pageContext.maintenance.title, href: "/maintenance", icon: Wrench, group: "operations", order: 3, access: "approved", matchDescendants: true },
  { id: "documents", label: pageContext.documents.title, href: "/documents", icon: Files, group: "operations", order: 4, access: "manage_documents", matchDescendants: true },
  { id: "reports", label: pageContext.reports.title, href: "/reports", icon: FileChartColumn, group: "operations", order: 5, access: "export_reports", matchDescendants: true },
  { id: "audit", label: "Audit History", href: "/audit", icon: History, group: "administration", order: 1, access: "view_audit", matchDescendants: true },
  { id: "staff", label: "Staff Accounts", href: "/settings/staff", icon: UserCog, group: "administration", order: 2, access: "manage_users", matchDescendants: true },
] as const;

export function canAccessDestination(context: NavigationAccessContext | null, destination: NavigationDestination) {
  if (!context || !isApproved(context.accountStatus)) return false;
  return destination.access === "approved" || hasPermission(context.role, destination.access);
}

export function getNavigationGroups(context: NavigationAccessContext | null): NavigationGroup[] {
  if (!context || !isApproved(context.accountStatus)) return [];

  return groupDefinitions
    .map((group) => ({
      ...group,
      destinations: navigationDestinations
        .filter((destination) => destination.group === group.id && canAccessDestination(context, destination))
        .sort((left, right) => left.order - right.order),
    }))
    .filter((group) => group.destinations.length > 0)
    .sort((left, right) => left.order - right.order);
}

export function isDestinationActive(pathname: string, destination: NavigationDestination) {
  return pathname === destination.href || (destination.matchDescendants && pathname.startsWith(`${destination.href}/`));
}
