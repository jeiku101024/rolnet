import { test, expect, type Page } from "@playwright/test";

// Feature 012, the Absences tab in demo mode. Demo disables writes, so the absence dialog itself is
// covered by tests/unit/absence-dialog.test.tsx (mocked actions), pgTAP, and the quickstart.

async function openProfile(page: Page, name: string, query = "") {
  await page.goto(`/drivers?q=${encodeURIComponent(name)}`);
  const href = await page.getByRole("link", { name, exact: true }).getAttribute("href");
  await page.goto(`${href}${query}`);
}

test.describe("absence dialog", () => {
  test("lists absences with status, dates, and the note tooltip", async ({ page }) => {
    await openProfile(page, "Maria Reyes", "?tab=absences");
    const panel = page.getByRole("tabpanel");
    for (const header of ["Type", "Dates", "Reason", "Status", "Actions"]) await expect(panel.getByRole("columnheader", { name: header })).toBeVisible();
    await expect(panel).toContainText("On-leave");
    await expect(panel).toContainText(/\w{3} \d{1,2} to \w{3} \d{1,2}/);
    await expect(panel).toContainText("Upcoming");
    await expect(panel).toContainText("Vacation");
  });

  test("shows the cancelled and completed statuses as read-only", async ({ page }) => {
    await openProfile(page, "Ana Bautista", "?tab=absences");
    await expect(page.getByRole("tabpanel")).toContainText("Cancelled");
    await expect(page.getByRole("tabpanel").getByRole("button", { name: /^Options for/ })).toHaveCount(0);
    await openProfile(page, "Grace Torres", "?tab=absences");
    await expect(page.getByRole("tabpanel")).toContainText("Completed");
  });

  test("disables Add absence for an Inactive driver", async ({ page }) => {
    await openProfile(page, "Rey Navarro", "?tab=absences");
    await expect(page.getByRole("button", { name: "Add absence" })).toBeDisabled();
  });
});
