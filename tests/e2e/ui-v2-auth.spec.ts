import { test, expect } from "@playwright/test";

test.describe("UI v2: sign-in and register screen", () => {
  test("signed-out nav has no Ledger link and the logo is centered above the card", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByRole("link", { name: "Sign in" }).first()).toBeVisible();
    await expect(page.getByRole("link", { name: "Register" }).first()).toBeVisible();
    await expect(page.getByRole("link", { name: "Ledger" })).toHaveCount(0);
    const logo = await page.locator("main img.logo-full-auth.brand-light-only").boundingBox();
    const viewport = page.viewportSize()!;
    expect(logo).not.toBeNull();
    expect(Math.abs(logo!.x + logo!.width / 2 - viewport.width / 2)).toBeLessThanOrEqual(2);
    expect(await page.locator(".auth-blob-a").evaluate((node) => getComputedStyle(node).animationName)).not.toBe("none");
  });

  test("swap slides the cards, keeps typed values, history and title in sync", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Email").first().fill("owner@example.com");
    const track = page.locator(".auth-track");
    await expect(track).toHaveAttribute("data-active", "login");
    await page.getByRole("link", { name: "Register for approval" }).click();
    await expect(page).toHaveURL(/\/register$/);
    await expect(track).toHaveAttribute("data-active", "register");
    await expect(page.locator("#login-panel")).toHaveAttribute("inert", "");
    await expect(page.getByLabel("Display name")).toBeFocused();
    await expect(page).toHaveTitle(/Staff registration/);
    await page.goBack();
    await expect(page).toHaveURL(/\/login$/);
    await expect(track).toHaveAttribute("data-active", "login");
    await expect(page).toHaveTitle(/Sign in/);
    await expect(page.getByLabel("Email").first()).toHaveValue("owner@example.com");
  });

  test("rapid switching ends with exactly one active panel", async ({ page }) => {
    await page.goto("/login");
    for (let i = 0; i < 5; i += 1) {
      await page.getByRole("link", { name: "Register for approval" }).click();
      await page.getByRole("link", { name: "Return to sign in" }).click();
    }
    await expect(page.locator(".auth-panel:not([inert])")).toHaveCount(1);
  });

  test("direct load of /register shows it without a transition", async ({ page }) => {
    await page.goto("/register");
    await expect(page.locator(".auth-track")).toHaveAttribute("data-active", "register");
    await expect(page.getByRole("heading", { name: "Staff registration" })).toBeVisible();
  });

  test("reduced motion stops the background and the slide", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/login");
    expect(await page.locator(".auth-blob-a").evaluate((node) => getComputedStyle(node).animationName)).toBe("none");
    expect(await page.locator(".auth-track").evaluate((node) => getComputedStyle(node).transitionDuration)).toBe("0s");
  });
});
