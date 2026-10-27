import { createElement } from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { NavigationItems } from "@/components/navigation/navigation-items";
import { SidebarProvider } from "@/components/ui/sidebar";
import {
  getNavigationGroups,
  isDestinationActive,
  navigationDestinations,
} from "@/lib/navigation/items";

const owner = { role: "owner" as const, accountStatus: "approved" as const };
const staff = { role: "staff" as const, accountStatus: "approved" as const };

vi.mock("next/navigation", () => ({ usePathname: () => "/units" }));

describe("navigation destination registry", () => {
  it("keeps destination ids and routes unique and absolute", () => {
    expect(new Set(navigationDestinations.map((item) => item.id)).size).toBe(navigationDestinations.length);
    expect(new Set(navigationDestinations.map((item) => item.href)).size).toBe(navigationDestinations.length);
    expect(navigationDestinations.every((item) => item.href.startsWith("/"))).toBe(true);
  });

  it("shows all ten destinations to an approved owner", () => {
    const groups = getNavigationGroups(owner);
    expect(groups.map((group) => group.label)).toEqual(["Overview", "Fleet", "Operations", "Administration"]);
    expect(groups.flatMap((group) => group.destinations)).toHaveLength(10);
  });

  it("shows only approved-session fleet and operations pages to staff", () => {
    const groups = getNavigationGroups(staff);
    expect(groups.map((group) => group.label)).toEqual(["Fleet", "Operations"]);
    expect(groups.flatMap((group) => group.destinations).map((item) => item.label)).toEqual([
      "Units",
      "Drivers",
      "Remittances",
      "Expenses",
      "Maintenance",
    ]);
  });

  it.each([null, "pending", "rejected", "deactivated"] as const)(
    "hides protected navigation for %s access",
    (accountStatus) => {
      const context = accountStatus ? { role: "staff" as const, accountStatus } : null;
      expect(getNavigationGroups(context)).toEqual([]);
    },
  );

  it.each([
    ["/units", "/units", true],
    ["/units/unit-1", "/units", true],
    ["/units-archive", "/units", false],
    ["/settings/staff", "/settings/staff", true],
    ["/settings/staff/member-1", "/settings/staff", true],
    ["/drivers", "/units", false],
  ])("matches pathname %s against %s as %s", (pathname, href, expected) => {
    const destination = navigationDestinations.find((item) => item.href === href);
    expect(destination).toBeDefined();
    expect(isDestinationActive(pathname, destination!)).toBe(expected);
  });

  it("renders consistent visible labels with decorative registry icons", () => {
    const groups = getNavigationGroups(owner);
    const { container } = render(
      createElement(SidebarProvider, null, createElement(NavigationItems, { groups })),
    );
    expect(screen.getAllByRole("link")).toHaveLength(10);
    expect(screen.getByRole("link", { name: "Units" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Units" })).toHaveAttribute("data-active", "true");
    expect(container.querySelectorAll("svg[aria-hidden='true']")).toHaveLength(10);
    for (const destination of navigationDestinations) {
      expect(screen.getByRole("link", { name: destination.label })).toBeVisible();
      expect(destination.icon).toBeTruthy();
    }
  });
});
