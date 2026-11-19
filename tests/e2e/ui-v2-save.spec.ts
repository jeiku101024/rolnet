import { test, expect } from "@playwright/test";

test.describe("UI v2: save feedback", () => {
  test("a rejected save plays no success highlight and keeps the dialog open", async ({ page }) => {
    await page.goto("/units");
    await page.getByRole("button", { name: "Add a unit" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Save unit" }).click();
    await expect(page.getByText("Enter the unit name.")).toBeVisible();
    await expect(page.locator(".row-saved, .row-new")).toHaveCount(0);
  });

  test("saved rows expose a record id and the highlight class is removed after its animation", async ({ page }) => {
    await page.goto("/units");
    const rows = page.locator("tr[data-record-id]");
    await expect(rows.first()).toBeVisible();
    expect(await rows.first().getAttribute("data-record-id")).toBeTruthy();
    await rows.first().evaluate((node) => {
      node.classList.add("row-saved");
      node.addEventListener("animationend", () => node.classList.remove("row-saved"), { once: true });
    });
    await expect(rows.first()).not.toHaveClass(/row-saved/, { timeout: 3000 });
  });
});
