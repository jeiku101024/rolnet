import { test, expect, type Page } from "@playwright/test";

// Feature 013, in demo mode (360 px phone by default). Demo data (lib/demo/mode.ts): ROLNET-2's
// OR/CR expired 3 days ago, ROLNET-3's MTOP is due in 2 days, ROLNET-11 has no documents, ROLNET-12
// is archived, and the licenses are Pedro Santos, Juan Dela Cruz and Rey Navarro (Inactive). Writes
// are disabled in demo; saves are covered by pgTAP and the quickstart walkthrough.

const folder = (page: Page, name: string) => page.getByRole("treeitem", { name: new RegExp(`^${name}, `) });
const unitPane = (page: Page) => page.getByRole("region", { name: "Unit documents" });
const driverPane = (page: Page) => page.getByRole("region", { name: "Driver licenses" });

async function open(page: Page, path = "/documents") {
  await page.goto(path);
  await page.waitForLoadState("networkidle");
}

test.describe("documents page", () => {
  test("shows two panes, no form card, and fits a phone", async ({ page }) => {
    await open(page);
    await expect(page.getByRole("heading", { name: "Documents", level: 1 })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Upload document" })).toHaveCount(0);
    await expect(unitPane(page).getByText("10 documents · 11 units")).toBeVisible();
    await expect(driverPane(page).getByText("3 licenses · 3 drivers")).toBeVisible();
    await expect(page.getByRole("button", { name: "Upload unit document" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Upload driver license" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Recently reverted (2)" })).toBeVisible();
    await expect(page.getByLabel("Sort (both panes)")).toHaveValue("expiry");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });

  test("lists one collapsed folder per active unit with pills and counts, 10 per page", async ({ page }) => {
    await open(page);
    await expect(page.getByRole("tree", { name: "Unit documents" }).locator("> li")).toHaveCount(10);
    const pager = page.getByRole("navigation", { name: "Folder pages" });
    await expect(pager).toContainText("1–10 of 11 folders");
    await expect(pager).toContainText("Page 1 of 2");
    await expect(folder(page, "ROLNET-12")).toHaveCount(0);
    await expect(folder(page, "ROLNET-2")).toHaveAttribute("aria-expanded", "false");
    await expect(folder(page, "ROLNET-2")).toContainText("1 expired");
    await expect(folder(page, "ROLNET-3")).toContainText("1 due");
    await folder(page, "ROLNET-2").click();
    await expect(folder(page, "ROLNET-2")).toHaveAttribute("aria-expanded", "true");
    await expect(folder(page, "ROLNET-2").getByRole("group")).toContainText("ORCR-0002 · Expires");
    await pager.getByRole("button", { name: "Next page" }).click();
    await expect(page).toHaveURL(/upage=2/);
    await expect(page.getByRole("tree").locator("> li")).toHaveCount(1);
    await folder(page, "ROLNET-11").click();
    await expect(folder(page, "ROLNET-11")).toContainText("Empty. Add or upload a document.");
    await page.getByRole("searchbox", { name: "Search unit documents" }).fill("rolnet");
    await expect(pager).toContainText("Page 1 of 2");
    await page.getByRole("searchbox", { name: "Search unit documents" }).fill("");
    await page.getByRole("button", { name: "Collapse all folders" }).click();
    await expect(page.locator("[role=tree] > li[aria-expanded=true]")).toHaveCount(0);
    await page.getByRole("button", { name: "Expand all folders" }).click();
    await expect(page.locator("[role=tree] > li[aria-expanded=false]")).toHaveCount(0);
  });

  test("is one tab stop and works from the keyboard", async ({ page }) => {
    await open(page);
    await expect(page.locator("[role=tree] [tabindex='0']")).toHaveCount(1);
    await folder(page, "ROLNET-2").focus();
    await page.keyboard.press("ArrowRight");
    await expect(folder(page, "ROLNET-2")).toHaveAttribute("aria-expanded", "true");
    await page.keyboard.press("ArrowRight");
    await expect(page.getByRole("treeitem", { name: /^OR\/CR, expires/ })).toBeFocused();
    await page.keyboard.press("ArrowLeft");
    await expect(folder(page, "ROLNET-2")).toBeFocused();
    await page.keyboard.press("ArrowLeft");
    await expect(folder(page, "ROLNET-2")).toHaveAttribute("aria-expanded", "false");
    await page.keyboard.press("ArrowDown");
    await expect(folder(page, "ROLNET-3")).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(folder(page, "ROLNET-3")).toHaveAttribute("aria-expanded", "true");
  });

  test("searches the tree like a file explorer and restores the folders after", async ({ page }) => {
    await open(page);
    await folder(page, "ROLNET-4").click();
    const search = page.getByRole("searchbox", { name: "Search unit documents" });
    await search.fill("rolnet-2");
    await expect(unitPane(page).getByRole("status").first()).toHaveText("1 result in 1 folder");
    await expect(folder(page, "ROLNET-2")).toHaveAttribute("aria-expanded", "true");
    await expect(folder(page, "ROLNET-2").locator("mark").first()).toHaveText("ROLNET-2");
    await search.fill("expired");
    await expect(unitPane(page).getByRole("status").first()).toHaveText("1 result in 1 folder");
    await search.fill("nothing-like-this");
    await expect(unitPane(page).getByText("No documents match.").first()).toBeVisible();
    await search.fill("");
    await expect(folder(page, "ROLNET-4")).toHaveAttribute("aria-expanded", "true");
    await expect(folder(page, "ROLNET-2")).toHaveAttribute("aria-expanded", "false");
    await expect(driverPane(page).getByRole("listitem")).toHaveCount(3);
  });

  test("filters each pane on its own with chips, and keeps state in the address", async ({ page }) => {
    await open(page);
    await unitPane(page).getByRole("button", { name: "Filters" }).click();
    await unitPane(page).getByRole("checkbox", { name: "Expired" }).click();
    await unitPane(page).getByRole("checkbox", { name: "Due within 7 days" }).click();
    await expect(unitPane(page).getByRole("button", { name: "Filters (2 on)" })).toBeVisible();
    await expect(unitPane(page).getByRole("button", { name: "Remove filter Status: Expired" })).toBeVisible();
    await expect(page.getByRole("tree").locator("> li")).toHaveCount(2);
    await expect(folder(page, "ROLNET-11")).toHaveCount(0);
    await expect(driverPane(page).getByRole("listitem")).toHaveCount(3);
    await page.getByLabel("Sort (both panes)").selectOption("name");
    await expect(page).toHaveURL(/ustatus=expired,due/);
    await page.reload();
    await page.waitForLoadState("networkidle");
    await expect(unitPane(page).getByRole("button", { name: "Filters (2 on)" })).toBeVisible();
    await expect(page.getByLabel("Sort (both panes)")).toHaveValue("name");
    await unitPane(page).getByRole("button", { name: "Clear all" }).click();
    await expect(page.getByRole("tree").locator("> li")).toHaveCount(10);
  });

  test("sorts folders and licenses with the shared sort", async ({ page }) => {
    await open(page);
    const names = () => page.getByRole("tree").locator("> li").evaluateAll((items) => items.map((item) => item.getAttribute("aria-label")?.split(",")[0]));
    expect((await names()).slice(0, 2)).toEqual(["ROLNET-2", "ROLNET-3"]);
    await page.getByLabel("Sort (both panes)").selectOption("name");
    expect((await names()).slice(0, 3)).toEqual(["ROLNET-1", "ROLNET-2", "ROLNET-3"]);
    await expect(driverPane(page).getByRole("listitem").first()).toContainText("Juan Dela Cruz");
    await page.getByLabel("Sort (both panes)").selectOption("expiry-desc");
    await expect(driverPane(page).getByRole("listitem").first()).toContainText("Rey Navarro");
  });

  test("lists driver licenses, inactive drivers included, with their own search and filter", async ({ page }) => {
    await open(page);
    await expect(driverPane(page).getByRole("listitem")).toHaveCount(3);
    await expect(driverPane(page)).toContainText("Rey Navarro");
    await page.getByRole("searchbox", { name: "Search driver licenses" }).fill("juan");
    await expect(driverPane(page).getByRole("listitem")).toHaveCount(1);
    await expect(driverPane(page).getByRole("status")).toHaveText("1 result");
    await page.getByRole("searchbox", { name: "Search driver licenses" }).fill("zzz");
    await expect(driverPane(page).getByText("No licenses match.")).toBeVisible();
    await expect(page.getByRole("tree").locator("> li")).toHaveCount(10);
  });

  test("opens from the dashboard with Expired and Due within 7 days in both panes", async ({ page }) => {
    await open(page, "/dashboard");
    await page.getByRole("link", { name: /Documents due/ }).click();
    await page.waitForLoadState("networkidle");
    await expect(page.getByRole("button", { name: "Filters (2 on)" })).toHaveCount(2);
  });
});
