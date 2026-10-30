import { test, expect, type Page } from "@playwright/test";

// Feature 008, in demo mode (360 px phone by default). Demo data today: ROLNET-1 to ROLNET-8 have
// primary drivers; ROLNET-1 is already recorded; ROLNET-2 and ROLNET-7 are in repair; ROLNET-3's
// driver is off with Pedro Santos covering. See lib/demo/mode.ts.

const card = (page: Page, name: string) => page.getByRole("article", { name, exact: true });
const columns = async (page: Page) => new Set(await page.getByRole("article").evaluateAll((items) => items.map((item) => Math.round(item.getBoundingClientRect().left)))).size;

test.describe("remittances daily view", () => {
  test("opens on today's cards with no search, filters or sort", async ({ page }) => {
    await page.goto("/remittances");
    await expect(page.getByRole("button", { name: /^Choose date, / })).toBeVisible();
    await expect(page.getByText("Today", { exact: true }).last()).toBeVisible();
    await expect(page.getByRole("searchbox")).toHaveCount(0);
    await expect(page.getByRole("button", { name: /^Filters/ })).toHaveCount(0);
    await expect(page.getByRole("status").filter({ hasText: "recorded" })).toContainText("1 of 6 recorded");
    await expect(card(page, "ROLNET-1")).toContainText("Saved");
    await expect(card(page, "ROLNET-2, not operating")).toContainText("Not operating (in repair)");
  });

  test("shows the backup covering a day off", async ({ page }) => {
    await page.goto("/remittances");
    const backup = card(page, "ROLNET-3");
    await expect(backup).toContainText("Pedro Santos");
    await backup.getByRole("button", { name: /^Backup, covering for / }).focus();
    await expect(page.getByText(/^Covering for .+, day off\.$/)).toBeVisible();
  });

  test("updates the due as soon as the disposition changes", async ({ page }) => {
    await page.goto("/remittances");
    const unrecorded = card(page, "ROLNET-4");
    await expect(unrecorded).toContainText("₱180.00");
    await unrecorded.getByLabel(/^Disposition/).selectOption("overnight_overtime");
    await expect(unrecorded).toContainText("₱300.00");
  });

  test("switches views without a full reload", async ({ page }) => {
    await page.goto("/remittances");
    await page.evaluate(() => { (window as unknown as { marker: boolean }).marker = true; });
    await page.getByRole("button", { name: "List view" }).click();
    await expect(page).toHaveURL(/view=list/);
    await expect(page.getByRole("searchbox")).toBeVisible();
    await page.getByRole("button", { name: "Daily view" }).click();
    await expect(page).toHaveURL(/\/remittances$/);
    expect(await page.evaluate(() => (window as unknown as { marker?: boolean }).marker)).toBe(true);
  });

  test("lays cards out 1, 2 and 4 per row", async ({ page }) => {
    await page.goto("/remittances");
    await expect(page.getByRole("article").first()).toBeVisible();
    expect(await columns(page)).toBe(1);
    expect(await page.evaluate(() => document.scrollingElement!.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
    await page.setViewportSize({ width: 768, height: 1000 });
    await expect.poll(() => columns(page)).toBe(2);
    await page.setViewportSize({ width: 1280, height: 1000 });
    await expect.poll(() => columns(page)).toBe(4);
  });

  test("moves between days and blocks future dates", async ({ page }) => {
    await page.goto("/remittances");
    await expect(page.getByRole("button", { name: "Next day" })).toBeDisabled();
    await page.getByRole("button", { name: "Previous day" }).click();
    await expect(page).toHaveURL(/date=\d{4}-\d{2}-\d{2}/);
    await expect(page.getByRole("button", { name: "Next day" })).toBeEnabled();
    await page.getByRole("button", { name: "Today", exact: true }).click();
    await expect(page.getByRole("button", { name: "Next day" })).toBeDisabled();
    await page.getByRole("button", { name: /^Choose date, / }).click();
    await page.getByRole("button", { name: "Previous month" }).click();
    await page.getByRole("grid").getByRole("button").first().click();
    await expect(page).toHaveURL(/date=\d{4}-\d{2}-01/);
    await page.goto("/remittances?date=2099-01-01");
    await expect(page.getByRole("button", { name: "Next day" })).toBeDisabled();
  });

  test("asks before leaving a card with unsaved entries", async ({ page }) => {
    await page.goto("/remittances");
    // Type only after hydration, so the entry is the card's state and not just the server HTML.
    await page.waitForLoadState("networkidle");
    await card(page, "ROLNET-4").getByLabel("Payment received (₱)").fill("100");
    await page.getByRole("button", { name: "Previous day" }).click();
    await expect(page.getByRole("alertdialog")).toContainText("You have unsaved changes on 1 card. Leave without saving?");
    await page.getByRole("button", { name: "Stay" }).click();
    await expect(card(page, "ROLNET-4").getByLabel("Payment received (₱)")).toHaveValue("100");
  });
});

test.describe("remittances list view", () => {
  test("is a full-width, read-only history with the Daily view note", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 1000 });
    await page.goto("/remittances?view=list");
    await expect(page.getByText("Record daily remittance")).toHaveCount(0);
    await expect(page.getByText("The amount due is calculated from the unit’s disposition.")).toHaveCount(0);
    await expect(page.getByText("Open an entry to add a payment or edit notes")).toHaveCount(0);
    await expect(page.getByText("Turn on Daily view to record or correct each unit's remittance. List view shows all records, newest to oldest.")).toBeVisible();
    const [list, section] = await Promise.all([page.locator("[data-slot=card]").first().boundingBox(), page.locator("section.workspace > div").last().boundingBox()]);
    expect(Math.abs(list!.width - section!.width)).toBeLessThanOrEqual(2);
    expect(await page.locator("tbody tr").first().evaluate((row) => getComputedStyle(row).cursor)).not.toBe("pointer");
    const dates = await page.locator("tbody tr td:first-child").allTextContents();
    expect([...dates].sort().reverse()).toEqual(dates);
  });

  test("opens a row's date in Daily view", async ({ page }) => {
    await page.goto("/remittances?view=list");
    const first = page.locator("tbody tr td:first-child a").first();
    const date = (await first.textContent())!.trim();
    await first.click();
    await expect(page).toHaveURL(new RegExp(`date=${date}`));
    await expect(page.getByRole("button", { name: /^Choose date, / })).toBeVisible();
  });

  test("links the note's Daily view to today", async ({ page }) => {
    await page.goto("/remittances?view=list");
    await page.getByRole("link", { name: "Daily view", exact: true }).click();
    await expect(page).toHaveURL(/\/remittances$/);
    await expect(page.getByRole("button", { name: "Next day" })).toBeDisabled();
  });

  test("has a readable search placeholder, strong borders and a focus ring", async ({ page }) => {
    await page.goto("/remittances?view=list");
    const search = page.getByRole("searchbox");
    await expect(search).toHaveAttribute("placeholder", "Search by driver or unit");
    expect(await search.evaluate((input) => getComputedStyle(input, "::placeholder").color)).toBe("rgb(82, 97, 116)");
    expect(await search.evaluate((input) => getComputedStyle(input).color)).toBe("rgb(15, 27, 45)");
    for (const control of [search, page.getByRole("button", { name: /^Service date/ }), page.getByRole("button", { name: /^Filters/ }), page.getByLabel("Sort")]) {
      expect(await control.evaluate((element) => getComputedStyle(element).borderTopColor)).toBe("rgb(125, 137, 150)");
    }
    await search.focus();
    await page.keyboard.press("Shift+Tab");
    await page.keyboard.press("Tab");
    const outline = await search.evaluate((input) => ({ style: getComputedStyle(input).outlineStyle, color: getComputedStyle(input).outlineColor }));
    expect(outline.style).not.toBe("none");
    expect(outline.color).toBe("rgb(122, 75, 0)");
  });
});
