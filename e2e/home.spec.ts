import { expect, test } from "@playwright/test";

test("landing page exposes the primary onboarding paths", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Turn product activity into");
  await expect(page.getByRole("link", { name: /Create your workspace/ })).toBeVisible();
  await expect(page.getByRole("link", { name: "Sign in" })).toBeVisible();
});
