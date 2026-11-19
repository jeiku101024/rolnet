import { test, expect } from "@playwright/test";

const isDark = (page: import("@playwright/test").Page) => page.evaluate(() => document.documentElement.classList.contains("dark"));

test.describe("UI v2: dark mode", () => {
  test("follows a dark device with the class present before hydration", async ({ page }) => {
    await page.emulateMedia({ colorScheme: "dark" });
    await page.goto("/login", { waitUntil: "domcontentloaded" });
    expect(await isDark(page)).toBe(true);
  });

  test("toggle persists across reload and Match my device clears it", async ({ page }) => {
    await page.emulateMedia({ colorScheme: "light" });
    await page.goto("/register");
    await page.getByRole("button", { name: "Switch to dark theme" }).click();
    expect(await isDark(page)).toBe(true);
    await page.reload({ waitUntil: "domcontentloaded" });
    expect(await isDark(page)).toBe(true);
    const canvas = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    expect(canvas).not.toBe("rgb(255, 252, 243)");
    await page.getByRole("button", { name: "Theme options" }).click();
    await page.getByRole("menuitem", { name: /Match my device/ }).click();
    expect(await isDark(page)).toBe(false);
    expect(await page.evaluate(() => localStorage.getItem("rolnet-theme"))).toBeNull();
  });

  test("toggle is reachable on a signed-in screen at 360 px", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page.getByRole("button", { name: /Switch to (dark|light) theme/ })).toBeVisible();
  });

  test("print stays light even in dark mode", async ({ page }) => {
    await page.emulateMedia({ colorScheme: "dark" });
    await page.goto("/register");
    await page.emulateMedia({ media: "print", colorScheme: "dark" });
    const canvas = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--token-canvas").trim());
    expect(canvas.toLowerCase()).toBe("#fffcf3");
  });
});
