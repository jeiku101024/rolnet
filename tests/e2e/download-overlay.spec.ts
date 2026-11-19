import { test, expect, type Page } from "@playwright/test";

// Feature 019 (contracts/download-overlay.md), in demo mode: the workbook button at the end of each page's toolbar
// opens a download overlay that closes three ways, keeps focus inside, shows an error with Retry, and fits 360 px.

const pages = [
  { name: "Remittances (Daily view)", path: "/remittances", button: "Download report", url: "**/api/reports/monthly?*", file: /^rolnet-monthly-\d{4}-\d{2}-all-units\.xlsx$/ },
  { name: "Remittances (List view)", path: "/remittances?view=list", button: "Download report", url: "**/api/reports/monthly?*", file: /^rolnet-monthly-\d{4}-\d{2}-all-units\.xlsx$/ },
  { name: "Sinking fund", path: "/sinking-fund", button: "Download monthly standings", url: "**/api/sinking-fund/standings?*", file: /^rolnet-sinking-fund-standings-\d{4}-\d{2}\.xlsx$/ },
  { name: "Sinking fund (Top participants)", path: "/sinking-fund?view=top", button: "Download monthly standings", url: "**/api/sinking-fund/standings?*", file: /^rolnet-sinking-fund-standings-\d{4}-\d{2}\.xlsx$/ },
  { name: "Expenses", path: "/expenses", button: "Download report", url: "**/api/expenses/month?*", file: /^rolnet-expenses-\d{4}-\d{2}\.xlsx$/ },
];

async function open(page: Page, path: string, button: string) {
  await page.goto(path);
  await page.waitForLoadState("networkidle");
  const trigger = page.getByRole("button", { name: button });
  await trigger.click();
  await expect(page.getByRole("dialog")).toBeVisible();
  return trigger;
}

for (const { name, path, button, url, file } of pages) {
  test.describe(`download overlay: ${name}`, () => {
    test("has an accessible button, sits in the content area and not in the page header", async ({ page }) => {
      await page.goto(path);
      const trigger = page.getByRole("button", { name: button });
      await expect(trigger).toBeVisible();
      await expect(page.locator("header").getByRole("button", { name: button })).toHaveCount(0);
      await trigger.hover();
      await expect(page.getByRole("tooltip")).toHaveText(button);
    });

    test("keeps focus inside, closes with Escape, the Close button and an outside click, and returns focus", async ({ page }) => {
      const trigger = await open(page, path, button);
      for (let step = 0; step < 12; step++) {
        await page.keyboard.press("Tab");
        expect(await page.evaluate(() => Boolean(document.activeElement?.closest("[role=dialog]")))).toBe(true);
      }
      await page.keyboard.press("Escape");
      await expect(page.getByRole("dialog")).toHaveCount(0);
      await expect(trigger).toBeFocused();

      await trigger.click();
      await page.getByRole("button", { name: "Close" }).click();
      await expect(page.getByRole("dialog")).toHaveCount(0);

      await trigger.click();
      await page.mouse.click(2, 2);
      await expect(page.getByRole("dialog")).toHaveCount(0);
    });

    test("shows an error with Retry, keeps the overlay open, and Retry downloads", async ({ page }) => {
      await open(page, path, button);
      let calls = 0;
      await page.route(url, (route) => (calls++ === 0 ? route.abort() : route.continue()));
      await page.getByRole("button", { name: "Download .xlsx" }).click();
      await expect(page.getByText("Could not reach the server")).toBeVisible();
      await expect(page.getByRole("dialog")).toBeVisible();
      const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Retry" }).click()]);
      expect(download.suggestedFilename()).toMatch(file);
    });

    test("fits a 360 px screen without sideways scrolling, button and overlay", async ({ page }) => {
      await page.setViewportSize({ width: 360, height: 800 });
      await open(page, path, button);
      expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
      const box = await page.getByRole("dialog").boundingBox();
      expect(box!.x).toBeGreaterThanOrEqual(0);
      expect(box!.x + box!.width).toBeLessThanOrEqual(360);
    });

    test("uses the dark theme tokens", async ({ page }) => {
      await page.emulateMedia({ colorScheme: "dark" });
      await open(page, path, button);
      const background = await page.getByRole("dialog").evaluate((element) => getComputedStyle(element).backgroundColor);
      const text = await page.getByRole("dialog").evaluate((element) => getComputedStyle(element).color);
      expect(background).not.toBe(text);
    });
  });
}
