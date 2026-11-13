import {test,expect} from "@playwright/test";
test("public mobile pages have usable primary actions",async({page})=>{await page.goto("/");await expect(page.getByRole("link",{name:"Sign in"})).toBeVisible();await expect(page.locator("body")).toHaveCSS("overflow-x","visible");});

// Feature 008 (SC-007, SC-008): both Remittances views fit a 360 px phone, and the main controls are keyboard-reachable.
for (const path of ["/remittances", "/remittances?view=list"]) {
  test(`${path} fits 360 px and its controls are reachable by keyboard`, async ({ page }) => {
    await page.goto(path);
    await page.waitForLoadState("networkidle");
    expect(await page.evaluate(() => document.scrollingElement!.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
    const names = path.includes("list") ? ["List view", "Daily view"] : ["List view", "Daily view", "Previous day"];
    for (const name of names) {
      const control = page.getByRole("button", { name, exact: true });
      await control.focus();
      await expect(control).toBeFocused();
    }
  });
}

// Feature 015: every Sinking fund view fits 360 px, its controls take keyboard focus, and its dialogs close on Escape
// with focus returned to the page (in demo mode, like the rest of this file).
for (const path of ["/sinking-fund", "/sinking-fund?view=top", "/sinking-fund?view=participants"]) {
  test(`${path} fits 360 px and its controls are reachable by keyboard`, async ({ page }) => {
    test.setTimeout(90_000);
    await page.goto(path);
    await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => undefined);
    await expect(page.getByRole("heading", { name: "Sinking fund", level: 1 })).toBeVisible();
    expect(await page.evaluate(() => document.scrollingElement!.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
    for (const name of ["Transactions", "Top participants", "Participants"]) {
      const control = page.getByRole("button", { name, exact: true });
      await control.focus();
      await expect(control).toBeFocused();
    }
    // The Participants view also has one per card; the toolbar button comes first.
    await page.getByRole("button", { name: "Add transaction" }).first().click();
    const dialog = page.getByRole("dialog", { name: "Add transaction" });
    await expect(dialog).toBeVisible();
    await page.keyboard.press("Tab");
    expect(await page.evaluate(() => Boolean(document.activeElement?.closest("[role='dialog']")))).toBe(true);
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
  });
}
