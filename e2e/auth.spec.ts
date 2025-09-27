import { test, expect } from "@playwright/test";

test.describe("Authentication Flow", () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the home page before each test
    await page.goto("/");
  });

  test("should redirect to sign-in page when not authenticated", async ({
    page,
  }) => {
    // Should be redirected to sign-in page
    await expect(page).toHaveURL("/sign-in");
    await expect(page.getByRole("heading", { name: /sign in/i })).toBeVisible();
  });

  test("should display sign-in form elements", async ({ page }) => {
    await page.goto("/sign-in");

    // Check form elements are present
    await expect(page.getByLabel(/email/i)).toBeVisible();
    await expect(page.getByLabel(/password/i)).toBeVisible();
    await expect(page.getByRole("button", { name: /sign in/i })).toBeVisible();
    await expect(page.getByText(/forgot password/i)).toBeVisible();
    await expect(page.getByText(/don't have an account/i)).toBeVisible();
  });

  test("should display sign-up form elements", async ({ page }) => {
    await page.goto("/sign-up");

    // Check form elements are present
    await expect(page.getByLabel(/first name/i)).toBeVisible();
    await expect(page.getByLabel(/last name/i)).toBeVisible();
    await expect(page.getByLabel(/email/i)).toBeVisible();
    await expect(page.getByLabel(/password/i)).toBeVisible();
    await expect(page.getByRole("button", { name: /sign up/i })).toBeVisible();
    await expect(page.getByText(/already have an account/i)).toBeVisible();
  });

  test("should show validation errors for empty form submission", async ({
    page,
  }) => {
    await page.goto("/sign-in");

    // Submit empty form
    await page.getByRole("button", { name: /sign in/i }).click();

    // Check for validation errors
    await expect(page.getByText(/email is required/i)).toBeVisible();
    await expect(page.getByText(/password is required/i)).toBeVisible();
  });

  test("should show validation errors for invalid email", async ({ page }) => {
    await page.goto("/sign-in");

    // Fill form with invalid email
    await page.getByLabel(/email/i).fill("invalid-email");
    await page.getByLabel(/password/i).fill("password123");
    await page.getByRole("button", { name: /sign in/i }).click();

    // Check for validation error
    await expect(page.getByText(/invalid email/i)).toBeVisible();
  });

  test("should show validation errors for short password", async ({ page }) => {
    await page.goto("/sign-up");

    // Fill form with short password
    await page.getByLabel(/first name/i).fill("John");
    await page.getByLabel(/last name/i).fill("Doe");
    await page.getByLabel(/email/i).fill("john@example.com");
    await page.getByLabel(/password/i).fill("123");
    await page.getByRole("button", { name: /sign up/i }).click();

    // Check for validation error
    await expect(page.getByText(/password is required/i)).toBeVisible();
  });

  test("should navigate between sign-in and sign-up pages", async ({
    page,
  }) => {
    await page.goto("/sign-in");

    // Click on sign-up link
    await page.getByText(/don't have an account/i).click();
    await expect(page).toHaveURL("/sign-up");

    // Click on sign-in link
    await page.getByText(/already have an account/i).click();
    await expect(page).toHaveURL("/sign-in");
  });

  test("should navigate to forgot password page", async ({ page }) => {
    await page.goto("/sign-in");

    // Click on forgot password link
    await page.getByText(/forgot password/i).click();
    await expect(page).toHaveURL("/forgot-password");

    // Check forgot password form elements
    await expect(page.getByLabel(/email/i)).toBeVisible();
    await expect(
      page.getByRole("button", { name: /send reset email/i }),
    ).toBeVisible();
  });

  test("should display theme toggle", async ({ page }) => {
    await page.goto("/sign-in");

    // Check theme toggle is present
    const themeToggle = page.getByRole("button", { name: /toggle theme/i });
    await expect(themeToggle).toBeVisible();
  });

  test("should be responsive on mobile", async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto("/sign-in");

    // Check that form is still visible and usable
    await expect(page.getByLabel(/email/i)).toBeVisible();
    await expect(page.getByLabel(/password/i)).toBeVisible();
    await expect(page.getByRole("button", { name: /sign in/i })).toBeVisible();
  });
});
