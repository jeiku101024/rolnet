import { test, expect, type Page } from "@playwright/test";

// Feature 012, US5 and US6 notices, in demo mode. See tests/e2e/drivers-list.spec.ts for the demo data.

async function openProfile(page: Page, name: string, query = "") {
  await page.goto(`/drivers?q=${encodeURIComponent(name)}`);
  const href = await page.getByRole("link", { name, exact: true }).getAttribute("href");
  await page.goto(`${href}${query}`);
}

test.describe("driver profile", () => {
  test("is one column with header controls, summary strip, details, and tabs", async ({ page }) => {
    await openProfile(page, "Juan Dela Cruz");
    await expect(page.getByRole("link", { name: "Back to drivers" })).toBeVisible();
    await expect(page.getByRole("heading", { level: 1, name: "Juan Dela Cruz" })).toBeVisible();
    await expect(page.getByRole("radiogroup", { name: "Driver role" })).toBeVisible();
    await expect(page.getByLabel("Status for Juan Dela Cruz")).toHaveValue("active");
    for (const label of ["Today's unit", "Remittances (last 30 days)", "Balance owed", "Next absence"]) await expect(page.getByText(label, { exact: true })).toBeVisible();
    await expect(page.getByText(/Day-off scheduled \w{3} \d{1,2}\./)).toBeVisible();
    await expect(page.getByRole("tab", { name: "Assignments" })).toHaveAttribute("aria-selected", "true");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });

  test("shows at most 8 rows per tab, and moves between tabs with the keyboard", async ({ page }) => {
    // Juan has exactly 8 demo remittances: all 8 show and there is no Load more (more rows are covered by tab-params tests).
    await openProfile(page, "Juan Dela Cruz", "?tab=remittances");
    const panel = page.getByRole("tabpanel");
    await expect(panel.getByRole("row")).toHaveCount(9);
    await expect(panel.getByRole("link", { name: "Load more" })).toHaveCount(0);
    await page.getByRole("tab", { name: "Remittances" }).focus();
    await page.keyboard.press("ArrowRight");
    await expect(page).toHaveURL(/tab=roles/);
    await expect(page.getByRole("tab", { name: "Role history" })).toHaveAttribute("aria-selected", "true");
  });

  test("keeps the role from each record's date and logs role history", async ({ page }) => {
    await openProfile(page, "Pedro Santos", "?tab=roles");
    await expect(page.getByRole("tabpanel")).toContainText("Primary → Backup");
    await expect(page.getByRole("radio", { name: "Backup" })).toHaveAttribute("aria-checked", "true");
  });

  test("shows the stale notice with its three actions", async ({ page }) => {
    await openProfile(page, "Danilo Ramos");
    const notice = page.getByRole("status").filter({ hasText: "Open-ended for 16 days" });
    await expect(notice).toContainText("Set an end date or end the leave.");
    for (const action of ["Set end date", "End leave now", "Still on leave"]) await expect(notice.getByRole("button", { name: action })).toBeVisible();
    await expect(page.getByLabel("Status for Danilo Ramos")).toHaveValue("on_leave");
  });

  test("shows the checked line while a stale leave is snoozed", async ({ page }) => {
    await openProfile(page, "Arnel Flores", "?tab=absences");
    await expect(page.getByText(/No end date yet\..* Checked \w{3} \d{1,2}\. Flag returns \w{3} \d{1,2} if still open\./)).toBeVisible();
    await expect(page.getByRole("tabpanel")).toContainText(/Checked \w{3} \d{1,2}/);
  });

  test("shows the Inactive notice", async ({ page }) => {
    await openProfile(page, "Rey Navarro");
    await expect(page.getByText("Inactive: this driver has left. Hidden from assignment dropdowns. Past records stay visible.")).toBeVisible();
  });
});

test.describe("driver profile on a desktop", () => {
  test.use({ viewport: { width: 1440, height: 900 }, isMobile: false, hasTouch: false });

  test("fits the header, summary strip, and details without scrolling", async ({ page }) => {
    await openProfile(page, "Juan Dela Cruz");
    const bottom = await page.getByText("Notes", { exact: true }).evaluate((element) => element.getBoundingClientRect().bottom);
    expect(bottom).toBeLessThanOrEqual(900);
    const cards = await page.getByText("Balance owed", { exact: true }).evaluate((element) => element.getBoundingClientRect().top);
    const first = await page.getByText("Today's unit", { exact: true }).evaluate((element) => element.getBoundingClientRect().top);
    expect(Math.abs(cards - first)).toBeLessThan(4);
  });
});
