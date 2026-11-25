import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { db, pool } from "@/db";
import { projects, user as users, workspaces, workspaceMembers } from "@/db/schema";
import { getProjectAccess } from "@/lib/permissions";
import { persistEventBatch } from "@/lib/ingestion";
import { processOutboxBatch } from "@/lib/process-outbox";

const enabled = process.env.RUN_DB_INTEGRATION === "1";

describe.skipIf(!enabled)("PostgreSQL event ingestion and outbox", () => {
  const suffix = randomUUID();
  const ownerId = "integration-owner-" + suffix;
  const strangerId = "integration-stranger-" + suffix;
  let workspaceId = "";
  let projectId = "";

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
  });

  afterAll(async () => {
    if (workspaceId) await db.delete(workspaces).where(eq(workspaces.id, workspaceId));
    await db.delete(users).where(eq(users.id, ownerId));
    await db.delete(users).where(eq(users.id, strangerId));
  });

  it("enforces project membership and persists event batches idempotently", async () => {
    expect(await getProjectAccess(ownerId, projectId)).not.toBeNull();
    expect(await getProjectAccess(strangerId, projectId)).toBeNull();

    const event = {
      eventName: "integration_purchase",
      distinctId: "user-integration-1",
      sessionId: "session-integration-1",
      properties: { plan: "pro", amount: 42 },
      timestamp: new Date().toISOString(),
      idempotencyKey: "integration-" + suffix,
    };

    const first = await persistEventBatch(projectId, [event, event]);
    const retry = await persistEventBatch(projectId, [event]);

    expect(first).toEqual({ accepted: 1, duplicates: 1 });
    expect(retry).toEqual({ accepted: 0, duplicates: 1 });
  });

  it("processes each outbox row once under concurrent workers", async () => {
    const results = await Promise.all([processOutboxBatch(10), processOutboxBatch(10)]);
    expect(results.reduce((sum, item) => sum + item.processed, 0)).toBe(1);
    expect(results.reduce((sum, item) => sum + item.claimed, 0)).toBe(1);

    const aggregate = await pool.query(
      "SELECT event_count, unique_users FROM daily_rollups WHERE project_id=$1 AND event_name='integration_purchase'",
      [projectId],
    );
    expect(aggregate.rows).toHaveLength(1);
    expect(Number(aggregate.rows[0].event_count)).toBe(1);
    expect(Number(aggregate.rows[0].unique_users)).toBe(1);

    const raw = await pool.query("SELECT COUNT(*)::int AS count FROM events WHERE project_id=$1", [projectId]);
    expect(raw.rows[0].count).toBe(1);
  });
});
