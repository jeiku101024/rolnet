import { test, expect, type Page } from "@playwright/test";

// Feature 010, in demo mode (360 px phone by default). Demo mode has no write path, so this checks
// the pre-seeded demo state and client-side behaviour; saving, the "Driver already assigned today"
// race and overwrites are covered by unit tests, pgTAP and the quickstart walkthrough.
// Demo data today: ROLNET-1 and ROLNET-3 to ROLNET-6 are assigned (ROLNET-1 already has a
// remittance, so it is locked for good); ROLNET-2 and ROLNET-7 are in repair; ROLNET-8 to ROLNET-11
// are open; ROLNET-12 is archived. Nothing is saved for future dates. See lib/demo/mode.ts.

const card = (page: Page, name: string) => page.getByRole("article", { name, exact: true });
const columns = async (page: Page) => new Set(await page.getByRole("article").evaluateAll((items) => items.map((item) => Math.round(item.getBoundingClientRect().left)))).size;
const count = (page: Page) => page.getByRole("status").filter({ hasText: "units assigned" });

test.describe("units daily assignment view", () => {
  test("switches from List view without a reload and opens on today", async ({ page }) => {
    await page.goto("/units");
    await page.evaluate(() => { (window as unknown as { marker: boolean }).marker = true; });
    await page.getByRole("button", { name: "Daily assignment view" }).click();
    await expect(page).toHaveURL(/view=daily/);
    expect(await page.evaluate(() => (window as unknown as { marker?: boolean }).marker)).toBe(true);
    await expect(page.getByRole("button", { name: /^Choose date, \w+day, \w+ \d{1,2}, \d{4}$/ })).toBeVisible();
    await expect(page.getByText("Today", { exact: true }).last()).toBeVisible();
    await expect(page.getByRole("searchbox")).toHaveCount(0);
    await expect(page.getByRole("button", { name: /^Filters/ })).toHaveCount(0);
    await expect(count(page)).toContainText("5 of 9 units assigned");
  });

  test("shows saved, locked, blocked and open cards, and hides archived units", async ({ page }) => {
    await page.goto("/units?view=daily");
    const saved = card(page, "ROLNET-3");
    await expect(saved).toContainText("Assigned");
    await expect(saved).toContainText("Saved");
    await expect(saved.getByLabel(/^Assign driver/)).toBeDisabled();
    await expect(saved.getByLabel(/^Assign driver/)).toHaveValue(/.+/);
    await expect(card(page, "ROLNET-1")).toContainText("A remittance is already recorded for this day.");
    await expect(card(page, "ROLNET-1").getByRole("button", { name: "Card options" })).toHaveCount(0);
    const blocked = card(page, "ROLNET-2, In repair");
    await expect(blocked).toContainText("Unit is in repair. Change its status on the unit page to assign a driver.");
    await expect(blocked.getByRole("link", { name: "Open unit" })).toBeVisible();
    await expect(card(page, "ROLNET-8").getByRole("button", { name: "Save assignment" })).toBeEnabled();
    await expect(page.getByRole("article", { name: /^ROLNET-12/ })).toHaveCount(0);
  });

  test("lists only drivers not saved on another unit, with their role", async ({ page }) => {
    await page.goto("/units?view=daily");
    const options = await card(page, "ROLNET-8").getByLabel(/^Assign driver/).locator("option").allTextContents();
    expect(options).not.toContain("Pedro Santos (Backup)");
    expect(options.some((option) => / \((Primary|Backup)\)$/.test(option))).toBe(true);
  });

  test("asks for a driver before saving", async ({ page }) => {
    await page.goto("/units?view=daily");
    await page.waitForLoadState("networkidle");
    await card(page, "ROLNET-8").getByRole("button", { name: "Save assignment" }).click();
    await expect(card(page, "ROLNET-8").getByRole("alert")).toHaveText("Choose a driver first");
  });

  test("unlocks a saved card from Card options, and confirms past-date edits once", async ({ page }) => {
    await page.goto("/units?view=daily");
    await page.waitForLoadState("networkidle");
    const saved = card(page, "ROLNET-4");
    await saved.getByRole("button", { name: "Card options" }).click();
    await page.getByRole("menuitem", { name: "Edit assignment" }).click();
    await expect(saved.getByLabel(/^Assign driver/)).toBeEnabled();
    await saved.getByRole("button", { name: "Cancel" }).click();
    await expect(saved.getByLabel(/^Assign driver/)).toBeDisabled();

    await page.getByRole("button", { name: "Previous day" }).click();
    await expect(page).toHaveURL(/date=\d{4}-\d{2}-\d{2}/);
    const past = card(page, "ROLNET-4");
    await past.getByRole("button", { name: "Card options" }).click();
    await page.getByRole("menuitem", { name: "Edit assignment" }).click();
    await expect(page.getByRole("alertdialog")).toContainText(/^You are editing an assignment from \w+ \d{1,2}\. Continue\?/);
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(past.getByLabel(/^Assign driver/)).toBeEnabled();
    await past.getByRole("button", { name: "Cancel" }).click();
    await card(page, "ROLNET-5").getByRole("button", { name: "Card options" }).click();
    await page.getByRole("menuitem", { name: "Edit assignment" }).click();
    await expect(page.getByRole("alertdialog")).toHaveCount(0);
  });

  test("pre-fills future dates without saving them, and tags them Upcoming", async ({ page }) => {
    await page.goto("/units?view=daily");
    await page.getByRole("button", { name: "Next day" }).click();
    await expect(page.getByText("Upcoming", { exact: true })).toBeVisible();
    await expect(count(page)).toContainText("0 of 9 units assigned");
    const suggested = card(page, "ROLNET-3");
    await expect(suggested).toContainText("Pre-filled from previous day");
    await expect(suggested.getByLabel(/^Assign driver/)).toContainText("Pedro Santos (Backup)");
    await page.reload();
    await expect(count(page)).toContainText("0 of 9 units assigned");
    await expect(card(page, "ROLNET-8")).not.toContainText("Pre-filled from previous day");
  });

  test("starts past dates empty, with no pre-fill", async ({ page }) => {
    await page.goto("/units?view=daily");
    await page.getByRole("button", { name: "Previous day" }).click();
    await expect(page).toHaveURL(/date=/);
    await expect(page.getByText("Pre-filled from previous day")).toHaveCount(0);
  });

  test("lays cards out 1, 2 and 4 per row with no sideways scroll at 360 px", async ({ page }) => {
    await page.goto("/units?view=daily");
    await expect(page.getByRole("article").first()).toBeVisible();
    expect(await columns(page)).toBe(1);
    expect(await page.evaluate(() => document.scrollingElement!.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
    await page.setViewportSize({ width: 768, height: 1000 });
    await expect.poll(() => columns(page)).toBe(2);
    await page.setViewportSize({ width: 1280, height: 1000 });
    await expect.poll(() => columns(page)).toBe(4);
  });
});

test.describe("blocked units over time", () => {
  test("blocks a unit from the day it went into repair, not before", async ({ page }) => {
    await page.goto("/units?view=daily");
    await expect(card(page, "ROLNET-7, In repair")).toBeVisible();
    // Wait for each day to load before stepping back again, or quick clicks can be lost.
    const picker = page.getByRole("button", { name: /^Choose date/ });
    for (let day = 0; day < 4; day++) {
      const shown = await picker.getAttribute("aria-label");
      await page.getByRole("button", { name: "Previous day" }).click();
      await expect(picker).not.toHaveAttribute("aria-label", shown ?? "");
    }
    await expect(card(page, "ROLNET-7")).toBeVisible();
    await expect(card(page, "ROLNET-2, In repair")).toBeVisible();
  });
});
