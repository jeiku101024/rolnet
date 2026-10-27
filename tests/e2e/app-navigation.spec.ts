import { expect, test, type Page } from "@playwright/test";

const ownerEmail = process.env.E2E_OWNER_EMAIL ?? process.env.DEMO_MASTER_EMAIL ?? "owner@demo.local";
const ownerPassword = process.env.E2E_OWNER_PASSWORD ?? process.env.DEMO_MASTER_PASSWORD ?? "demo1234";
const staffEmail = process.env.E2E_STAFF_EMAIL;
const staffPassword = process.env.E2E_STAFF_PASSWORD;

async function signIn(page: Page, email: string, password: string) {
  await page.goto("/login", { waitUntil: "domcontentloaded" });
  if (await page.getByText("Demo mode:", { exact: false }).isVisible().catch(() => false)) {
    await page.goto("/", { waitUntil: "domcontentloaded" });
    return;
  }
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/login"));
}

async function openNavigation(page: Page) {
  const navigation = page.getByRole("navigation", { name: "Primary navigation" });
  if (!(await navigation.isVisible().catch(() => false))) {
    const trigger = page.getByRole("button", { name: "Open navigation" });
    await expect(trigger).toBeEnabled();
    await trigger.click();
  }
  await expect(navigation).toBeVisible();
  return navigation;
}

test.describe("app navigation", () => {
  test("authentication pages expose public navigation only", async ({ page }) => {
    await page.goto("/login", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("navigation", { name: "Public navigation" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Register", exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: "Dashboard" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Logout" })).toHaveCount(0);
  });

  test("owner receives ten grouped destinations and an active page", async ({ page }) => {
    await signIn(page, ownerEmail, ownerPassword);
    await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
    const navigation = await openNavigation(page);
    await expect(navigation.getByRole("link")).toHaveCount(11); // Brand home plus ten destinations.
    await expect(navigation.getByRole("link", { name: "Dashboard" })).toHaveAttribute("aria-current", "page");
    for (const label of ["Dashboard", "Units", "Drivers", "Remittances", "Expenses", "Maintenance", "Documents", "Reports", "Audit History", "Staff Accounts"]) {
      await expect(navigation.getByRole("link", { name: label })).toBeVisible();
    }
  });

  test("staff receives the five destinations permitted by current guards", async ({ page }) => {
    test.skip(!staffEmail || !staffPassword, "Set E2E staff credentials to exercise the staff menu");
    await signIn(page, staffEmail!, staffPassword!);
    await page.goto("/units", { waitUntil: "domcontentloaded" });
    const navigation = await openNavigation(page);
    for (const label of ["Units", "Drivers", "Remittances", "Expenses", "Maintenance"]) {
      await expect(navigation.getByRole("link", { name: label })).toBeVisible();
    }
    for (const label of ["Dashboard", "Documents", "Reports", "Audit History", "Staff Accounts"]) {
      await expect(navigation.getByRole("link", { name: label })).toHaveCount(0);
    }
  });

  test("mobile navigation opens, dismisses, restores focus, and does not overflow", async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 800 });
    await signIn(page, ownerEmail, ownerPassword);
    const trigger = page.getByRole("button", { name: "Open navigation" });
    await expect(trigger).toBeVisible();
    const box = await trigger.boundingBox();
    expect(box?.width).toBeGreaterThanOrEqual(44);
    expect(box?.height).toBeGreaterThanOrEqual(44);

    const navigation = await openNavigation(page);
    await expect(navigation.getByRole("link", { name: "Staff Accounts" })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(navigation).toBeHidden();
    await expect(trigger).toBeFocused();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  });

  test("icons are decorative while labels and non-color active state remain", async ({ page }) => {
    await signIn(page, ownerEmail, ownerPassword);
    await page.goto("/units", { waitUntil: "domcontentloaded" });
    const navigation = await openNavigation(page);
    const units = navigation.getByRole("link", { name: "Units" });
    await expect(units).toHaveAttribute("aria-current", "page");
    await expect(units.locator("svg[aria-hidden=true]")).toHaveCount(1);
    await expect(units).toHaveAttribute("data-active", "true");
  });

  test("logout ends the session and protects fleet routes", async ({ page }) => {
    await signIn(page, ownerEmail, ownerPassword);
    const navigation = await openNavigation(page);
    await navigation.getByRole("button", { name: "Logout" }).click();
    await expect(page).toHaveURL(/\/login/);
    await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
    await expect(page).toHaveURL(/\/login/);
  });
});
