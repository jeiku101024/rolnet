import { test, expect } from "@playwright/test";

// Feature 006 (US3–US7) in demo mode. The SC-004 baseline (old dashboard at 360 px with the same
// demo rows) is 4437 px, recorded in specs/006-pagination-dashboard-refresh/validation.md.
const baselineHeight = 4437;

test.describe("dashboard refresh", () => {
  test("puts the bands in priority order and keeps every panel short", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page.getByRole("heading", { level: 2, name: "Needs attention" })).toBeVisible();
    const bands = await page.locator("main section[aria-labelledby^=band-] > div > h2").allInnerTexts();
    expect(bands).toEqual(["Needs attention", "Fleet status", "This month", "Recent activity"]);
    // At most 5 rows per panel, and 3 of them visible on a phone (the rest are behind "View all").
    for (const list of await page.locator("main ul.panel-rows").all()) {
      expect(await list.locator(":scope > li").count()).toBeLessThanOrEqual(5);
      expect(await list.locator(":scope > li:visible").count()).toBeLessThanOrEqual(3);
    }
  });

  test("lists the most urgent items first", async ({ page }) => {
    await page.goto("/dashboard");
    const documents = page.locator("[aria-labelledby=panel-documents] li");
    await expect(documents.first()).toContainText("Expired 3 days ago");
    await expect(documents.nth(1)).toContainText("Expires in 2 days");
    const maintenance = page.locator("[aria-labelledby=panel-maintenance]");
    await expect(maintenance.getByRole("link", { name: /View all 7/ })).toHaveAttribute("href", "/maintenance?due=1");
  });

  test("shows extradors and units in repair instead of recent drivers and units", async ({ page }) => {
    await page.goto("/dashboard");
    const extradors = page.locator("[aria-labelledby=panel-extradors] li");
    await expect(extradors).toHaveCount(3);
    await expect(extradors.first()).toContainText("Pedro Santos");
    await expect(extradors.first()).toContainText("Body T-003 today");
    await expect(extradors.nth(1)).toContainText("Not assigned");
    const repairs = page.locator("[aria-labelledby=panel-in-repair] li");
    await expect(repairs).toHaveCount(2);
    await expect(repairs.first()).toContainText("In repair for 9 days");
    await expect(repairs.nth(1)).toContainText("In repair");
    for (const removed of ["Recent units", "Recent drivers", "This month by unit"]) await expect(page.getByRole("heading", { name: removed })).toHaveCount(0);
  });

  test("shows month figures and charts with text values", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page.getByRole("list", { name: /Fleet figures for/ }).getByRole("listitem")).toHaveCount(6);
    // On a phone the charts are folded behind "Show charts".
    await expect(page.getByRole("heading", { name: "Collected vs expenses by unit" })).toBeHidden();
    await page.getByRole("button", { name: /Show charts/ }).click();
    await expect(page.getByRole("button", { name: /Hide charts/ })).toHaveAttribute("aria-expanded", "true");
    await expect(page.getByRole("heading", { name: "Collected vs expenses by unit" })).toBeVisible();
    await expect(page.getByRole("img", { name: /collected in/ })).toBeVisible();
  });

  test("fits a 360 px phone without sideways scrolling and is much shorter than before", async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 800 });
    await page.goto("/dashboard");
    await expect(page.getByRole("heading", { name: "Recent activity" })).toBeVisible();
    const size = await page.evaluate(() => ({ width: document.scrollingElement!.scrollWidth, height: document.scrollingElement!.scrollHeight }));
    expect(size.width).toBeLessThanOrEqual(360);
    expect(size.height).toBeLessThanOrEqual(Math.round(baselineHeight * 0.6));
  });

  test("puts the headline figures in one row on a desktop screen", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/dashboard");
    await expect(page.getByRole("button", { name: /Show charts/ })).toBeHidden();
    await expect(page.getByRole("heading", { name: "Recent remittances" })).toBeVisible();
    const tiles = page.getByRole("list", { name: /Fleet figures for/ }).getByRole("listitem");
    const tops = await tiles.evaluateAll((items) => items.map((item) => Math.round(item.getBoundingClientRect().top)));
    expect(new Set(tops).size).toBe(1);
  });
});
