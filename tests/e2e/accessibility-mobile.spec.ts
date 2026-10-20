import {test,expect} from "@playwright/test";
test("public mobile pages have usable primary actions",async({page})=>{await page.goto("/");await expect(page.getByRole("link",{name:"Sign in"})).toBeVisible();await expect(page.locator("body")).toHaveCSS("overflow-x","visible");});
