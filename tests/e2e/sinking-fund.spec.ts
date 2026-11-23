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
    await expect(page.getByTestId("sf-row")).toHaveCount(10);
    await expect(page.getByRole("navigation", { name: "Pagination" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Load more" })).toHaveCount(0);
    await noSidewaysScroll(page);
  });

  test("shows type tags, amounts, and details for each kind of transaction", async ({ page }) => {
    await open(page, "/sinking-fund?n=100");
    for (const tag of ["Deposit", "Loan", "Payment", "Withdrawal", "Savings withdrawal", "Interest share", "Year-end close"]) {
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

  test("the Transactions list pages ten rows at a time and a new search returns to page 1", async ({ page }) => {
    await open(page);
    await page.getByRole("link", { name: "Next page" }).click();
    await expect(page).toHaveURL(/page=2/);
    await expect(page.getByTestId("sf-row").first()).toBeVisible();
    await page.getByRole("searchbox", { name: "Search transactions" }).fill("a");
    await expect(page).not.toHaveURL(/page=2/);
    await open(page, "/sinking-fund?page=999");
    await expect(page.getByRole("navigation", { name: "Pagination" })).toContainText(/Page d+ of d+/);
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
    await expect(distribute.getByText("Each participant gets")).toHaveCount(0);
    await expect(distribute.getByTestId("sf-distribute-warning")).toBeVisible();
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

// Feature 016: the Interest fund is shared by savings and the distribution closes the year (demo data has one
// proportional close and one older equal-share distribution).
test.describe("Distribution and year-end close (feature 016)", () => {
  test.describe.configure({ timeout: 90_000 });

  test("Distribute shows each share by savings, flags unpaid loans, and warns that the year closes", async ({ page }) => {
    await open(page);
    await page.getByRole("button", { name: "Distribute", exact: true }).click();
    const distribute = page.getByRole("dialog", { name: "Distribute interest" });
    await expect(distribute.getByText("Each participant gets")).toHaveCount(0);
    await expect(distribute.getByTestId("sf-distribute-warning")).toContainText("resets their savings, loans, balance, and payments to ₱0.00");
    const confirm = distribute.getByRole("button", { name: /^Distribute and close the year/ });

    // Ana, Cora, and Dino have an open or overdue loan: flagged, and confirming is blocked while they are ticked.
    await expect(distribute.getByText("Has an unpaid loan")).toHaveCount(3);
    await expect(distribute.getByTestId("sf-distribute-blocked")).toContainText("Ana Reyes");
    await expect(confirm).toBeDisabled();

    const list = distribute.getByTestId("sf-distribute-list");
    const elena = list.locator("li", { hasText: "Elena Ramos" }).getByTestId("sf-share");
    const before = await elena.textContent();
    for (const name of ["Ana Reyes", "Cora Santos", "Dino Lim"]) await distribute.getByRole("checkbox", { name: new RegExp(name) }).click();
    await expect(distribute.getByTestId("sf-distribute-blocked")).toHaveCount(0);
    await expect(confirm).toBeEnabled();
    const after = await elena.textContent();
    expect(after).not.toBe(before); // a smaller group means a bigger share for each person left

    // Shares follow savings: a participant with more savings gets more (Ben saved more than Felix).
    const shareOf = async (name: string) => Number(((await list.locator("li", { hasText: name }).getByTestId("sf-share").textContent()) ?? "").replace(/[^\d.]/g, ""));
    expect(await shareOf("Ben Cruz")).toBeGreaterThan(await shareOf("Felix Tan"));
    await expect(list.locator("li", { hasText: "Hugo Dela Cruz" })).toContainText("No savings, no share");

    // No sideways scrolling inside the dialog or the page.
    expect(await distribute.evaluate((element) => element.scrollWidth - element.clientWidth)).toBeLessThanOrEqual(0);
    await noSidewaysScroll(page);

    // Demo mode saves nothing and says so.
    await confirm.click();
    await expect(distribute.getByText("Demo mode doesn't save changes")).toBeVisible();
  });

  test("View history lists each distribution and opens its table, sorted highest first, with the Excel download", async ({ page }) => {
    await open(page);
    await page.getByRole("button", { name: "View history" }).click();
    const history = page.getByRole("dialog", { name: "Distribution history" });
    const items = history.getByTestId("sf-dist-history-item");
    await expect(items).toHaveCount(2);
    await expect(items.first()).toContainText("3 received a share"); // the newer, equal-share distribution
    await expect(items.nth(1)).toContainText("2 received a share"); // the year-end close

    await items.nth(1).click();
    const details = page.getByRole("dialog", { name: /^Distribution 20\d\d$/ });
    await expect(details).toBeVisible();
    await expect(details.getByText("Sinking fund total for the year")).toBeVisible();
    await expect(details.getByTestId("sf-dist-year-total")).toContainText("₱");
    const rows = details.getByTestId("sf-dist-row");
    await expect(rows).toHaveCount(3);
    await expect(rows.nth(0)).toContainText("Dino Lim");
    await expect(rows.nth(1)).toContainText("Felix Tan");
    await expect(rows.nth(2)).toContainText("Hugo Dela Cruz");
    await expect(details.getByTestId("sf-dist-totals")).toContainText("Total");
    expect(await details.evaluate((element) => element.scrollWidth - element.clientWidth)).toBeLessThanOrEqual(0);

    const link = details.getByRole("link", { name: "Download year-end distribution (Excel)" });
    const href = await link.getAttribute("href");
    expect(href).toMatch(/^\/api\/sinking-fund\/distributions\/[0-9a-f-]{36}\/xlsx$/);
    const response = await page.request.get(href!);
    expect(response.status()).toBe(200);
    expect(response.headers()["content-type"]).toContain("spreadsheetml.sheet");
    expect(response.headers()["content-disposition"]).toMatch(/rolnet-sinking-fund-\d{4}-\d{4}-\d{2}-\d{2}\.xlsx/);
    expect((await response.body()).subarray(0, 2).toString()).toBe("PK");
  });

  test("an older equal-share distribution shows its shares and says the ended totals were not recorded", async ({ page }) => {
    await open(page);
    await page.getByRole("button", { name: "View history" }).click();
    await page.getByRole("dialog", { name: "Distribution history" }).getByTestId("sf-dist-history-item").first().click();
    const details = page.getByRole("dialog", { name: /^Distribution 20\d\d$/ });
    await expect(details.getByTestId("sf-dist-year-total")).toHaveText("Not recorded");
    await expect(details.getByTestId("sf-dist-row")).toHaveCount(3);
    await expect(details.getByText("only the shares are known")).toBeVisible();
  });

  test("a bad distribution link is refused", async ({ page }) => {
    const response = await page.request.get("/api/sinking-fund/distributions/not-a-uuid/xlsx");
    expect(response.status()).toBe(400);
  });
});

// Feature 021: a participant opens on their own page (not a pop-up) with the old details and a History like the main list.
test.describe("Participant page (feature 021)", () => {
  test.describe.configure({ timeout: 90_000 });

  async function openParticipant(page: Page, name = "Ana Reyes") {
    await open(page, "/sinking-fund?view=participants");
    await page.getByRole("button", { name: "Options for " + name }).click();
    await page.getByRole("menuitem", { name: "View details" }).click();
    await expect(page.getByRole("heading", { name, level: 1 })).toBeVisible();
    await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => undefined);
  }

  test("View details opens the participant's own page, not a pop-up, and Back restores the participants view", async ({ page }) => {
    await open(page, "/sinking-fund?view=participants");
    await page.getByRole("searchbox", { name: "Search participants" }).fill("Ana");
    await expect(page.getByTestId("sf-participant-card")).toHaveCount(1);
    await page.getByRole("button", { name: "Options for Ana Reyes" }).click();
    await page.getByRole("menuitem", { name: "View details" }).click();
    await expect(page).toHaveURL(/\/sinking-fund\/participants\/[0-9a-f-]{36}/);
    await expect(page.getByRole("heading", { name: "Ana Reyes", level: 1 })).toBeVisible();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await page.getByRole("link", { name: "Back to Sinking fund" }).click();
    await expect(page).toHaveURL(/view=participants/);
    await expect(page.getByRole("searchbox", { name: "Search participants" })).toHaveValue("Ana");
  });

  for (const width of [360, 1280]) {
    test("shows the figures, buttons, loans, and History with no sideways scrolling at " + width + "px", async ({ page }) => {
      await page.setViewportSize({ width, height: 800 });
      await openParticipant(page);
      for (const label of ["Total savings", "Total loans", "Balance to pay", "Interest shares received"]) await expect(page.getByText(label, { exact: true })).toBeVisible();
      await expect(page.getByRole("button", { name: "Add transaction" })).toBeVisible();
      await expect(page.getByRole("button", { name: "Withdraw savings" })).toBeVisible();
      await expect(page.getByRole("heading", { name: "Loans" })).toBeVisible();
      await expect(page.getByRole("heading", { name: "History" })).toBeVisible();
      await expect(page.getByTestId("sf-loans")).toBeVisible();
      await noSidewaysScroll(page);
    });
  }

  test("History shows ten rows with pages, search, and sort for this participant only", async ({ page }) => {
    await openParticipant(page, "Ben Cruz");
    const rows = page.getByTestId("sf-row");
    await expect(rows).toHaveCount(10);
    await expect(page.getByRole("navigation", { name: "Pagination" })).toBeVisible();
    for (const text of await page.getByTestId("sf-detail-history").getByText(/Ben Cruz/).allTextContents()) expect(text).toContain("Ben Cruz");
    await page.getByRole("link", { name: "Next page" }).click();
    await expect(page).toHaveURL(/page=2/);
    await expect(page.getByRole("heading", { name: "Ben Cruz", level: 1 })).toBeVisible();
    await page.getByLabel("Sort").selectOption({ label: "Amount, highest first" });
    await expect(page).not.toHaveURL(/page=2/);
    await expect(page).toHaveURL(/sort=amount-desc/);
    await noSidewaysScroll(page);
  });

  test("Add transaction opens the form for this participant", async ({ page }) => {
    await openParticipant(page);
    await page.getByRole("button", { name: "Add transaction" }).click();
    await expect(page.getByRole("dialog", { name: /Add transaction/i })).toBeVisible();
  });

  test("an old ?detail= link lands on the participant page", async ({ page }) => {
    await openParticipant(page);
    const id = page.url().match(/participants\/([0-9a-f-]{36})/)![1];
    await page.goto("/sinking-fund?view=participants&detail=" + id);
    await expect(page).toHaveURL(new RegExp("/sinking-fund/participants/" + id));
    await expect(page.getByRole("heading", { name: "Ana Reyes", level: 1 })).toBeVisible();
  });

  test("an unknown participant shows a not-found page with a way back", async ({ page }) => {
    await page.goto("/sinking-fund/participants/00000000-0000-4000-8000-000000000999");
    await expect(page.getByRole("heading", { name: "Participant not found" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Back to participants" })).toBeVisible();
  });

  test("the back control ignores an address outside the Sinking fund", async ({ page }) => {
    await openParticipant(page);
    const id = page.url().match(/participants\/([0-9a-f-]{36})/)![1];
    await page.goto("/sinking-fund/participants/" + id + "?return=" + encodeURIComponent("https://evil.test"));
    await expect(page.getByRole("link", { name: "Back to Sinking fund" })).toHaveAttribute("href", "/sinking-fund?view=participants");
  });
});

// Feature 022: the participant page's compact Loans section (Ana Reyes has many loans in the demo data).
test.describe("Participant loans (feature 022)", () => {
  test.describe.configure({ timeout: 90_000 });

  async function openAna(page: Page) {
    await open(page, "/sinking-fund?view=participants");
    await page.getByRole("searchbox", { name: "Search participants" }).fill("Ana");
    await page.getByRole("button", { name: "Options for Ana Reyes" }).click();
    await page.getByRole("menuitem", { name: "View details" }).click();
    await expect(page.getByRole("heading", { name: "Ana Reyes", level: 1 })).toBeVisible();
    await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => undefined);
  }

  test("shows a summary and compact active rows, overdue first, with every row collapsed", async ({ page }) => {
    await openAna(page);
    const summary = page.getByTestId("sf-loans-summary");
    await expect(summary).toContainText("5 active");
    await expect(summary).toContainText("1 overdue");
    const rows = page.getByTestId("sf-loan-row");
    await expect(rows).toHaveCount(5);
    await expect(rows.first()).toContainText("Overdue");
    for (let index = 0; index < 5; index += 1) await expect(rows.nth(index)).toHaveAttribute("aria-expanded", "false");
    await expect(page.getByTestId("sf-loan-detail")).toHaveCount(0);
    await expect(page.getByRole("tab", { name: /^Active (5)/ })).toHaveAttribute("aria-selected", "true");
    await noSidewaysScroll(page);
  });

  test("opens one loan at a time with its breakdown, payments, and actions", async ({ page }) => {
    await openAna(page);
    const rows = page.getByTestId("sf-loan-row");
    await rows.first().click();
    await expect(rows.first()).toHaveAttribute("aria-expanded", "true");
    const detail = page.getByTestId("sf-loan-detail");
    await expect(detail).toHaveCount(1);
    await expect(detail).toContainText("principal");
    await expect(detail).toContainText("interest");
    await expect(detail).toContainText("Interest paid");
    await expect(detail).toContainText("Principal paid");
    await expect(detail).toContainText("No payments yet.");
    await expect(page.getByTestId("sf-loan-add-payment")).toBeVisible();
    await expect(page.getByTestId("sf-loan-pay-full")).toBeVisible();
    await expect(page.getByTestId("sf-loan-withdraw")).toBeVisible();
    await rows.nth(1).click();
    await expect(rows.first()).toHaveAttribute("aria-expanded", "false");
    await expect(rows.nth(1)).toHaveAttribute("aria-expanded", "true");
    await expect(detail).toHaveCount(1);
    await expect(page.getByTestId("sf-loan-withdraw")).toHaveCount(0);
    await noSidewaysScroll(page);
    await rows.nth(1).click();
    await expect(detail).toHaveCount(0);
  });

  test("lists a part-paid loan's payment", async ({ page }) => {
    await openAna(page);
    const rows = page.getByTestId("sf-loan-row");
    await expect(rows).toHaveCount(5);
    for (let index = 0; index < 5; index += 1) {
      await rows.nth(index).click();
      if (await page.getByTestId("sf-loan-payment").count()) break;
    }
    await expect(page.getByTestId("sf-loan-payment")).toHaveCount(1);
    await expect(page.getByTestId("sf-loan-payment")).toContainText("with");
  });

  test("Add payment and Pay full balance open the form on that loan", async ({ page }) => {
    await openAna(page);
    await page.getByTestId("sf-loan-row").first().click();
    await page.getByTestId("sf-loan-add-payment").click();
    const dialog = page.getByRole("dialog", { name: /Add transaction/i });
    await expect(dialog).toBeVisible();
    await expect(dialog.locator("#sf-amount")).toHaveValue("");
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
    await page.getByTestId("sf-loan-pay-full").click();
    await expect(dialog).toBeVisible();
    await expect(dialog.locator("#sf-amount")).toHaveValue("1050");
  });

  test("the Paid and closed tab pages five loans at a time and filters by year", async ({ page }) => {
    await openAna(page);
    await page.getByRole("tab", { name: /^Paid and closed (9)/ }).click();
    const rows = page.getByTestId("sf-loan-row");
    await expect(rows).toHaveCount(5);
    const pagination = page.getByTestId("sf-loans").getByRole("navigation", { name: "Pagination" });
    await expect(pagination).toContainText("Page 1 of 2");
    const first = await rows.first().innerText();
    await pagination.getByRole("button", { name: "Next page" }).click();
    await expect(pagination).toContainText("Page 2 of 2");
    await expect(rows).toHaveCount(4);
    expect(await rows.first().innerText()).not.toBe(first);
    await rows.first().click();
    await expect(page.getByTestId("sf-loan-detail")).toHaveCount(1);
    const year = page.getByTestId("sf-loans-year");
    const options = await year.locator("option").evaluateAll((items) => items.map((item) => (item as HTMLOptionElement).value));
    expect(options.length).toBeGreaterThanOrEqual(2);
    await year.selectOption(options.at(-1)!);
    await expect(page.getByRole("status").filter({ hasText: /repaid/ })).toBeVisible();
    await expect(pagination.or(page.getByTestId("sf-loans"))).toBeVisible();
    await expect(page.getByTestId("sf-loan-detail")).toHaveCount(0);
    if (await pagination.count()) await expect(pagination).toContainText("Page 1 of");
    await noSidewaysScroll(page);
  });

  test("a participant with no loans says so and shows no tabs", async ({ page }) => {
    await open(page, "/sinking-fund?view=participants");
    await page.getByRole("searchbox", { name: "Search participants" }).fill("Felix");
    await page.getByRole("button", { name: "Options for Felix Tan" }).click();
    await page.getByRole("menuitem", { name: "View details" }).click();
    await expect(page.getByRole("heading", { name: "Felix Tan", level: 1 })).toBeVisible();
    await expect(page.getByTestId("sf-loans")).toContainText("No loans yet.");
    await expect(page.getByRole("tab")).toHaveCount(0);
  });
});

// Feature 016: the monthly chart is readable (clear month labels, three distinct series, patterns as well as color).
test.describe("Monthly chart (feature 016)", () => {
  test.describe.configure({ timeout: 90_000 });

  const openChart = async (page: Page) => {
    await open(page, "/sinking-fund?view=participants");
    const chart = page.getByRole("region", { name: "Deposits, loans, and payments" });
    await expect(chart.getByRole("img", { name: "Deposits, loans, and payments per month" })).toBeVisible();
    return chart;
  };

  for (const width of [360, 1280]) {
    test("month labels are readable and do not overlap at " + width + "px", async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      const chart = await openChart(page);
      const labels = chart.locator("svg[role=img] text").filter({ hasText: /^[A-Z][a-z]{2} \d{2}$/ });
      await expect(labels).toHaveCount(6);
      const ratio = await labels.first().evaluate((element) => {
        const luminance = (rgb: string) => {
          const [r, g, b] = (rgb.match(/\d+(\.\d+)?/g) ?? ["0", "0", "0"]).slice(0, 3).map(Number).map((value) => { const c = value / 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; });
          return 0.2126 * r + 0.7152 * g + 0.0722 * b;
        };
        const text = luminance(getComputedStyle(element).fill);
        const card = luminance(getComputedStyle(element.closest("section")!).backgroundColor);
        return (Math.max(text, card) + 0.05) / (Math.min(text, card) + 0.05);
      });
      expect(ratio).toBeGreaterThanOrEqual(4.5);
      const boxes = await labels.evaluateAll((elements) => elements.map((element) => { const box = element.getBoundingClientRect(); return { left: box.left, right: box.right }; }));
      for (let index = 1; index < boxes.length; index += 1) expect(boxes[index].left).toBeGreaterThan(boxes[index - 1].right);
      // The rendered label height is a readable size (at least 11 css pixels).
      expect(await labels.first().evaluate((element) => element.getBoundingClientRect().height)).toBeGreaterThanOrEqual(11);
      await noSidewaysScroll(page);
    });
  }

  test("the three series use different colors and patterns, and the legend matches", async ({ page }) => {
    const chart = await openChart(page);
    const legend = chart.getByTestId("sf-bars-legend");
    for (const name of ["Deposits", "Loans", "Payments"]) await expect(legend.getByText(name, { exact: true })).toBeVisible();
    const fills = await chart.locator("svg[role=img] rect[fill], svg[role=img] rect.fill-chart-deposit").evaluateAll((rects) => rects.map((rect) => rect.getAttribute("fill") ?? rect.getAttribute("class") ?? ""));
    expect(fills.some((fill) => fill.includes("fill-chart-deposit"))).toBe(true);
    expect(fills.some((fill) => fill.includes("sf-bars-hatch"))).toBe(true);
    expect(fills.some((fill) => fill.includes("sf-bars-dots"))).toBe(true);
    const colors = await page.evaluate(() => ["deposit", "loan", "payment"].map((name) => getComputedStyle(document.documentElement).getPropertyValue("--token-chart-" + name).trim()));
    expect(new Set(colors).size).toBe(3);
    await chart.getByRole("button", { name: "View as table" }).click();
    await expect(chart.getByRole("columnheader", { name: "Payments" })).toBeVisible();
  });
});
