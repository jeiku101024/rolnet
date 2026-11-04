import { readFile } from "node:fs/promises";
import { test, expect, type Page } from "@playwright/test";
import { readWorkbook } from "../support/xlsx-read";

// Features 009 and 014, in demo mode. Demo remittances (lib/demo/mode.ts): the 4th newest is ₱100 paid on a
// ₱180 rental, and the 23rd newest (page 3 of List view) has no payment. A record's deposit is its payments
// minus its allowance, so it can be negative.

const listHeaders = ["Date", "Unit / driver", "Disposition", "Rental", "Paid", "Balance", "Allowance", "Deposit"];

test.describe("remittance financials: Daily view card", () => {
  test("shows Rental and a deposit that updates while typing, and blocks amounts above the rental", async ({ page }) => {
    await page.goto("/remittances");
    await page.waitForLoadState("networkidle");
    const card = page.getByRole("article", { name: "ROLNET-4", exact: true });
    await expect(card).toContainText("Rental");
    const deposit = card.locator("dt", { hasText: "Deposit" }).locator("xpath=following-sibling::dd[1]");
    await expect(deposit).toHaveText("−₱40.00");
    await card.getByLabel("Payment received (₱)").fill("100");
    await expect(deposit).toHaveText("₱60.00");
    await card.getByLabel("Payment received (₱)").fill("200");
    await expect(card.getByRole("alert")).toHaveText("Payment can't exceed the rental of ₱180.00");
    await expect(deposit).toHaveText("—");
  });
});

