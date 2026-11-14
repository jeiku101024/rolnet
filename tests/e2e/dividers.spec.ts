import { test, expect, type Page } from "@playwright/test";

// Feature 016 (US3): no stray line above a list toolbar or below a pagination footer. The lines came from
// `.data-region` drawing a border on its top and bottom edge inside the card; the card keeps its own outline.
// Runs in demo mode on the phone viewport (playwright.config.ts) and again at a desktop width.

const listPages = [
  "/units",
  "/drivers",
  "/remittances?view=list",
  "/expenses",
  "/audit",
  "/settings/staff",
  "/sinking-fund",
  "/sinking-fund?view=participants",
  "/sinking-fund?view=top",
];

async function settle(page: Page) {
  await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => undefined);
}

async function checkNoStrayLines(page: Page, path: string) {
  await page.goto(path);
  await settle(page);
  const regions = await page.evaluate(() => [...document.querySelectorAll(".data-region")].map((element) => {
    const style = getComputedStyle(element);
    return { top: style.borderTopWidth, bottom: style.borderBottomWidth, left: style.borderLeftWidth, right: style.borderRightWidth };
  }));
  for (const region of regions) expect(region, `${path}: a list card draws no line on its top or bottom edge`).toEqual({ top: "0px", bottom: "0px", left: "0px", right: "0px" });
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow, `${path}: nothing scrolls sideways`).toBeLessThanOrEqual(0);
  return regions.length;
}

test.describe("divider lines (feature 016)", () => {
  test.describe.configure({ timeout: 90_000 });

  for (const width of [360, 1280]) {
    test(`list cards draw no line on their top or bottom edge at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      let cards = 0;
      for (const path of listPages) cards += await checkNoStrayLines(page, path);
      expect(cards, "at least the main lists use the shared list card").toBeGreaterThanOrEqual(4);
    });
  }

  test("the card keeps its outline and the toolbar and footer keep clear spacing", async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 900 });
    await page.goto("/units");
    await settle(page);
    const card = page.locator("[data-slot=card]").filter({ has: page.locator(".data-region") }).first();
    const outline = await card.evaluate((element) => {
      const style = getComputedStyle(element);
      return { radius: style.borderTopLeftRadius, ring: style.boxShadow };
    });
    expect(outline.radius).not.toBe("0px");
    expect(outline.ring).not.toBe("none");
    const toolbarTop = await page.locator("input[type=search]").first().evaluate((element) => element.getBoundingClientRect().top);
    const cardTop = await card.evaluate((element) => element.getBoundingClientRect().top);
    expect(toolbarTop - cardTop).toBeGreaterThan(8);
  });
});
