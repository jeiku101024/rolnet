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

  test("the participant detail opens from a card, lists loans and history, and closes", async ({ page }) => {
    await open(page, "/sinking-fund?view=participants");
    await page.getByRole("button", { name: "Options for Ana Reyes" }).click();
    await page.getByRole("menuitem", { name: "View details" }).click();
    const popup = page.getByRole("dialog", { name: "Ana Reyes" });
    await expect(popup).toBeVisible();
    await expect(page).toHaveURL(/detail=/);
    await expect(popup.getByTestId("sf-detail-loan").first()).toBeVisible();
    await expect(popup.getByRole("button", { name: "Add transaction" })).toBeVisible();
    await popup.getByRole("button", { name: "Close", exact: true }).click();
    await expect(popup).toHaveCount(0);
    await expect(page).not.toHaveURL(/detail=/);
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

    const link = details.getByRole("link", { name: "Download Excel" });
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

// Feature 016: the participant details are a centered pop-up that fits its content and closes without rendering the page.
test.describe("Participant pop-up (feature 016)", () => {
  test.describe.configure({ timeout: 90_000 });

  async function openAna(page: Page, name = "Ana Reyes") {
    await open(page, "/sinking-fund?view=participants");
    await page.getByRole("button", { name: "Options for " + name }).click();
    await page.getByRole("menuitem", { name: "View details" }).click();
    const popup = page.getByRole("dialog", { name });
    await expect(popup.getByRole("heading", { name: "History" })).toBeVisible();
    await expect(popup.getByTestId("sf-detail-row").first()).toBeVisible();
    return popup;
  }

  for (const width of [360, 1280]) {
    test("opens centered with every detail and no sideways scrolling at " + width + "px", async ({ page }) => {
      await page.setViewportSize({ width, height: 800 });
      const popup = await openAna(page);
      for (const label of ["Total savings", "Total loans", "Balance to pay"]) await expect(popup.getByText(label, { exact: true })).toBeVisible();
      await expect(popup.getByRole("button", { name: "Add transaction" })).toBeVisible();
      await expect(popup.getByRole("button", { name: "Withdraw savings" })).toBeVisible();
      await expect(popup.getByRole("heading", { name: "Loans" })).toBeVisible();
      await expect(popup.getByRole("heading", { name: "History" })).toBeVisible();
      expect(await popup.evaluate((element) => element.scrollWidth - element.clientWidth)).toBeLessThanOrEqual(0);
      await noSidewaysScroll(page);
      // Centered like the Add transaction pop-up: equal space left and right.
      const box = (await popup.boundingBox())!;
      expect(Math.abs(box.x - (width - box.x - box.width))).toBeLessThanOrEqual(2);
      // Every history row stays inside the pop-up.
      const rows = popup.getByTestId("sf-detail-row");
      expect(await rows.count()).toBeGreaterThan(0);
      for (const row of await rows.all()) {
        const rowBox = (await row.boundingBox())!;
        expect(rowBox.x + rowBox.width).toBeLessThanOrEqual(box.x + box.width + 1);
      }
    });
  }

  test("Load more adds history rows inside the pop-up", async ({ page }) => {
    const popup = await openAna(page, "Ben Cruz");
    const before = await popup.getByTestId("sf-detail-row").count();
    await popup.getByRole("button", { name: "Load more" }).click();
    await expect.poll(() => popup.getByTestId("sf-detail-row").count()).toBeGreaterThan(before);
  });

  test("the title and close button stay in view while the body scrolls", async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 520 });
    const popup = await openAna(page);
    const close = popup.getByRole("button", { name: "Close", exact: true });
    await popup.evaluate((element) => { element.scrollTop = element.scrollHeight; });
    const popupBox = (await popup.boundingBox())!;
    const closeBox = (await close.boundingBox())!;
    expect(closeBox.y).toBeGreaterThanOrEqual(popupBox.y - 1);
    expect(closeBox.y + closeBox.height).toBeLessThanOrEqual(popupBox.y + popupBox.height + 1);
  });

  test("closing by the button, Escape, or a tap outside leaves the page behind as it was, with no page request", async ({ page }) => {
    await open(page, "/sinking-fund?view=participants");
    await page.getByRole("searchbox", { name: "Search participants" }).fill("a");
    await expect(page).toHaveURL(/q=a/);
    await page.evaluate(() => { (window as unknown as { __kept: number }).__kept = 7; });
    const search = page.getByRole("searchbox", { name: "Search participants" });
    const cards = await page.getByTestId("sf-participant-card").count();

    for (const how of ["button", "escape", "outside"] as const) {
      await page.getByRole("button", { name: "Options for Ana Reyes" }).click();
      await page.getByRole("menuitem", { name: "View details" }).click();
      const popup = page.getByRole("dialog", { name: "Ana Reyes" });
      await expect(popup).toBeVisible();
      await expect(popup.getByTestId("sf-detail-loan").first()).toBeVisible();
      const scrollBefore = await page.evaluate(() => window.scrollY); // where the page was when the pop-up opened
      const requests: string[] = [];
      page.on("request", (request) => { if (request.resourceType() === "document" || request.url().includes("_rsc=")) requests.push(request.url()); });
      if (how === "button") await popup.getByRole("button", { name: "Close", exact: true }).click();
      else if (how === "escape") await page.keyboard.press("Escape");
      else await page.mouse.click(2, 2);
      await expect(popup).toHaveCount(0);
      await page.waitForTimeout(400);
      expect(requests, "closing with " + how + " makes no page request").toEqual([]);
      page.removeAllListeners("request");
      await expect(page).not.toHaveURL(/detail=/);
      await expect(page).toHaveURL(/q=a/);
      await expect(search).toHaveValue("a");
      expect(await page.getByTestId("sf-participant-card").count()).toBe(cards);
      expect(await page.evaluate(() => (window as unknown as { __kept?: number }).__kept)).toBe(7); // the page was never reloaded
      expect(Math.abs((await page.evaluate(() => window.scrollY)) - scrollBefore)).toBeLessThanOrEqual(2);
    }
  });

  test("a refresh keeps the pop-up open through the address, and Add transaction returns to it", async ({ page }) => {
    const popup = await openAna(page);
    const address = page.url();
    await page.reload();
    await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => undefined);
    await expect(page.getByRole("dialog", { name: "Ana Reyes" })).toBeVisible();
    expect(page.url()).toBe(address);

    await page.getByRole("dialog", { name: "Ana Reyes" }).getByRole("button", { name: "Add transaction" }).click();
    const form = page.getByRole("dialog", { name: /Add transaction/i });
    await expect(form).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(form).toHaveCount(0);
    await expect(page.getByRole("dialog", { name: "Ana Reyes" })).toBeVisible(); // back to the participant with fresh totals
    void popup;
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
