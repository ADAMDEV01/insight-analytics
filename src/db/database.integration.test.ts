import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createHash, randomUUID } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { db, pool } from "@/db";
import { apiKeys, ingestRateLimits, projects, rateLimit, user as users, workspaces, workspaceMembers } from "@/db/schema";
import { getProjectAccess } from "@/lib/permissions";
import { persistEventBatch } from "@/lib/ingestion";
import { processOutboxBatch } from "@/lib/process-outbox";
import { consumeIngestRateLimit } from "@/lib/ingest-rate-limit";

const enabled = process.env.RUN_DB_INTEGRATION === "1";

describe.skipIf(!enabled)("PostgreSQL event ingestion and outbox", () => {
  const suffix = randomUUID();
  const ownerId = "integration-owner-" + suffix;
  const strangerId = "integration-stranger-" + suffix;
  let workspaceId = "";
  let projectId = "";
  let apiKeyId = "";
  const eventCount = 15;
  const authRateLimitKey = "integration-auth-rate-limit-" + suffix;

  beforeAll(async () => {
    await db.insert(users).values([
      { id: ownerId, name: "Integration Owner", email: ownerId + "@example.test", emailVerified: true },
      { id: strangerId, name: "Unrelated User", email: strangerId + "@example.test", emailVerified: true },
    ]);
    const [workspace] = await db.insert(workspaces).values({
      name: "Integration workspace",
      slug: "integration-" + suffix,
      createdBy: ownerId,
    }).returning();
    workspaceId = workspace.id;
    await db.insert(workspaceMembers).values({ workspaceId, userId: ownerId, role: "owner" });
    const [project] = await db.insert(projects).values({
      workspaceId,
      name: "Integration project",
      slug: "integration",
    }).returning();
    projectId = project.id;
    const [apiKey] = await db.insert(apiKeys).values({
      projectId,
      name: "Integration rate-limit key",
      prefix: "ia_pub_" + suffix.replace(/-/g, "").slice(0, 16),
      keyHash: createHash("sha256").update("integration-" + suffix).digest("hex"),
      allowedOrigins: ["https://integration.example.test"],
    }).returning({ id: apiKeys.id });
    apiKeyId = apiKey.id;
  });

  afterAll(async () => {
    await db.delete(rateLimit).where(eq(rateLimit.key, authRateLimitKey));
    if (apiKeyId) await db.delete(apiKeys).where(eq(apiKeys.id, apiKeyId));
    if (workspaceId) await db.delete(workspaces).where(eq(workspaces.id, workspaceId));
    await db.delete(users).where(eq(users.id, ownerId));
    await db.delete(users).where(eq(users.id, strangerId));
  });

  it("persists and atomically increments auth rate-limit counters in PostgreSQL", async () => {
    await Promise.all(
      Array.from({ length: 5 }, () =>
        db
          .insert(rateLimit)
          .values({
            id: randomUUID(),
            key: authRateLimitKey,
            count: 1,
            lastRequest: Date.now(),
          })
          .onConflictDoUpdate({
            target: rateLimit.key,
            set: {
              count: sql`${rateLimit.count} + 1`,
              lastRequest: Date.now(),
            },
          }),
      ),
    );

    const [counter] = await db
      .select({ count: rateLimit.count })
      .from(rateLimit)
      .where(eq(rateLimit.key, authRateLimitKey));

    expect(counter?.count).toBe(5);
  });

  it("enforces the per-key ingestion limit under concurrent PostgreSQL requests", async () => {
    const previous = process.env.INGEST_RATE_LIMIT_PER_MINUTE;
    process.env.INGEST_RATE_LIMIT_PER_MINUTE = "5";

    try {
      const bucketTime = new Date();
      const results = await Promise.all(
        Array.from({ length: 20 }, () => consumeIngestRateLimit(apiKeyId, bucketTime)),
      );
      const [bucket] = await db
        .select({ hits: ingestRateLimits.hits })
        .from(ingestRateLimits)
        .where(eq(ingestRateLimits.apiKeyId, apiKeyId));

      expect(results.filter(Boolean)).toHaveLength(5);
      expect(results.filter((accepted) => !accepted)).toHaveLength(15);
      expect(bucket?.hits).toBe(5);
    } finally {
      if (previous === undefined) delete process.env.INGEST_RATE_LIMIT_PER_MINUTE;
      else process.env.INGEST_RATE_LIMIT_PER_MINUTE = previous;
    }
  });

  it("enforces project membership and persists event batches idempotently", async () => {
    expect(await getProjectAccess(ownerId, projectId)).not.toBeNull();
    expect(await getProjectAccess(strangerId, projectId)).toBeNull();

    const events = Array.from({ length: eventCount }, (_, index) => ({
      eventName: "integration_purchase",
      distinctId: "user-integration-" + index,
      sessionId: "session-integration-" + index,
      properties: { plan: "pro", amount: 42 + index },
      timestamp: new Date().toISOString(),
      idempotencyKey: "integration-" + suffix + "-" + index,
    }));

    const first = await persistEventBatch(projectId, [...events, events[0]]);
    const retry = await persistEventBatch(projectId, [events[0]]);

    expect(first).toEqual({ accepted: eventCount, duplicates: 1 });
    expect(retry).toEqual({ accepted: 0, duplicates: 1 });
  });

  it("processes the complete batch once under concurrent workers", async () => {
    const results = await Promise.all([processOutboxBatch(100), processOutboxBatch(100)]);
    expect(results.reduce((sum, item) => sum + item.processed, 0)).toBe(eventCount);
    expect(results.reduce((sum, item) => sum + item.claimed, 0)).toBe(eventCount);

    const aggregate = await pool.query(
      "SELECT event_count, unique_users FROM daily_rollups WHERE project_id=$1 AND event_name='integration_purchase'",
      [projectId],
    );
    expect(aggregate.rows).toHaveLength(1);
    expect(Number(aggregate.rows[0].event_count)).toBe(eventCount);
    expect(Number(aggregate.rows[0].unique_users)).toBe(eventCount);

    const raw = await pool.query("SELECT COUNT(*)::int AS count FROM events WHERE project_id=$1", [projectId]);
    expect(raw.rows[0].count).toBe(eventCount);
  });
});
