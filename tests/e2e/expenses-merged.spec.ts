import { test, expect, type Page } from "@playwright/test";

// Feature 011 (merged Expenses page), in demo mode at 360 px (playwright.config.ts). Demo mode has
// no write path: saving, editing and deleting are covered by tests/unit/expense-dialogs.test.tsx,
// pgTAP (supabase/tests/rls/220_expenses_merge_rls.sql) and the quickstart walkthrough.

async function noSidewaysScroll(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
}

async function openAdd(page: Page) {
  await page.goto("/expenses");
  await page.waitForLoadState("networkidle");
  await page.getByRole("button", { name: "Add expense" }).click();
  return page.getByRole("dialog", { name: "Add expense" });
}

test.describe("Expenses page (feature 011)", () => {
  test("is one full-width page with the toolbar, the count and the peso total", async ({ page }) => {
    await page.goto("/expenses");
    await expect(page.getByRole("heading", { name: "Expenses", level: 1 })).toBeVisible();
    await expect(page.getByRole("button", { name: "Add expense" })).toBeVisible();
    await expect(page.getByRole("button", { name: /^Filters/ })).toBeVisible();
    await expect(page.getByText(/^\d+ records · ₱[\d,]+\.\d{2}$/)).toBeVisible();
    for (const header of ["Date", "Unit", "Category", "Amount", "Last Replaced", "Notes", "Options"]) await expect(page.getByRole("columnheader", { name: header })).toBeAttached();
    await expect(page.getByText("Add an expense")).toHaveCount(0);
    await noSidewaysScroll(page);
  });

  test("shows N/A and an Others tag for typed categories", async ({ page }) => {
    await page.goto("/expenses?category=others&q=Brake");
    const row = page.locator("tbody tr").first();
    await expect(row).toContainText("Brake pads");
    await expect(row).toContainText("Others");
    await expect(row).toContainText("N/A");
  });

  test("validates inline, swaps fields in place and keeps the other values", async ({ page }) => {
    const dialog = await openAdd(page);
    await expect(dialog.getByLabel(/^Expense date/)).not.toHaveValue("");
    await dialog.getByRole("button", { name: "Save expense" }).click();
    await expect(dialog.getByText("Choose a unit.")).toBeVisible();
    await expect(dialog.getByText("Choose a category.")).toBeVisible();
    await dialog.getByLabel(/^Category(?! name)/).selectOption({ label: "Chain" });
    await expect(dialog.getByLabel(/^Date replaced/)).toBeVisible();
    await dialog.getByLabel(/^Amount/).fill("350");
    await dialog.getByLabel(/^Notes/).fill("Shop on the highway");
    await dialog.getByLabel(/^Category(?! name)/).selectOption({ label: "Others" });
    await expect(dialog.getByLabel(/^Date replaced/)).toHaveCount(0);
    await dialog.getByRole("button", { name: "Save expense" }).click();
    await expect(dialog.getByText("Enter a category name.")).toBeVisible();
    await dialog.getByLabel(/^Category name/).fill("oil change");
    await expect(dialog.getByText("This looks like Change Oil. Choose it from Category to track Last Replaced.")).toBeVisible();
    await dialog.getByLabel(/^Category(?! name)/).selectOption({ label: "Battery" });
    await expect(dialog.getByLabel(/^Amount/)).toHaveValue("350");
    await expect(dialog.getByLabel(/^Notes/)).toHaveValue("Shop on the highway");
    await noSidewaysScroll(page);
  });

  test("closes on Escape and returns focus to Add expense", async ({ page }) => {
    const dialog = await openAdd(page);
    await expect(dialog).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Add expense" })).toBeFocused();
  });

  test("opens the row menu upward on the last row, edits pre-filled and asks before dropping Last Replaced", async ({ page }) => {
    await page.goto("/expenses?category=chain");
    await page.waitForLoadState("networkidle");
    const last = page.locator("tbody tr").last();
    await last.getByRole("button", { name: "Expense options" }).click();
    const menu = page.getByRole("menu");
    await expect(menu).toBeVisible();
    const box = await menu.boundingBox();
    const viewport = page.viewportSize();
    expect(box && viewport ? box.y + box.height : 0).toBeLessThanOrEqual(viewport?.height ?? 0);
    await page.getByRole("menuitem", { name: "Edit" }).click();
    const dialog = page.getByRole("dialog", { name: "Edit expense" });
    await expect(dialog.getByLabel(/^Category(?! name)/)).toHaveValue("chain");
    await dialog.getByLabel(/^Category(?! name)/).selectOption({ label: "Others" });
    const confirm = page.getByRole("alertdialog");
    await expect(confirm).toContainText("This removes the Last Replaced date.");
    await confirm.getByRole("button", { name: "Cancel" }).click();
    await expect(dialog.getByLabel(/^Category(?! name)/)).toHaveValue("chain");
  });

  test("confirms a delete with the expense's details and Cancel focused", async ({ page }) => {
    await page.goto("/expenses");
    await page.waitForLoadState("networkidle");
    await page.locator("tbody tr").first().getByRole("button", { name: "Expense options" }).click();
    await page.getByRole("menuitem", { name: "Delete" }).click();
    const dialog = page.getByRole("alertdialog");
    await expect(dialog).toContainText("Delete this expense?");
    await expect(dialog).toContainText("This permanently removes the expense and changes report totals for that period.");
    for (const label of ["Date", "Unit", "Category", "Amount"]) await expect(dialog).toContainText(label);
    await expect(dialog.getByRole("button", { name: "Cancel" })).toBeFocused();
    await expect(dialog.getByRole("button", { name: "Delete expense" })).toBeVisible();
  });

  test("finds moved maintenance records and the ones that need review", async ({ page }) => {
    await page.goto("/expenses?review=moved");
    await expect(page.locator("tbody tr")).toHaveCount(2);
    await page.goto("/expenses?review=needs-review");
    await expect(page.locator("tbody tr")).toHaveCount(1);
    await expect(page.locator("tbody tr").first()).toContainText("Needs review");
    await expect(page.locator("tbody tr").first()).toContainText("₱0.00");
  });

  test("says when filters match nothing", async ({ page }) => {
    await page.goto("/expenses?q=zzzz-nothing");
    await expect(page.getByText("No expenses match these filters.")).toBeVisible();
    await expect(page.getByText(/^0 records · ₱0\.00$/)).toBeVisible();
  });
});

test.describe("Maintenance is merged into Expenses (feature 011)", () => {
  test("redirects the old Maintenance addresses", async ({ page }) => {
    await page.goto("/maintenance");
    await expect(page).toHaveURL(/\/expenses$/);
    await page.goto("/maintenance/00000000-0000-4000-8000-000000000001");
    await expect(page).toHaveURL(/\/expenses\?unit=00000000-0000-4000-8000-000000000001$/);
  });

  test("offers Record mileage on the Units Daily view cards", async ({ page }) => {
    await page.goto("/units?view=daily");
    await page.waitForLoadState("networkidle");
    await page.getByRole("button", { name: "Record mileage" }).first().click();
    const dialog = page.getByRole("dialog", { name: /^Record mileage · / });
    await expect(dialog.getByLabel(/^Odometer/)).toBeVisible();
    await noSidewaysScroll(page);
  });
});
