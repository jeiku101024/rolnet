import { test, expect } from "@playwright/test";

test.describe("UI v2: pop-up animations", () => {
  test("dialog animates in and out and leaves nothing behind after 20 cycles", async ({ page }) => {
    await page.goto("/units");
    const open = page.getByRole("button", { name: "Add a unit" });
    for (let i = 0; i < 20; i += 1) {
      await open.click();
      const dialog = page.getByRole("dialog");
      await expect(dialog).toBeVisible();
      if (i === 0) {
        const transition = await dialog.evaluate((node) => getComputedStyle(node).transitionProperty);
        expect(transition).toContain("opacity");
        expect(transition).toContain("scale");
        const duration = await dialog.evaluate((node) => parseFloat(getComputedStyle(node).transitionDuration.split(",")[0]));
        expect(duration).toBeLessThanOrEqual(0.25);
      }
      if (i % 2 === 0) await page.keyboard.press("Escape");
      else await dialog.getByRole("button", { name: "Close" }).click();
      await expect(dialog).toHaveCount(0);
    }
    await expect(open).toBeFocused();
    expect(await page.evaluate(() => getComputedStyle(document.body).overflow)).not.toBe("hidden");
    await expect(page.locator("[data-slot='dialog-content']")).toHaveCount(0);
  });

  test("reopening while closing and double Close do not break", async ({ page }) => {
    await page.goto("/units");
    const open = page.getByRole("button", { name: "Add a unit" });
    await open.click();
    const dialog = page.getByRole("dialog");
    await dialog.getByRole("button", { name: "Close" }).dblclick({ force: true }).catch(() => {});
    await open.click({ force: true }).catch(() => {});
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0);
  });

  test("reduced motion removes the scale", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/units");
    await page.getByRole("button", { name: "Add a unit" }).click();
    const transition = await page.getByRole("dialog").evaluate((node) => getComputedStyle(node).transitionProperty);
    expect(transition).not.toContain("scale");
  });
});
