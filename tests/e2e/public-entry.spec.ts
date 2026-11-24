import { expect, test } from "@playwright/test";

test("pagina de recuperare a parolei rămâne accesibilă și utilizabilă", async ({ page }) => {
  await page.goto("/forgot-password");

  await expect(page.getByRole("heading", { name: /reset|parol/i })).toBeVisible();
  await expect(page.getByRole("textbox", { name: /email/i })).toBeVisible();
});