test.describe("remittance financials: List view", () => {
  for (const width of [360, 1280]) {
    test(`shows Rental, Allowance and Deposit at ${width} px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 800 });
      await page.goto("/remittances?view=list");
      await expect(page.locator("thead th")).toHaveText(listHeaders);
      const partial = page.locator("tbody tr").filter({ hasText: "Owes ₱80.00" }).first();
      await expect(partial.locator("td").nth(6)).toHaveText("₱40.00");
      await expect(partial.locator("td").nth(7)).toHaveText("₱60.00");
      await expect(page.getByText(/Credit/)).toHaveCount(0);
    });
  }

  test("shows a negative deposit with a minus sign in red", async ({ page }) => {
    await page.goto("/remittances?view=list&page=3");
    const unpaid = page.locator("tbody tr").filter({ hasText: "Owes ₱180.00" }).first();
    const deposit = unpaid.locator("td").nth(7).locator("span");
    await expect(deposit).toHaveText("−₱40.00");
    await expect(deposit).toHaveCSS("color", "rgb(163, 63, 59)");
  });
});

const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila" }).format(new Date());

async function download(page: Page) {
  const [file] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Download .xlsx" }).click()]);
  const workbook = readWorkbook(new Uint8Array(await readFile((await file.path())!)));
  return { name: file.suggestedFilename(), workbook, sheets: workbook.sheets.map((sheet) => sheet.name) };
}

const reportKind = async (page: Page, label: string) => {
  const select = page.getByRole("combobox", { name: "Report" });
  if (await select.isVisible()) await select.selectOption({ label });
  else await page.getByRole("button", { name: label, exact: true }).click();
};

test.describe("XLSX reports (feature 014)", () => {
  test("offers Weekly, Monthly and Yearly downloads for all units or a single unit, and no CSV", async ({ page }) => {
    await page.goto("/reports");
    await expect(page.getByRole("combobox", { name: "Report" })).toBeVisible();
    await expect(page.getByRole("combobox", { name: "Month" })).toBeVisible();
    const scope = page.getByRole("combobox", { name: "Scope" });
    await expect(scope.locator("option")).toHaveText(["All units", "Single unit"]);
    await expect(page.getByText(/CSV/)).toHaveCount(0);
  });

  test("lists the units for the period in natural order", async ({ page }) => {
    await page.goto("/reports");
    await page.getByRole("combobox", { name: "Scope" }).selectOption({ label: "Single unit" });
    const unit = page.getByRole("combobox", { name: "Unit" });
    await expect(unit.locator("option", { hasText: "ROLNET-10" })).toHaveCount(1);
    const names = (await unit.locator("option").allTextContents()).filter((label) => label.startsWith("ROLNET-"));
    expect(names.indexOf("ROLNET-2")).toBeGreaterThanOrEqual(0);
    expect(names.indexOf("ROLNET-2")).toBeLessThan(names.indexOf("ROLNET-10"));
    expect(names.indexOf("ROLNET-9")).toBeLessThan(names.indexOf("ROLNET-10"));
  });

  test("shows the week range under the weekly date", async ({ page }) => {
    await page.goto("/reports");
    await reportKind(page, "Weekly");
    await page.getByLabel("Any date in the week").fill("2026-10-28");
    await expect(page.getByText("Oct 26 – Nov 1, 2026")).toBeVisible();
  });

  test("downloads the Monthly report for all units: the summary first, then a sheet per unit in natural order", async ({ page }) => {
    await page.goto("/reports");
    const monthly = await download(page);
    expect(monthly.name).toBe(`rolnet-monthly-${today.slice(0, 7)}-all-units.xlsx`);
    expect(monthly.sheets[0]).toBe("All units");
    const units = monthly.sheets.slice(1);
    expect(units.length).toBeGreaterThan(3);
    expect(units.indexOf("ROLNET-2")).toBeLessThan(units.indexOf("ROLNET-10"));
    const summary = monthly.workbook.sheets[0];
    expect(summary.cells.get("A5")?.value).toBe(units[0]);
    expect(summary.cells.get("B5")?.formula).toMatch(new RegExp(`^'${units[0]}'!C\\d+$`));
  });

  test("downloads the Weekly and Yearly reports", async ({ page }) => {
    await page.goto("/reports");
    await reportKind(page, "Weekly");
    const weekly = await download(page);
    expect(weekly.name).toMatch(/^rolnet-weekly-\d{4}-\d{2}-\d{2}-all-units\.xlsx$/);
    const week = weekly.workbook.sheets[1];
    expect([...week.cells.values()].some((cell) => typeof cell.value === "string" && cell.value.startsWith("Week Subtotal"))).toBe(true);
    expect([...week.cells.values()].some((cell) => cell.value === "GRAND TOTAL")).toBe(false);
    await reportKind(page, "Yearly");
    const yearly = await download(page);
    expect(yearly.name).toBe(`rolnet-yearly-${today.slice(0, 4)}-all-units.xlsx`);
    expect(yearly.workbook.sheets[1].cells.get("A17")?.value).toBe("Year Subtotal  ·  Jan–Dec");
  });

  test("downloads a single unit's report, named for the unit, with only that sheet", async ({ page }) => {
    await page.goto("/reports");
    await page.getByRole("combobox", { name: "Scope" }).selectOption({ label: "Single unit" });
    const unit = page.getByRole("combobox", { name: "Unit" });
    await expect(unit.locator("option", { hasText: "ROLNET-1" })).not.toHaveCount(0);
    await unit.selectOption({ label: "ROLNET-1" });
    const file = await download(page);
    expect(file.name).toBe(`rolnet-monthly-${today.slice(0, 7)}-ROLNET-1.xlsx`);
    expect(file.sheets).toEqual(["ROLNET-1"]);
  });

  test("shows an error with Retry when the data can't be fetched, and Retry downloads", async ({ page }) => {
    await page.goto("/reports");
    await page.waitForLoadState("networkidle");
    let calls = 0;
    await page.route("**/api/reports/monthly?*", (route) => (calls++ === 0 ? route.abort() : route.continue()));
    await page.getByRole("button", { name: "Download .xlsx" }).click();
    await expect(page.getByText("Could not reach the server")).toBeVisible();
    const [file] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Retry" }).click()]);
    expect(file.suggestedFilename()).toBe(`rolnet-monthly-${today.slice(0, 7)}-all-units.xlsx`);
  });

  test("fits a 360 px screen without sideways scrolling", async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 800 });
    await page.goto("/reports");
    await page.getByRole("combobox", { name: "Scope" }).selectOption({ label: "Single unit" });
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });
});
