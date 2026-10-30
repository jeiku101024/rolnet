import { test, expect, type Page } from "@playwright/test";
import { addDays, fleetToday } from "../../lib/dates/fleet-date";

// Feature 006, User Story 8, in demo mode on a 360 px phone (the suite's device).

const today = fleetToday();
const controlsGroup = (page: Page) => page.getByRole("group", { name: "Sort and filter" });
const control = (page: Page, name: string) => controlsGroup(page).getByRole("combobox", { name, exact: true });

async function openControls(page: Page) {
  // Phones fold the controls; open them only if they are folded (the panel stays open across updates).
  const toggle = page.getByRole("button", { name: /^Sort and filter/ });
  if (await toggle.isVisible() && (await toggle.getAttribute("aria-expanded")) === "false") await toggle.click();
}

test.describe("list sort and filter", () => {
  test("narrow expenses by unit, category and date, sorted by amount", async ({ page }) => {
    await page.goto("/expenses");
    await openControls(page);
    await control(page, "Unit").selectOption({ label: "Body T-003" });
    await expect(page).toHaveURL(/unit=/);
    await control(page, "Category").selectOption({ label: "Fuel" });
    await expect(page).toHaveURL(/category=/);
    await openControls(page);
    await controlsGroup(page).getByLabel("From").fill(addDays(today, -9));
    await expect(page).toHaveURL(/from=/);
    await openControls(page);
    await control(page, "Sort").selectOption({ label: "Amount, highest first" });
    await expect(page).toHaveURL(/sort=amount-desc/);
    const rows = page.locator("tbody tr");
    await expect(rows).toHaveCount(2);
    await expect(rows.nth(0)).toContainText("₱550.00");
    await expect(rows.nth(1)).toContainText("₱350.00");
    await expect(page.getByRole("button", { name: /Sort and filter \(3 on\)/ })).toBeVisible();
  });

  test("sort drivers by license expiry", async ({ page }) => {
    await page.goto("/drivers?sort=license");
    await expect(page.locator("tbody tr").first()).toContainText("Maria Reyes");
  });

  test("restart at page 1 when a filter changes", async ({ page }) => {
    await page.goto("/remittances?page=3");
    await openControls(page);
    await control(page, "Disposition").selectOption({ label: "Returned" });
    await expect(page).toHaveURL(/disposition=returned/);
    await expect(page).not.toHaveURL(/page=/);
  });

  test("clear filters but keep the search text", async ({ page }) => {
    await page.goto("/expenses?q=Gasoline&receipt=attached&sort=oldest");
    await openControls(page);
    await page.getByRole("button", { name: "Clear filters" }).click();
    await expect(page).toHaveURL(/\/expenses\?q=Gasoline$/);
    await expect(page.getByRole("searchbox", { name: "Search expenses" })).toHaveValue("Gasoline");
  });

  test("fold the controls on a phone and ignore values a list does not offer", async ({ page }) => {
    await page.goto("/units?status=flying&sort=bogus");
    await expect(control(page, "Sort")).toBeHidden();
    await openControls(page);
    await expect(control(page, "Sort")).toHaveValue("body");
    await expect(control(page, "Status")).toHaveValue("");
    await expect(page.locator("tbody tr")).toHaveCount(10);
  });

  test("open dashboard View all links with the filter selected", async ({ page }) => {
    await page.goto("/documents?expiry=due");
    await expect(page.getByRole("button", { name: /Sort and filter \(1 on\)/ })).toBeVisible();
    await openControls(page);
    await expect(control(page, "Expiry")).toHaveValue("due");
    await page.goto("/units?status=in_repair");
    await expect(page.locator("tbody tr")).toHaveCount(2);
  });
});
