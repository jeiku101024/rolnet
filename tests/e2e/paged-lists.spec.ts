import { test, expect, type Page } from "@playwright/test";

// Feature 006 (US1, US2). Runs against demo mode (NEXT_PUBLIC_DEMO_MODE=true), like the rest of the suite.

const pagination = (page: Page) => page.getByRole("navigation", { name: "Pagination" });

async function expectNoSidewaysScroll(page: Page) {
  const overflow = await page.evaluate(() => document.scrollingElement!.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
}

test.describe("paged lists", () => {
  test("show 10 rows at a time with a range label and working controls", async ({ page }) => {
    await page.goto("/remittances?view=list");
    await expect(page.locator("tbody tr")).toHaveCount(10);
    await expect(pagination(page)).toContainText("1–10 of 30 records");
    await expect(pagination(page)).toContainText("Page 1 of 3");
    await expect(pagination(page).locator('[aria-disabled="true"]')).toHaveCount(2);
    await pagination(page).getByRole("link", { name: "Last page" }).click();
    await expect(page).toHaveURL(/page=3/);
    await expect(pagination(page)).toContainText("21–30 of 30 records");
    await page.reload();
    await expect(pagination(page)).toContainText("Page 3 of 3");
    // Leave to another page and come back. (Detail pages have no demo data, so a list page is used.)
    await page.goto("/drivers");
    await page.goBack();
    await expect(page).toHaveURL(/\/remittances\?.*page=3/);
    await expect(pagination(page)).toContainText("Page 3 of 3");
    await expectNoSidewaysScroll(page);
  });

  test("turn bad page numbers into the nearest real page", async ({ page }) => {
    for (const [query, expected] of [["page=0", "Page 1 of 3"], ["page=abc", "Page 1 of 3"], ["page=999", "Page 3 of 3"]]) {
      await page.goto(`/remittances?${query}`);
      await expect(pagination(page)).toContainText(expected);
    }
  });

  test("search every record, not just the current page", async ({ page }) => {
    await page.goto("/drivers?page=2");
    const search = page.getByRole("searchbox", { name: "Search drivers" });
    await search.fill("Navarro");
    await expect(page).toHaveURL(/q=Navarro/);
    await expect(page).not.toHaveURL(/page=/);
    await expect(page.locator("tbody tr")).toHaveCount(1);
    await expect(page.getByText("Rey Navarro")).toBeVisible();
    await search.fill("zzzz");
    await expect(page.getByText('No records match "zzzz".')).toBeVisible();
    await page.getByRole("link", { name: "Clear search" }).click();
    await expect(page.locator("tbody tr")).toHaveCount(10);
  });

  test("keep focus and text while results load mid-typing", async ({ page }) => {
    await page.goto("/drivers");
    const search = page.getByRole("searchbox", { name: "Search drivers" });
    await search.click();
    await page.keyboard.type("Re", { delay: 100 });
    await expect(page).toHaveURL(/q=Re/);
    await expect(search).toBeFocused();
    await page.keyboard.type("y Nav", { delay: 100 });
    await expect(search).toHaveValue("Rey Nav");
    await expect(page).toHaveURL(/q=Rey\+Nav/);
    await expect(page.locator("tbody tr")).toHaveCount(1);
  });

  test("keep the search field clear of the table's header rule", async ({ page }) => {
    await page.goto("/drivers");
    const search = page.getByRole("searchbox", { name: "Search drivers" });
    await expect(search).toBeVisible();
    await expect(page.locator("label:has(input[type=search]) svg")).toBeVisible();
    const searchBox = (await search.boundingBox())!;
    const headerBox = (await page.locator("thead").boundingBox())!;
    expect(headerBox.y).toBeGreaterThan(searchBox.y + searchBox.height + 8);
  });

  test("open the dashboard's filtered View all lists", async ({ page }) => {
    await page.goto("/units?status=in_repair");
    await page.getByRole("button", { name: "Filters (1 on)" }).click();
    await expect(page.getByRole("group", { name: "Filters" }).getByRole("combobox", { name: "Status", exact: true })).toHaveValue("in_repair");
    await expect(page.locator("tbody tr")).toHaveCount(2);
    await page.goto("/drivers?kind=backup");
    await expect(page.locator("tbody tr")).toHaveCount(3);
  });

  test("page a detail-page list without moving the others", async ({ page }) => {
    await page.goto("/audit");
    await expect(pagination(page)).toContainText("1–10 of 15 records");
    await pagination(page).getByRole("link", { name: "Next page" }).click();
    await expect(page).toHaveURL(/\/audit\?page=2/);
    await expect(page.locator("main li")).toHaveCount(5);
  });
});
