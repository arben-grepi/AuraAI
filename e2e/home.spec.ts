import { test, expect } from "@playwright/test";

test.describe("Home and auth", () => {
  test("unauthenticated / redirects to sign-in", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/sign-in/);
  });

  test("sign-in page shows form", async ({ page }) => {
    await page.goto("/sign-in");
    await expect(page.getByRole("heading", { name: /sign in to/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /^Sign in$/ })).toBeVisible();
    await expect(page.getByLabel(/email/i)).toBeVisible();
  });

  test("sign-in has link to sign-up", async ({ page }) => {
    await page.goto("/sign-in");
    await expect(page.getByRole("link", { name: /sign up/i })).toBeVisible();
    await page.getByRole("link", { name: /sign up/i }).click();
    await expect(page).toHaveURL(/\/sign-up/);
  });
});
