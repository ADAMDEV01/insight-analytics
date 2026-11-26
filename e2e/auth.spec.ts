import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";

async function expectDashboardOrError(page: import("@playwright/test").Page, action: string) {
  try {
    await page.waitForURL(/\/overview$/, { timeout: 30_000 });
  } catch {
    const message = await page.getByRole("alert").textContent().catch(() => null);
    throw new Error(`${action} did not complete. ${message || "No visible authentication error was rendered."}`);
  }
  await expect(page.getByRole("heading", { name: "Overview", exact: true })).toBeVisible();
}

test("a user can register, keep a session, sign out, and sign back in", async ({ page }) => {
  const email = `ci-${randomUUID()}@example.com`;
  const password = "Strong-Test-Password-123!";

  await page.goto("/sign-up");
  await page.getByLabel("Full name").fill("INSIGHT CI User");
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Create account", exact: true }).click();
  await expectDashboardOrError(page, "Account registration");

  await page.reload();
  await expect(page.getByRole("heading", { name: "Overview", exact: true })).toBeVisible();

  if ((page.viewportSize()?.width ?? 1280) < 1024) {
    await page.getByRole("button", { name: "Open navigation" }).click();
  }
  await expect(page.getByRole("complementary").getByText(email, { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/sign-in$/, { timeout: 15_000 });

  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expectDashboardOrError(page, "Account sign-in");
});
