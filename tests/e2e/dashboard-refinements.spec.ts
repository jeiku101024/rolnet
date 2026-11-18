import { test, expect, type Page } from "@playwright/test";

// Feature 017 in demo mode: equal-height charts row, "Show all units" pop-up, unpaid sinking fund loans card.
// On phones the charts sit behind a "Show charts" button, so open it first when it is visible.
async function openDashboard(page: Page) {
  await page.goto("/dashboard");
  await expect(page.getByRole("heading", { level: 2, name: "Needs attention" })).toBeVisible();
  const fold = page.getByRole("button", { name: /Show charts/ });
  if (await fold.isVisible()) await fold.click();
}

const card = (page: Page, title: string) => page.locator("[data-slot=card]").filter({ has: page.getByRole("heading", { name: title }) });

test.describe("dashboard refinements: unit pop-up", () => {
  test("opens every unit in a pop-up without moving the page, and closes three ways", async ({ page }) => {
    await openDashboard(page);
    const trigger = page.getByRole("button", { name: /^Show all \d+ units$/ });
    await expect(trigger).toBeVisible();
    const total = Number((await trigger.innerText()).match(/\d+/)?.[0]);
    const before = await page.evaluate(() => document.body.scrollHeight);
    const requests: string[] = [];
    page.on("request", (request) => { if (["fetch", "xhr"].includes(request.resourceType()) || request.url().includes("_rsc")) requests.push(request.url()); });

    await trigger.click();
    const dialog = page.getByRole("dialog", { name: "All units" });
    await expect(dialog).toBeVisible();
    await expect(dialog.locator("li")).toHaveCount(total);
    expect(await page.evaluate(() => document.body.scrollHeight)).toBe(before);
    await expect(dialog.getByRole("button", { name: "Close" })).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await trigger.click();
    await dialog.getByRole("button", { name: "Close" }).click();
    await expect(dialog).toBeHidden();
    await trigger.click();
    await page.mouse.click(2, 2);
    await expect(dialog).toBeHidden();

    expect(await page.evaluate(() => document.body.scrollHeight)).toBe(before);
    expect(requests).toEqual([]);
  });

  test("keeps the card at five units", async ({ page }) => {
    await openDashboard(page);
    await expect(card(page, "Collected vs expenses by unit").locator("ul > li")).toHaveCount(5);
  });
});

test.describe("dashboard refinements: equal height", () => {
  test("Daily collections and Collected vs expenses share top and bottom edges on a wide screen", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await openDashboard(page);
    const left = await card(page, "Daily collections").boundingBox();
    const right = await card(page, "Collected vs expenses by unit").boundingBox();
    expect(left && right).toBeTruthy();
    expect(Math.abs(left!.y - right!.y)).toBeLessThan(1);
    expect(Math.abs(left!.y + left!.height - (right!.y + right!.height))).toBeLessThan(1);
    await page.getByRole("button", { name: /^Show all \d+ units$/ }).click();
    await page.keyboard.press("Escape");
    const after = await card(page, "Daily collections").boundingBox();
    expect(Math.abs(after!.height - left!.height)).toBeLessThan(1);
  });

  test("stacks at 360 px with no sideways scroll", async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 800 });
    await openDashboard(page);
    const first = await card(page, "Daily collections").boundingBox();
    const second = await card(page, "Collected vs expenses by unit").boundingBox();
    expect(second!.y).toBeGreaterThanOrEqual(first!.y + first!.height - 1);
    await page.getByRole("button", { name: /^Show all \d+ units$/ }).click();
    const dialog = page.getByRole("dialog", { name: "All units" });
    const box = await dialog.boundingBox();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(360);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });
});

test.describe("dashboard refinements: unpaid sinking fund loans", () => {
  test("adds a third Needs attention card with borrowers largest first", async ({ page }) => {
    await page.setViewportSize({ width: 1536, height: 900 });
    await page.goto("/dashboard");
    for (const id of ["panel-documents", "panel-balances", "panel-loans"]) await expect(page.locator(`[aria-labelledby=${id}]`)).toBeVisible();
    const rows = page.locator("[aria-labelledby=panel-loans] li");
    // Demo data: Cora (overdue, 2 000 less 400 principal paid), Ana and Dino are open; Ben (paid) and Elena (withdrawn) are not.
    await expect(rows.first()).toContainText("Cora Santos");
    await expect(rows.first()).toContainText("Overdue");
    const names = await rows.locator("a").allInnerTexts();
    expect(names).toContain("Ana Reyes");
    expect(names).toContain("Dino Lim");
    expect(names).not.toContain("Ben Cruz");
    expect(names).not.toContain("Elena Ramos");
    await expect(page.locator("[aria-labelledby=panel-loans]").getByRole("link", { name: /^View all/ }).or(page.locator("[aria-labelledby=panel-loans] a[href='/sinking-fund']").first())).toHaveAttribute("href", "/sinking-fund");
  });

  test("stacks the three cards at 360 px with no sideways scroll", async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 800 });
    await page.goto("/dashboard");
    const loans = page.locator("[aria-labelledby=panel-loans]");
    await expect(loans).toBeVisible();
    expect(await loans.locator("ul.panel-rows > li:visible").count()).toBeLessThanOrEqual(3);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });
});
