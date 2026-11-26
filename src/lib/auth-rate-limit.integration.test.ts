import { afterAll, describe, expect, it } from "vitest";
import { pool } from "@/db";

const enabled = process.env.RUN_DB_INTEGRATION === "1";

describe.skipIf(!enabled)("Better Auth database-backed rate limiting", () => {
  let cleanupTimestamp = 0;

  afterAll(async () => {
    if (cleanupTimestamp > 0) {
      await pool.query('DELETE FROM "rateLimit" WHERE "lastRequest" >= $1', [cleanupTimestamp]);
    }
  });

  it("enforces the configured limit across concurrent HTTP requests and persists the counter", async () => {
    process.env.BETTER_AUTH_RATE_LIMIT_MAX = "30";
    const { auth } = await import("@/lib/auth");
    cleanupTimestamp = Date.now();

    const responses = await Promise.all(
      Array.from({ length: 40 }, () =>
        auth.handler(
          new Request("http://localhost:3000/api/auth/get-session", {
            method: "GET",
            headers: { "x-forwarded-for": "127.0.0.1" },
          }),
        ),
      ),
    );

    const limited = responses.filter((response) => response.status === 429);
    expect(limited.length).toBeGreaterThan(0);
    expect(responses.filter((response) => response.status !== 429).length).toBeLessThanOrEqual(30);

    const persisted = await pool.query(
      'SELECT count FROM "rateLimit" WHERE "lastRequest" >= $1',
      [cleanupTimestamp],
    );
    expect(persisted.rows.length).toBeGreaterThan(0);
    expect(persisted.rows.some((row) => Number(row.count) > 0)).toBe(true);
  });
});
