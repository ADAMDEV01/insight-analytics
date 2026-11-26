import { expect, test } from "@playwright/test";

test("landing page exposes the primary onboarding paths and security headers", async ({ page }) => {
  const response = await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Turn product activity into");
  await expect(page.getByRole("link", { name: /Create your workspace/ })).toBeVisible();
  await expect(page.getByRole("navigation").getByRole("link", { name: "Sign in" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Sign in" })).toHaveCount(2);

  expect(response?.status()).toBe(200);
  expect(response?.headers()["x-content-type-options"]).toBe("nosniff");
  expect(response?.headers()["x-frame-options"]).toBe("DENY");
  expect(response?.headers()["referrer-policy"]).toBe("strict-origin-when-cross-origin");
});
