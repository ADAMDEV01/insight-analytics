import { expect, test } from "@playwright/test";

test("landing page exposes the primary onboarding paths and security headers", async ({ page }) => {
  const response = await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Turn product activity into");
  const workspaceLinks = page.getByRole("link", { name: "Create workspace" });
  await expect(workspaceLinks).toHaveCount(2);
  await expect(workspaceLinks.first()).toBeVisible();
  await expect(workspaceLinks.nth(1)).toBeVisible();
  await expect(page.getByRole("navigation").getByRole("link", { name: "Sign in" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Sign in" })).toHaveCount(1);

  expect(response?.status()).toBe(200);
  expect(response?.headers()["x-content-type-options"]).toBe("nosniff");
  expect(response?.headers()["x-frame-options"]).toBe("DENY");
  expect(response?.headers()["referrer-policy"]).toBe("strict-origin-when-cross-origin");
});
