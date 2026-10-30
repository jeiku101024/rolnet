import { test, expect, type Page } from "@playwright/test";
import { addDays, fleetToday } from "../../lib/dates/fleet-date";

// Feature 006, User Story 8, in demo mode on a 360 px phone (the suite's device).

const today = fleetToday();
const filtersPanel = (page: Page) => page.getByRole("group", { name: "Filters" });
const filter = (page: Page, name: string) => filtersPanel(page).getByRole("combobox", { name, exact: true });
const sort = (page: Page) => page.getByRole("combobox", { name: "Sort", exact: true });

async function setFilters(page: Page, choices: Record<string, string>) {
  await page.getByRole("button", { name: /^Filters/ }).click();
  for (const [name, label] of Object.entries(choices)) await filter(page, name).selectOption({ label });
  await page.getByRole("button", { name: "Apply filters" }).click();
}

test.describe("list sort and filter", () => {
  test("narrow expenses by unit, category and date, sorted by amount", async ({ page }) => {
    await page.goto("/expenses");
    await setFilters(page, { Unit: "Body T-003", Category: "Fuel" });
    await expect(page).toHaveURL(/unit=.*category=|category=.*unit=/);
    await expect(filtersPanel(page)).toBeHidden();
    await page.getByRole("button", { name: "Expense date: Any date" }).click();
    await page.getByRole("button", { name: "Custom…" }).click();
    await page.getByLabel("From").fill(addDays(today, -9));
    await expect(page).toHaveURL(/from=/);
    await sort(page).selectOption({ label: "Amount, highest first" });
    await expect(page).toHaveURL(/sort=amount-desc/);
    const rows = page.locator("tbody tr");
    await expect(rows).toHaveCount(2);
    await expect(rows.nth(0)).toContainText("₱550.00");
    await expect(rows.nth(1)).toContainText("₱350.00");
    await expect(page.getByRole("button", { name: "Filters (2 on)" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Remove filter Category: Fuel" })).toBeVisible();
  });

  test("pick a quick date range", async ({ page }) => {
    await page.goto("/remittances?view=list");
    await page.getByRole("button", { name: "Service date: Any date" }).click();
    await page.getByRole("button", { name: "This month" }).click();
    await expect(page).toHaveURL(new RegExp(`from=${today.slice(0, 8)}01&to=${today}`));
    await expect(page.getByRole("button", { name: "Service date: This month" })).toBeVisible();
    await page.getByRole("button", { name: "Any date" }).click();
    await expect(page).not.toHaveURL(/from=/);
  });

  test("sort drivers by license expiry", async ({ page }) => {
    await page.goto("/drivers?sort=license");
    await expect(page.locator("tbody tr").first()).toContainText("Maria Reyes");
  });

  test("restart at page 1 when a filter changes", async ({ page }) => {
    await page.goto("/remittances?page=3");
    await setFilters(page, { Disposition: "Returned" });
    await expect(page).toHaveURL(/disposition=returned/);
    await expect(page).not.toHaveURL(/page=/);
  });

  test("remove one chip, then clear all but keep the search text and sort", async ({ page }) => {
    await page.goto("/expenses?q=Gasoline&receipt=attached&category=00000000-0000-4000-8000-000000000021&sort=oldest");
    await page.getByRole("button", { name: "Remove filter Receipt: Attached" }).click();
    await expect(page).not.toHaveURL(/receipt=/);
    await page.getByRole("button", { name: "Clear all" }).click();
    await expect(page).toHaveURL(/\/expenses\?q=Gasoline&sort=oldest$/);
    await expect(page.getByRole("searchbox", { name: "Search expenses" })).toHaveValue("Gasoline");
  });

  test("keep the filter panel shut until asked and ignore values a list does not offer", async ({ page }) => {
    await page.goto("/units?status=flying&sort=bogus");
    await expect(filtersPanel(page)).toBeHidden();
    await expect(sort(page)).toHaveValue("name");
    await page.getByRole("button", { name: "Filters" }).click();
    await expect(filter(page, "Status")).toHaveValue("");
    await expect(page.locator("tbody tr")).toHaveCount(10);
  });

  test("open dashboard View all links with the filter selected", async ({ page }) => {
    await page.goto("/documents?expiry=due");
    await expect(page.getByRole("button", { name: "Filters (1 on)" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Remove filter Expiry: Expired or within 30 days" })).toBeVisible();
    await page.goto("/units?status=in_repair");
    await expect(page.locator("tbody tr")).toHaveCount(2);
  });
});
