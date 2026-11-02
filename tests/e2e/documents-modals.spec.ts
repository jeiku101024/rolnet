import { test, expect, type Page } from "@playwright/test";

// Feature 013, in demo mode (360 px). Demo data: ROLNET-2's OR/CR has two History entries and an old
// revert whose file is deleted; ROLNET-3's MTOP has a kept reverted renewal; ROLNET-5's MTOP was a
// removed first upload; ROLNET-1's insurance was just restored, so Revert upload is hidden there.

async function open(page: Page, path = "/documents") {
  await page.goto(path);
  await page.waitForLoadState("networkidle");
}
const folder = (page: Page, name: string) => page.getByRole("treeitem", { name: new RegExp(`^${name}, `) });

async function openDocument(page: Page, unit: string, type: RegExp) {
  await folder(page, unit).click();
  await folder(page, unit).getByRole("treeitem", { name: type }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByText("Activity")).toBeVisible();
  return dialog;
}

test.describe("document modals", () => {
  test("shows details, History with Restore, Reverted uploads and Activity", async ({ page }) => {
    await open(page);
    const dialog = await openDocument(page, "ROLNET-2", /^OR\/CR, expires/);
    await expect(dialog.getByRole("heading", { name: "OR/CR · ROLNET-2" })).toBeVisible();
    await expect(dialog).toContainText("Expired");
    for (const label of ["Holder", "Document number", "Issued on", "Expiry date", "File name"]) await expect(dialog.getByText(label, { exact: true })).toBeVisible();
    await expect(dialog.getByRole("button", { name: /^Restore / })).toHaveCount(2);
    await expect(dialog.getByRole("button", { name: "Restore orcr-rolnet-2-2024.jpg" })).toBeVisible();
    await expect(dialog).toContainText("File deleted");
    await expect(dialog.getByRole("button", { name: "Bring back" })).toHaveCount(0);
    await expect(dialog.getByRole("button", { name: "Revert upload" })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
  });

  test("hides Revert upload right after a restore, and has no previous versions on a first upload", async ({ page }) => {
    await open(page);
    let dialog = await openDocument(page, "ROLNET-1", /^Insurance, expires/);
    await expect(dialog.getByRole("button", { name: "Revert upload" })).toHaveCount(0);
    await page.keyboard.press("Escape");
    dialog = await openDocument(page, "ROLNET-4", /^OR\/CR, expires/);
    await expect(dialog).toContainText("No previous versions.");
    await expect(dialog.getByText("Reverted uploads")).toHaveCount(0);
  });

  test("asks before reverting, restoring and bringing back, and Cancel returns to the details", async ({ page }) => {
    await open(page);
    let dialog = await openDocument(page, "ROLNET-2", /^OR\/CR, expires/);
    await dialog.getByRole("button", { name: "Revert upload" }).click();
    let confirm = page.getByRole("alertdialog");
    await expect(confirm.getByRole("heading", { name: "Revert to the previous version?" })).toBeVisible();
    await expect(confirm).toContainText("Current file");
    await expect(confirm).toContainText("Will be restored");
    await confirm.getByRole("button", { name: "Cancel" }).click();
    await expect(confirm).toHaveCount(0);
    await expect(dialog.getByRole("heading", { name: "OR/CR · ROLNET-2" })).toBeVisible();
    await dialog.getByRole("button", { name: "Restore orcr-rolnet-2-2023.jpg" }).click();
    confirm = page.getByRole("alertdialog");
    await expect(confirm.getByRole("heading", { name: "Restore this version?" })).toBeVisible();
    await expect(confirm).toContainText("Will become current");
    await expect(confirm).toContainText("Moves to history");
    await confirm.getByRole("button", { name: "Restore version" }).click();
    await expect(confirm).toContainText("Demo mode doesn't save changes.");
    await confirm.getByRole("button", { name: "Cancel" }).click();
    await page.keyboard.press("Escape");

    dialog = await openDocument(page, "ROLNET-3", /^MTOP franchise, expires/);
    await expect(dialog).toContainText("File kept until");
    await dialog.getByRole("button", { name: "Bring back" }).click();
    await expect(page.getByRole("alertdialog").getByRole("heading", { name: "Bring back this file?" })).toBeVisible();
  });

  test("lists recent reverts, with removed first uploads", async ({ page }) => {
    await open(page);
    await page.getByRole("button", { name: "Recently reverted (2)" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByRole("button", { name: "Bring back" })).toHaveCount(2);
    await expect(dialog).toContainText("ROLNET-5 · MTOP franchise · document removed");
    await expect(dialog).toContainText("Older reverts no longer have a file.");
    await dialog.getByRole("button", { name: "Bring back" }).nth(1).click();
    await expect(page.getByRole("alertdialog").getByRole("heading", { name: "Bring back this document?" })).toBeVisible();
  });

  test("scopes the upload modal by pane and checks the file", async ({ page }) => {
    await open(page);
    await page.getByRole("button", { name: "Upload unit document" }).click();
    let dialog = page.getByRole("dialog");
    await expect(dialog.getByRole("heading", { name: "Upload document" })).toBeVisible();
    await expect(dialog.locator("select[name=documentType]")).toBeEnabled();
    await expect(dialog.locator("select[name=holder]")).toBeDisabled();
    expect(await dialog.locator("select[name=documentType]").locator("option").allTextContents()).toEqual(["Choose a document type", "OR/CR", "MTOP franchise", "Insurance"]);
    await dialog.locator("select[name=documentType]").selectOption("insurance");
    await dialog.locator("select[name=holder]").selectOption({ label: "ROLNET-1" });
    await expect(dialog).toContainText("ROLNET-1 already has a Insurance. This upload renews it.");
    await expect(dialog.getByRole("button", { name: "Renew document" })).toBeVisible();
    await dialog.locator("input[name=file]").setInputFiles({ name: "notes.docx", mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", buffer: Buffer.from("x") });
    await expect(dialog).toContainText("Use a JPG, PNG, WebP or PDF file.");
    await dialog.getByRole("button", { name: "Remove notes.docx", exact: true }).click();
    await dialog.locator("input[name=file]").setInputFiles({ name: "big.pdf", mimeType: "application/pdf", buffer: Buffer.alloc(5 * 1024 * 1024 + 1) });
    await expect(dialog).toContainText("File is larger than 5 MB.");
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);

    await page.getByRole("button", { name: "Upload driver license" }).click();
    dialog = page.getByRole("dialog");
    await expect(dialog.locator("select[name=documentType]")).toBeDisabled();
    await expect(dialog.locator("select[name=holder]")).toBeEnabled();
    await dialog.getByRole("button", { name: "Upload document" }).click();
    await expect(dialog).toContainText("Choose the driver.");
    await expect(dialog).toContainText("Enter the expiry date.");
    await expect(dialog).toContainText("Choose the document file.");
  });

  test("opens the upload modal from an empty folder with the unit chosen", async ({ page }) => {
    await open(page);
    await folder(page, "ROLNET-11").click();
    await page.getByRole("button", { name: "upload a document" }).click();
    await expect(page.getByRole("dialog").locator("select[name=holder]")).toHaveValue(/.+/);
  });

  test("sends old detail links to the current document's modal", async ({ page }) => {
    await open(page, "/documents/00000000-0000-4000-8000-000600000031");
    await expect(page).toHaveURL(/\/documents\?doc=00000000-0000-4000-8000-000600000002/);
    await expect(page.getByRole("dialog").getByRole("heading", { name: "OR/CR · ROLNET-2" })).toBeVisible();
  });
});
