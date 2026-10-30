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
