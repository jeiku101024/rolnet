import { test, expect } from "@playwright/test";

test.describe("UI system refresh", () => {
  test("public workspace keeps a clear route entry and visible focus", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("link", { name: "Sign in" })).toBeVisible();
    await page.getByRole("link", { name: "Sign in" }).focus();
    await expect(page.getByRole("link", { name: "Sign in" })).toBeFocused();
  });

  test("dashboard exposes the recent-activity areas (feature 006)", async ({ page }) => {
    await page.goto("/dashboard");
    // Phones fold recent activity behind a button; wider screens show it straight away.
    const show = page.getByRole("button", { name: /Show recent activity/ });
    if (await show.isVisible()) await show.click();
    for (const title of ["Recent remittances", "Recent expenses", "Recent maintenance work", "Recently added documents"]) {
      await expect(page.getByRole("heading", { name: title })).toBeVisible();
    }
    await expect(page.getByRole("link", { name: "View all" }).first()).toBeVisible();
  });
});
