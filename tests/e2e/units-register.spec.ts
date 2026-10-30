import { test, expect, type Page } from "@playwright/test";

// Feature 007, in demo mode on a 360 px phone (the suite's device). Demo units are ROLNET-1 to
// ROLNET-12 (body numbers T-001…); see demoUnitAssignments in lib/demo/mode.ts for who drives them.

const headers = ["Unit", "Body number", "Plate", "Motorcycle", "Current driver", "Mileage", "Status"];
const row = (page: Page, name: string) => page.locator("tbody tr").filter({ has: page.getByRole("link", { name, exact: true }) });

test.describe("units register", () => {
  test("shows the unit name, body number and motorcycle in their own columns", async ({ page }) => {
    await page.goto("/units");
    await expect(page.locator("thead th")).toHaveText(headers);
    const first = page.locator("tbody tr").first();
    await expect(first.locator("td").nth(0)).toHaveText("ROLNET-1");
    await expect(first.getByRole("link", { name: "ROLNET-1", exact: true })).toHaveAttribute("href", /\/units\//);
    await expect(first.locator("td").nth(1)).toHaveText("T-001");
    await expect(row(page, "ROLNET-2").locator("td").nth(3)).toHaveText("Yamaha YTX");
    await expect(page.getByLabel("Unit name")).toBeVisible();
    await expect(page.getByLabel("Motorcycle")).toBeVisible();
  });

  test("searches and sorts by name", async ({ page }) => {
    await page.goto("/units?q=ROLNET-2");
    await expect(page.locator("tbody tr")).toHaveCount(1);
    await expect(page.locator("tbody tr td").first()).toHaveText("ROLNET-2");
    await page.goto("/units?sort=name-desc");
    await expect(page.locator("tbody tr td").first()).toHaveText("ROLNET-9");
  });

  test("shows who drives each unit today", async ({ page }) => {
    await page.goto("/units?q=ROLNET");
    const driverCell = (name: string) => row(page, name).locator("td").nth(4);
    await expect(driverCell("ROLNET-1")).toHaveText("Juan Dela Cruz");
    await expect(driverCell("ROLNET-2")).toHaveText("Day off · no backup");
    await expect(driverCell("ROLNET-3")).toHaveText(/Pedro Santos\s*Backup/);
    await expect(driverCell("ROLNET-10")).toHaveText("Unassigned");
  });

  test("never scrolls the page sideways at 360 px", async ({ page }) => {
    await page.goto("/units");
    await expect(page.locator("tbody tr").first()).toBeVisible();
    expect(await page.evaluate(() => document.scrollingElement!.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
  });
});
