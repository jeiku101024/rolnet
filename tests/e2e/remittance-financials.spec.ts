import { readFile } from "node:fs/promises";
import { test, expect, type Page } from "@playwright/test";
import { zipText } from "../support/stored-zip";

// Feature 009, in demo mode. Demo remittances (lib/demo/mode.ts): the 4th newest is ₱100 paid on a
// ₱180 rental, and the 23rd newest (page 3 of List view) has no payment.

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

async function download(page: Page) {
  const [file] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Download .xlsx" }).click()]);
  const bytes = new Uint8Array(await readFile((await file.path())!));
  const sheet = zipText(bytes, "xl/worksheets/sheet1.xml");
  const strings = [...sheet.matchAll(/<t xml:space="preserve">([^<]*)<\/t>/g)].map((match) => match[1]);
  // The GRAND TOTAL row's first number is its Rental total (the formula's cached value).
  const grandRental = Number(/GRAND TOTAL<\/t>.*?<v>([^<]+)<\/v>/.exec(sheet)?.[1]);
  return { name: file.suggestedFilename(), sheet, strings, grandRental, workbook: zipText(bytes, "xl/workbook.xml") };
}

const reportKind = async (page: Page, label: string) => {
  const select = page.getByRole("combobox", { name: "Report" });
  if (await select.isVisible()) await select.selectOption({ label });
  else await page.getByRole("button", { name: label, exact: true }).click();
};

test.describe("remittance financials: XLSX reports", () => {
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila" }).format(new Date());

  test("offers Weekly, Monthly and Yearly downloads with a fleet or unit scope, and no CSV", async ({ page }) => {
    await page.goto("/reports");
    await expect(page.getByRole("combobox", { name: "Report" })).toBeVisible();
    await expect(page.getByRole("combobox", { name: "Month" })).toBeVisible();
    await page.getByRole("combobox", { name: "Scope" }).selectOption({ label: "One unit" });
    await expect(page.getByRole("combobox", { name: "Unit" }).locator("option", { hasText: "(retired)" })).toHaveCount(1);
    await expect(page.getByText(/CSV/)).toHaveCount(0);
    await reportKind(page, "Weekly");
    await expect(page.getByText(/^Covers Mon /)).toBeVisible();
  });

  test("downloads the Monthly report in the template layout", async ({ page }) => {
    await page.goto("/reports");
    const monthly = await download(page);
    expect(monthly.name).toBe(`rolnet-monthly-${today.slice(0, 7)}.xlsx`);
    expect(monthly.strings.slice(0, 8)).toEqual(["Week", "Day", "Driver", "Rental", "Deposit", "Allowance", "Month", "Year"]);
    expect(monthly.sheet).toContain("<f>SUM(");
    expect(monthly.strings).toContain("GRAND TOTAL");
  });

  test("downloads the Weekly and Yearly reports", async ({ page }) => {
    await page.goto("/reports");
    await reportKind(page, "Weekly");
    const weekly = await download(page);
    expect(weekly.name).toMatch(/^rolnet-weekly-\d{4}-\d{2}-\d{2}\.xlsx$/);
    expect(weekly.strings).not.toContain("GRAND TOTAL");
    expect(weekly.strings.filter((value) => / Subtotal$/.test(value))).toHaveLength(1);
    await reportKind(page, "Yearly");
    const yearly = await download(page);
    expect(yearly.name).toBe(`rolnet-yearly-${today.slice(0, 4)}.xlsx`);
    expect(yearly.strings.slice(0, 5)).toEqual(["Year", "Month", "Rental", "Deposit", "Allowance"]);
    expect(yearly.strings).toContain("Year Subtotal");
  });

  test("downloads a report for one unit, named for the unit (FR-021, FR-023)", async ({ page }) => {
    await page.goto("/reports");
    const fleet = await download(page);
    await page.getByRole("combobox", { name: "Scope" }).selectOption({ label: "One unit" });
    await page.getByRole("combobox", { name: "Unit" }).selectOption({ label: "ROLNET-1 (T-001)" });
    const unit = await download(page);
    expect(unit.name).toBe(`rolnet-monthly-${today.slice(0, 7)}-ROLNET-1.xlsx`);
    expect(unit.workbook).toContain('name="Monthly - ROLNET-1"');
    expect(unit.grandRental).toBeGreaterThan(0);
    expect(unit.grandRental).toBeLessThan(fleet.grandRental);
  });
});
