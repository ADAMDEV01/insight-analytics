import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";

type ApiSuccess<T> = { data: T };
type ApiFailure = { error?: { message?: string } };

async function register(page: import("@playwright/test").Page) {
  const email = `ci-journey-${randomUUID()}@example.com`;
  const password = "Strong-Test-Password-123!";
  await page.goto("/sign-up");
  await page.getByLabel("Full name").fill("INSIGHT Journey Test");
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Create account", exact: true }).click();
  await expect(page).toHaveURL(/\/overview$/, { timeout: 30_000 });
  return email;
}

async function responseData<T>(response: import("@playwright/test").APIResponse, action: string): Promise<T> {
  const body = (await response.json()) as ApiSuccess<T> & ApiFailure;
  if (!response.ok()) {
    throw new Error(`${action} failed (${response.status()}): ${body.error?.message || "Unknown API error"}`);
  }
  return body.data;
}

test("a new project can ingest events and power events, overview, funnel, retention, and export", async ({ page }) => {
  await register(page);

  const projectResponse = await page.request.post("/api/v1/projects", {
    data: { name: "CI Product Journey", description: "Full-stack ingestion acceptance test" },
  });
  const { project } = await responseData<{ project: { id: string } }>(projectResponse, "Project creation");

  const keyResponse = await page.request.post("/api/v1/api-keys", {
    data: { projectId: project.id, name: "CI browser key" },
  });
  const { key } = await responseData<{ key: string }>(keyResponse, "API key creation");
  expect(key).toMatch(/^ia_pub_[A-Za-z0-9_-]{32,}$/);

  const keyListResponse = await page.request.get(`/api/v1/api-keys?projectId=${project.id}`);
  const keyList = await responseData<{ keys: Array<Record<string, unknown>> }>(keyListResponse, "API key listing");
  expect(keyList.keys).toHaveLength(1);
  expect(JSON.stringify(keyList.keys)).not.toContain(key);
  expect(keyList.keys[0]).not.toHaveProperty("keyHash");

  const baseTime = Date.now() - 60_000;
  const eventNames = ["ci_page_view", "ci_sign_up", "ci_purchase"];
  const timestamp = (offset: number) => new Date(baseTime + offset * 1000).toISOString();
  const from = timestamp(0).slice(0, 10);
  const to = new Date().toISOString().slice(0, 10);
  const events = eventNames.map((eventName, index) => ({
    eventName,
    distinctId: "ci-customer-journey",
    sessionId: "ci-session-journey",
    properties: { source: "playwright", step: index + 1 },
    timestamp: timestamp(index),
    idempotencyKey: randomUUID(),
  }));

  const ingestResponse = await page.request.post("/api/v1/ingest", {
    headers: { Authorization: `Bearer ${key}` },
    data: { events },
  });
  const ingest = await responseData<{ accepted: number; duplicates: number; received: number }>(ingestResponse, "Event ingestion");
  expect(ingest).toEqual({ accepted: 3, duplicates: 0, received: 3 });

  const eventListResponse = await page.request.get(
    `/api/v1/analytics/events?projectId=${project.id}&limit=100&offset=0`,
  );
  const eventList = await responseData<{ events: Array<{ eventName: string }>; total: number }>(
    eventListResponse,
    "Event explorer",
  );
  expect(eventList.total).toBe(3);
  expect(eventList.events.map((event) => event.eventName).sort()).toEqual([...eventNames].sort());

  await expect.poll(async () => {
    const response = await page.request.get(
      `/api/v1/analytics/overview?projectId=${project.id}&days=30`,
    );
    if (!response.ok()) return -1;
    const data = await response.json() as ApiSuccess<{ totals: { events: number; activeUsers: number } }>;
    return data.data.totals.events;
  }, { timeout: 30_000, intervals: [250, 500, 1000, 2000] }).toBeGreaterThanOrEqual(3);

  const overviewResponse = await page.request.get(
    `/api/v1/analytics/overview?projectId=${project.id}&days=30`,
  );
  const overview = await responseData<{ totals: { events: number; activeUsers: number } }>(
    overviewResponse,
    "Overview analytics",
  );
  expect(overview.totals.events).toBe(3);
  expect(overview.totals.activeUsers).toBe(1);

  const funnelResponse = await page.request.post("/api/v1/analytics/funnels", {
    data: { projectId: project.id, steps: eventNames, from, to },
  });
  const funnel = await responseData<{ steps: Array<{ eventName: string; users: number }> }>(
    funnelResponse,
    "Funnel analysis",
  );
  expect(funnel.steps.map((step) => step.users)).toEqual([1, 1, 1]);

  const retentionResponse = await page.request.get(
    `/api/v1/analytics/retention?projectId=${project.id}&days=30`,
  );
  const retention = await responseData<{
    cohorts: Array<{ cohortDate: string; cohortSize: number; retention: Record<string, number | null> }>;
  }>(retentionResponse, "Retention analysis");
  const todayCohort = retention.cohorts.find((cohort) => cohort.cohortDate === from);
  expect(todayCohort?.cohortSize).toBe(1);
  expect(todayCohort?.retention["0"]).toBe(100);

  const exportResponse = await page.request.get(
    `/api/v1/analytics/events/export?projectId=${project.id}&from=${from}&to=${to}`,
  );
  expect(exportResponse.ok()).toBe(true);
  expect(exportResponse.headers()["content-type"]).toContain("text/csv");
  const csv = await exportResponse.text();
  for (const eventName of eventNames) expect(csv).toContain(eventName);
});
