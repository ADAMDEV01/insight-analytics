import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";

test("a user can register, keep a session, sign out, and sign back in", async ({ page }) => {
  const email = `ci-${randomUUID()}@example.com`;
  const password = "Strong-Test-Password-123!";

  await page.goto("/sign-up");
  await page.getByLabel("Full name").fill("INSIGHT CI User");
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Create account", exact: true }).click();

  await expect(page).toHaveURL(/\/overview$/, { timeout: 30_000 });
  await expect(page.getByRole("heading", { name: "Overview", exact: true })).toBeVisible();

  await page.reload();
  await expect(page.getByRole("heading", { name: "Overview", exact: true })).toBeVisible();

  if ((page.viewportSize()?.width ?? 1280) < 1024) {
    await page.getByRole("button", { name: "Open navigation" }).click();
  }
  await expect(page.getByText(email, { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/sign-in$/, { timeout: 15_000 });

  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/overview$/, { timeout: 30_000 });
  await expect(page.getByRole("heading", { name: "Overview", exact: true })).toBeVisible();
});
