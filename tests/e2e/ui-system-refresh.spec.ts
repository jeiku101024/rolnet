import { test, expect } from "@playwright/test";

test.describe("UI system refresh", () => {
  test("public workspace keeps a clear route entry and visible focus", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("link", { name: "Sign in" })).toBeVisible();
    await page.getByRole("link", { name: "Sign in" }).focus();
    await expect(page.getByRole("link", { name: "Sign in" })).toBeFocused();
  });

  test("dashboard exposes all recent data glimpse areas when available", async ({ page }) => {
    await page.goto("/dashboard");
    for (const title of ["Recent remittances", "Recent units", "Recent expenses", "Maintenance activity", "Recent documents", "Recent drivers"]) {
      await expect(page.getByRole("heading", { name: title })).toBeVisible();
    }
    await expect(page.getByRole("link", { name: "View all" }).first()).toBeVisible();
  });
});
