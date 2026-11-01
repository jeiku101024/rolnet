import { test, expect, type Page } from "@playwright/test";

// Feature 010 (User Stories 5 and 6), in demo mode. ROLNET-12 is the archived demo unit. Demo mode
// has no write path: confirming an archive, restoring and adding a unit are covered by unit tests
// (tests/unit/unit-dialogs.test.tsx), pgTAP and the quickstart walkthrough.

const row = (page: Page, name: string) => page.locator("tbody tr").filter({ has: page.getByRole("link", { name, exact: true }) });

test.describe("units list", () => {
  test("hides archived units until Show archived is ticked", async ({ page }) => {
    await page.goto("/units?q=ROLNET");
    await expect(row(page, "ROLNET-12")).toHaveCount(0);
    await page.getByRole("checkbox", { name: "Show archived (1)" }).click();
    await expect(page).toHaveURL(/archived=1/);
    const archived = row(page, "ROLNET-12");
    await expect(archived).toContainText("Archived");
    await archived.getByRole("button", { name: "Unit options" }).click();
    await expect(page.getByRole("menuitem", { name: "More info" })).toBeVisible();
    await expect(page.getByRole("menuitem", { name: "Restore" })).toBeVisible();
    await expect(page.getByRole("menuitem", { name: "Archive" })).toHaveCount(0);
  });

  test("shows status as a badge and no Delete anywhere", async ({ page }) => {
    await page.goto("/units");
    await expect(page.locator("tbody select")).toHaveCount(0);
    await row(page, "ROLNET-1").getByRole("button", { name: "Unit options" }).click();
    await expect(page.getByRole("menuitem", { name: "More info" })).toHaveAttribute("href", /\/units\//);
    await expect(page.getByRole("menuitem", { name: "Archive" })).toBeVisible();
    await expect(page.getByRole("menuitem", { name: /Delete/ })).toHaveCount(0);
  });

  test("opens the archive confirmation with the counts, Cancel focused, and closes on Escape", async ({ page }) => {
    await page.goto("/units");
    await page.waitForLoadState("networkidle");
    await row(page, "ROLNET-1").getByRole("button", { name: "Unit options" }).click();
    await page.getByRole("menuitem", { name: "Archive" }).click();
    const dialog = page.getByRole("alertdialog");
    await expect(dialog).toContainText("Archive ROLNET-1?");
    await expect(dialog).toContainText("No records are deleted.");
    for (const label of ["Driver assigned today", "Assignment records", "Remittances", "Expenses", "Documents", "Audit history entries"]) await expect(dialog).toContainText(label);
    await expect(page.getByRole("button", { name: "Cancel" })).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
  });

  test("opens the Add a unit modal and shows inline errors", async ({ page }) => {
    await page.goto("/units");
    await page.waitForLoadState("networkidle");
    await page.getByRole("button", { name: "Add a unit" }).click();
    await page.getByRole("button", { name: "Save unit" }).click();
    await expect(page.getByText("Enter the plate number.")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("button", { name: "Save unit" })).toHaveCount(0);
  });

  test("opens a row menu upward near the bottom of the screen, never clipped", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 700 });
    await page.goto("/units");
    await page.waitForLoadState("networkidle");
    const trigger = page.getByRole("button", { name: "Unit options" }).last();
    // Pin the last row's button to the bottom edge, so there is no room for the menu below it.
    await trigger.evaluate((element) => { element.scrollIntoView({ block: "end" }); window.scrollBy(0, -8); });
    await trigger.click();
    const [menu, button] = await Promise.all([page.getByRole("menu").boundingBox(), trigger.boundingBox()]);
    expect(menu!.y + menu!.height).toBeLessThanOrEqual(button!.y + 1);
    expect(menu!.y).toBeGreaterThanOrEqual(0);
  });

  test("hides the archived unit from both daily views", async ({ page }) => {
    await page.goto("/units?view=daily");
    await expect(page.getByRole("article").first()).toBeVisible();
    await expect(page.getByRole("article", { name: /^ROLNET-12/ })).toHaveCount(0);
    await page.goto("/remittances");
    await expect(page.getByRole("article").first()).toBeVisible();
    await expect(page.getByRole("article", { name: /^ROLNET-12/ })).toHaveCount(0);
  });
});
