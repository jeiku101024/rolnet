import { test, expect, type Page } from "@playwright/test";

// Feature 015 (Sinking fund), in demo mode at 360 px (playwright.config.ts). Demo mode has no write path, so
// saving is checked only for the plain "Demo mode doesn't save changes" message; the rules themselves are covered
// by tests/unit/sinking-fund-*.test.ts and pgTAP (supabase/tests/constraints/410..430, rls/100).

async function noSidewaysScroll(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
}

async function open(page: Page, path = "/sinking-fund") {
  await page.goto(path);
  // Wait for the page to settle (and hydrate) but do not fail on a dev server that keeps a connection open.
  await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => undefined);
  await expect(page.getByRole("heading", { name: "Sinking fund", level: 1 })).toBeVisible();
}

async function pickParticipant(page: Page, dialog: ReturnType<Page["getByRole"]>, name: string) {
  await dialog.getByRole("combobox", { name: "Participant" }).click();
  await dialog.getByRole("option", { name }).click();
}

test.describe("Sinking fund (feature 015)", () => {
  // A dev server compiles the route on first use, so allow more than the default 30 seconds.
  test.describe.configure({ timeout: 90_000 });

  test("opens with the header, the five summary cards, and the Transactions list", async ({ page }) => {
    await open(page);
    await expect(page.getByRole("heading", { name: "Sinking fund", level: 1 })).toBeVisible();
    await expect(page.getByText("Savings and loans")).toBeVisible();
    for (const label of ["Total savings", "Loans outstanding", "Balance to collect", "Payments received", "Interest fund"]) {
      await expect(page.getByText(label, { exact: true }).first()).toBeVisible();
    }
    await expect(page.getByRole("button", { name: "Add participant" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Add transaction" })).toBeVisible();
    await expect(page.getByRole("button", { name: /^Filters/ })).toBeVisible();
    await expect(page.getByTestId("sf-row")).toHaveCount(25);
    await expect(page.getByRole("link", { name: "Load more" })).toBeVisible();
    await noSidewaysScroll(page);
  });

  test("shows type tags, amounts, and details for each kind of transaction", async ({ page }) => {
    await open(page, "/sinking-fund?n=100");
    for (const tag of ["Deposit", "Loan", "Payment", "Withdrawal", "Savings withdrawal", "Interest share"]) {
      await expect(page.getByTestId("sf-row").getByText(tag, { exact: true }).first()).toBeVisible();
    }
    await expect(page.getByText(/5% interest \(₱\d[\d,]*\.\d{2}\) · To pay/).first()).toBeVisible();
    await expect(page.getByText(/closed as withdrawal on /).first()).toBeVisible();
    await expect(page.getByText(/Share of ₱[\d,]+\.\d{2} distributed on /).first()).toBeVisible();
    await expect(page.getByText("Overdue", { exact: true }).first()).toBeVisible();
  });

  test("switches views without reloading and keeps the links shareable", async ({ page }) => {
    await open(page);
    await page.evaluate(() => { (window as unknown as { __kept: number }).__kept = 1; });
    await page.getByRole("button", { name: "Top participants" }).click();
    await expect(page).toHaveURL(/view=top/);
    await expect(page.getByRole("list", { name: "Ranking" })).toBeVisible();
    await page.getByRole("button", { name: "Participants", exact: true }).click();
    await expect(page).toHaveURL(/view=participants/);
    await expect(page.getByRole("list", { name: "Participants" })).toBeVisible();
    expect(await page.evaluate(() => (window as unknown as { __kept?: number }).__kept)).toBe(1);
    await open(page, "/sinking-fund?view=top");
    await expect(page.getByRole("list", { name: "Ranking" })).toBeVisible();
  });

  test("Add participant asks for a name and closes on Escape", async ({ page }) => {
    await open(page);
    await page.getByRole("button", { name: "Add participant" }).click();
    const dialog = page.getByRole("dialog", { name: "Add participant" });
    await expect(dialog.getByRole("combobox", { name: "Import from drivers" })).toBeVisible();
    await dialog.getByRole("button", { name: "Save participant" }).click();
    await expect(dialog.getByText("Enter a name.")).toBeVisible();
    await dialog.getByLabel("Name").fill("Test Person");
    await dialog.getByRole("button", { name: "Save participant" }).click();
    await expect(dialog.getByRole("alert").filter({ hasText: "Demo mode" })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
  });

  test("a deposit previews the new total savings", async ({ page }) => {
    await open(page);
    await page.getByRole("button", { name: "Add transaction" }).click();
    const dialog = page.getByRole("dialog", { name: "Add transaction" });
    await pickParticipant(page, dialog, "Hugo Dela Cruz");
    await expect(dialog.getByTestId("sf-participant-figures")).toContainText("Total savings ₱0.00");
    await dialog.getByLabel(/^Amount/).fill("10000");
    await expect(dialog.getByTestId("sf-preview")).toContainText("New total savings: ₱10,000.00");
    await dialog.getByLabel("Date").fill("2999-01-01");
    await dialog.getByRole("button", { name: "Save transaction" }).click();
    await expect(dialog.getByText("The date cannot be in the future.")).toBeVisible();
    await noSidewaysScroll(page);
  });

  test("a loan must be in steps of ₱100, shows its 5% tag, and cannot exceed savings", async ({ page }) => {
    await open(page);
    await page.getByRole("button", { name: "Add transaction" }).click();
    const dialog = page.getByRole("dialog", { name: "Add transaction" });
    await pickParticipant(page, dialog, "Ben Cruz");
    await dialog.getByRole("button", { name: "Loan", exact: true }).click();
    await expect(dialog.getByText(/^Available to borrow: ₱/)).toBeVisible();
    await dialog.getByLabel(/^Amount/).fill("150");
    await dialog.getByRole("button", { name: "Save transaction" }).click();
    await expect(dialog.getByText("Loans must be in steps of ₱100 (₱100, ₱200, ₱300...).")).toBeVisible();
    await dialog.getByLabel(/^Amount/).fill("2000");
    await expect(dialog.getByTestId("sf-loan-tag")).toContainText(/5% interest \(₱100\.00\) · To pay: ₱2,100\.00 · Due [A-Z][a-z]{2} \d{1,2}, \d{4}/);
    await dialog.getByLabel(/^Amount/).fill("9999900");
    await dialog.getByRole("button", { name: "Save transaction" }).click();
    await expect(dialog.getByText(/^Loan cannot be higher than total savings \(₱/)).toBeVisible();
  });

  test("a payment shows the allowed interest part, quick buttons, and the balance after", async ({ page }) => {
    await open(page);
    await page.getByRole("button", { name: "Add transaction" }).click();
    const dialog = page.getByRole("dialog", { name: "Add transaction" });
    await pickParticipant(page, dialog, "Hugo Dela Cruz");
    await expect(dialog.getByRole("button", { name: "Payment" })).toBeDisabled();
    await expect(dialog.getByText("No open loans")).toBeVisible();
    await dialog.getByRole("combobox", { name: "Participant" }).click();
    await dialog.getByRole("option", { name: "Ana Reyes" }).click();
    await dialog.getByRole("button", { name: "Payment" }).click();
    await expect(dialog.getByLabel("Loan")).toBeVisible();
    await dialog.getByLabel(/^Amount/).fill("100");
    await expect(dialog.getByText(/^Allowed: ₱/)).toBeVisible();
    await dialog.getByRole("button", { name: "None" }).click();
    await expect(dialog.getByTestId("sf-preview")).toContainText("₱0.00 to the Interest fund");
    await dialog.getByRole("button", { name: "All unpaid interest" }).click();
    await expect(dialog.getByTestId("sf-preview")).toContainText("to the Interest fund");
    await dialog.getByRole("button", { name: "Pay full balance" }).click();
    await expect(dialog.getByTestId("sf-preview")).toContainText("Loan fully paid");
  });

  test("the Top participants view ranks with trophies and moves between periods", async ({ page }) => {
    await open(page, "/sinking-fund?view=top");
    await expect(page.getByRole("img", { name: "1st place" })).toBeVisible();
    await expect(page.getByRole("img", { name: "2nd place" })).toBeVisible();
    await expect(page.getByRole("img", { name: "3rd place" })).toBeVisible();
    await page.getByRole("button", { name: "Monthly" }).click();
    await expect(page).toHaveURL(/period=month/);
    await expect(page.getByRole("button", { name: "Next period" })).toBeDisabled();
    await page.getByRole("button", { name: "Previous period" }).click();
    await expect(page).toHaveURL(/at=\d{4}-\d{2}/);
    await page.getByRole("button", { name: "Deposits" }).click();
    await expect(page).toHaveURL(/rank=deposits/);
    await noSidewaysScroll(page);
  });

  test("the Participants view shows totals, both charts with table alternatives, and cards in one column on a phone", async ({ page }) => {
    await open(page, "/sinking-fund?view=participants");
    await expect(page.getByText("Participants", { exact: true }).first()).toBeVisible();
    await expect(page.getByTestId("sf-participant-card")).toHaveCount(7);
    await expect(page.getByRole("img", { name: "Share of total savings by participant" })).toBeVisible();
    await expect(page.getByRole("img", { name: "Deposits, loans, and payments per month" })).toBeVisible();
    await page.getByRole("button", { name: "View as table" }).first().click();
    await expect(page.getByRole("columnheader", { name: "Share" })).toBeVisible();
    const boxes = await page.getByTestId("sf-participant-card").evaluateAll((nodes) => nodes.slice(0, 2).map((node) => node.getBoundingClientRect().left));
    expect(boxes[0]).toBe(boxes[1]);
    await expect(page.getByText("Iris Ortiz")).toHaveCount(0);
    await page.getByRole("searchbox", { name: "Search participants" }).fill("Ana");
    await expect(page.getByTestId("sf-participant-card")).toHaveCount(1);
    await noSidewaysScroll(page);
  });

  test("the participant detail opens from a card, lists loans and history, and closes", async ({ page }) => {
    await open(page, "/sinking-fund?view=participants");
    await page.getByRole("button", { name: "Options for Ana Reyes" }).click();
    await page.getByRole("menuitem", { name: "View details" }).click();
    const sheet = page.getByRole("dialog", { name: "Ana Reyes" });
    await expect(sheet).toBeVisible();
    await expect(page).toHaveURL(/detail=/);
    await expect(sheet.getByTestId("sf-detail-loan").first()).toBeVisible();
    await expect(sheet.getByRole("button", { name: "Add transaction" })).toBeVisible();
    await sheet.getByRole("button", { name: "Close participant details" }).click();
    await expect(sheet).toHaveCount(0);
  });

  test("owner tools: Fund settings, Distribute, and the row menu", async ({ page }) => {
    await open(page);
    await page.getByRole("button", { name: "Fund settings" }).click();
    const settings = page.getByRole("dialog", { name: "Fund settings" });
    await expect(settings.getByLabel("Take interest first")).toBeChecked();
    await expect(settings.getByText("Interest rate")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(settings).toHaveCount(0);

    await page.getByRole("button", { name: "Distribute" }).click();
    const distribute = page.getByRole("dialog", { name: "Distribute interest" });
    await expect(distribute.getByText("Each participant gets")).toBeVisible();
    await page.keyboard.press("Escape");

    await page.getByTestId("sf-row").first().getByRole("button", { name: /^Options for/ }).click();
    await expect(page.getByRole("menuitem", { name: "View participant" })).toBeVisible();
    await expect(page.getByRole("menuitem", { name: /^Void/ })).toBeVisible();
  });

  test("filters narrow the list and show removable chips", async ({ page }) => {
    await open(page, "/sinking-fund?type=loan&n=100");
    await expect(page.getByTestId("sf-row").first()).toContainText("Loan");
    await expect(page.getByRole("button", { name: /Remove filter Type: Loan/ })).toBeVisible();
    await page.getByRole("button", { name: "Clear all" }).click();
    await expect(page).not.toHaveURL(/type=/);
  });
});
