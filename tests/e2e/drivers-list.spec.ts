import { test, expect, type Page } from "@playwright/test";

// Feature 012, in demo mode (360 px phone by default). Demo data today (lib/demo/mode.ts): Ramon Cruz
// is on day-off, Rosa Lim on leave with an end date, Danilo Ramos on open-ended leave for 16 days
// (amber), Arnel Flores open-ended for 31 days but checked (snoozed), Juan Dela Cruz has a day-off in
// 2 days, and Rey Navarro is Inactive. Writes are disabled in demo; saves are covered by pgTAP and the
// quickstart walkthrough.

const row = (page: Page, name: string) => page.getByRole("row").filter({ has: page.getByRole("link", { name, exact: true }) });

test.describe("drivers list", () => {
  test("shows the full-width table with the five columns and no form card", async ({ page }) => {
    await page.goto("/drivers");
    for (const header of ["Driver", "Role", "Current unit", "Contact", "Status today"]) await expect(page.getByRole("columnheader", { name: header })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Add a driver" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Add a driver" })).toBeVisible();
    await expect(page.getByText(/^Available for assignment:/)).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });

  test("derives Status today, its second lines, and the next absence", async ({ page }) => {
    await page.goto("/drivers?q=Ramon");
    await expect(row(page, "Ramon Cruz")).toContainText("Day-off");
    await expect(row(page, "Ramon Cruz")).toContainText("—");
    await page.goto("/drivers?q=Danilo");
    await expect(row(page, "Danilo Ramos")).toContainText("On-leave");
    await expect(row(page, "Danilo Ramos")).toContainText("Open for 16 days");
    await page.goto("/drivers?q=Arnel");
    await expect(row(page, "Arnel Flores")).toContainText("open-ended · checked");
    await page.goto("/drivers?q=Rosa");
    await expect(row(page, "Rosa Lim")).toContainText(/until \w{3} \d{1,2}/);
    await page.goto("/drivers?q=Juan");
    await expect(row(page, "Juan Dela Cruz")).toContainText(/Next: Day-off \w{3} \d{1,2}/);
    await page.goto("/drivers?q=Rey");
    await expect(row(page, "Rey Navarro")).toContainText("Inactive");
  });

  test("filters by Status today and shows the empty message", async ({ page }) => {
    await page.goto("/drivers?status=day_off");
    await expect(page.getByRole("link", { name: "Ramon Cruz" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Danilo Ramos" })).toHaveCount(0);
    await page.goto("/drivers?status=day_off&q=nobody-matches");
    await expect(page.getByText("No drivers match.")).toBeVisible();
  });

  test("shows the stale banner, filters with Show them, and dismisses for the session", async ({ page }) => {
    await page.goto("/drivers");
    const banner = page.getByRole("status").filter({ hasText: "on open-ended leave for 14 days or more" });
    await expect(banner).toContainText("1 driver has been on open-ended leave for 14 days or more.");
    await banner.getByRole("link", { name: "Show them" }).click();
    await expect(page).toHaveURL(/stale=1/);
    await expect(page.getByRole("link", { name: "Danilo Ramos" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Arnel Flores" })).toHaveCount(0);
    await expect(page.getByText("Showing stale leaves.")).toBeVisible();
    await page.getByRole("link", { name: "Clear", exact: true }).click();
    await expect(page).not.toHaveURL(/stale=1/);
    await page.getByRole("button", { name: "Dismiss" }).click();
    await expect(banner).toHaveCount(0);
    await page.reload();
    await expect(page.getByText("on open-ended leave for 14 days or more")).toHaveCount(0);
  });

  test("previews the Assign driver dropdown with hidden counts", async ({ page }) => {
    await page.goto("/drivers");
    const panel = page.locator("[data-slot=popover-content]");
    // Retry the click until the page has hydrated and the popover opens.
    await expect(async () => {
      await page.getByRole("button", { name: "Preview dropdown" }).click();
      await expect(panel).toBeVisible({ timeout: 1000 });
    }).toPass();
    await expect(panel).toContainText("What the Assign driver dropdown lists on");
    await expect(panel).toContainText(/Hidden on this date: .*on day-off or leave/);
    await expect(panel).toContainText("Stale leave flags don't change who is available.");
  });

  test("opens the Add driver modal, validates, and closes on Escape", async ({ page }) => {
    await page.goto("/drivers");
    await page.getByRole("button", { name: "Add a driver" }).click();
    const dialog = page.getByRole("dialog", { name: "Add driver" });
    await expect(dialog).toContainText("Day-off and On-leave are scheduled from the driver profile");
    await dialog.getByRole("button", { name: "Save driver" }).click();
    await expect(dialog).toContainText("Enter the full name.");
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
  });
});
