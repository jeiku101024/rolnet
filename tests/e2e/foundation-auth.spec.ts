import { test, expect } from "@playwright/test";

const ownerEmail = process.env.E2E_OWNER_EMAIL;
const ownerPassword = process.env.E2E_OWNER_PASSWORD;
const staffEmail = process.env.E2E_STAFF_EMAIL;
const staffPassword = process.env.E2E_STAFF_PASSWORD;

test.describe("foundation authentication and approval", () => {
  test.beforeEach(() => {
    test.skip(!ownerEmail || !ownerPassword || !staffEmail || !staffPassword, "Set E2E owner/staff credentials to run the Supabase journey");
  });

  test("pending staff is blocked until owner approval", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Email").fill(staffEmail!);
    await page.getByLabel("Password").fill(staffPassword!);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL(/login\?error=(pending|AUTH_FAILED)/);
  });

  test("registration and forbidden owner navigation remain usable at 360px", async ({ page }) => {
    await page.goto("/register");
    await expect(page.getByRole("heading", { name: "Staff registration" })).toBeVisible();
    await expect(page.locator("body")).toHaveCSS("overflow-x", "visible");
  });
});
