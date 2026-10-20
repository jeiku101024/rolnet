import {test,expect} from "@playwright/test";
test("audit route is protected",async({page})=>{await page.goto("/audit");await expect(page).toHaveURL(/login|audit/);});
