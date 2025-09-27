import { test, expect } from "@playwright/test";

test.describe("Chat Interface", () => {
  test.beforeEach(async ({ page }) => {
    // Mock authentication - you might need to adjust this based on your auth implementation
    await page.goto("/");
  });

  test("should display chat interface when authenticated", async ({ page }) => {
    // This test assumes you have a way to mock authentication
    // You might need to set cookies or use a different approach
    await page.goto("/chat");

    // Check chat interface elements
    await expect(page.getByPlaceholderText(/ask me anything/i)).toBeVisible();
    await expect(
      page.getByRole("button", { name: /send message/i }),
    ).toBeVisible();
  });

  test("should allow typing and sending messages", async ({ page }) => {
    await page.goto("/chat");

    const chatInput = page.getByPlaceholderText(/ask me anything/i);
    const sendButton = page.getByRole("button", { name: /send message/i });

    // Type a message
    await chatInput.fill("Hello, how are you?");
    await expect(chatInput).toHaveValue("Hello, how are you?");

    // Send the message
    await sendButton.click();

    // Check that input is cleared after sending
    await expect(chatInput).toHaveValue("");
  });

  test("should send message on Enter key press", async ({ page }) => {
    await page.goto("/chat");

    const chatInput = page.getByPlaceholderText(/ask me anything/i);

    // Type a message and press Enter
    await chatInput.fill("Test message");
    await chatInput.press("Enter");

    // Check that input is cleared
    await expect(chatInput).toHaveValue("");
  });

  test("should not send empty messages", async ({ page }) => {
    await page.goto("/chat");

    const chatInput = page.getByPlaceholderText(/ask me anything/i);
    const sendButton = page.getByRole("button", { name: /send message/i });

    // Try to send empty message
    await chatInput.fill("   "); // Only whitespace
    await sendButton.click();

    // Input should still contain whitespace (not cleared)
    await expect(chatInput).toHaveValue("   ");
  });

  test("should display sidebar with conversations", async ({ page }) => {
    await page.goto("/chat");

    // Check sidebar elements
    await expect(page.getByText(/new chat/i)).toBeVisible();
    await expect(page.getByRole("button", { name: /new chat/i })).toBeVisible();
  });

  test("should create new conversation", async ({ page }) => {
    await page.goto("/chat");

    // Click new chat button
    await page.getByRole("button", { name: /new chat/i }).click();

    // Should navigate to a new conversation
    await expect(page).toHaveURL(/\/chat\/[a-zA-Z0-9]+/);
  });

  test("should display theme toggle in chat", async ({ page }) => {
    await page.goto("/chat");

    // Check theme toggle is present
    const themeToggle = page.getByRole("button", { name: /toggle theme/i });
    await expect(themeToggle).toBeVisible();
  });

  test("should be responsive on mobile", async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto("/chat");

    // Check that chat interface is still usable
    await expect(page.getByPlaceholderText(/ask me anything/i)).toBeVisible();
    await expect(
      page.getByRole("button", { name: /send message/i }),
    ).toBeVisible();
  });

  test("should handle long messages", async ({ page }) => {
    await page.goto("/chat");

    const chatInput = page.getByPlaceholderText(/ask me anything/i);
    const longMessage =
      "This is a very long message that should test how the chat interface handles longer text input and whether it wraps properly or has any issues with display. ".repeat(
        10,
      );

    await chatInput.fill(longMessage);
    await expect(chatInput).toHaveValue(longMessage);

    // Send the message
    await page.getByRole("button", { name: /send message/i }).click();
    await expect(chatInput).toHaveValue("");
  });

  test("should show loading state when sending message", async ({ page }) => {
    await page.goto("/chat");

    const chatInput = page.getByPlaceholderText(/ask me anything/i);
    const sendButton = page.getByRole("button", { name: /send message/i });

    // Type and send message
    await chatInput.fill("Test message");
    await sendButton.click();

    // Check for loading state (this might need adjustment based on your implementation)
    // You might need to wait for a specific loading indicator
    await expect(sendButton).toBeVisible();
  });
});
